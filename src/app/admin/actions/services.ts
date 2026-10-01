'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import { Booking, HealthArticle, Service, ServiceCategory } from '@/models';
import { apiRequirePermission, AuthError } from '@/lib/auth/guards';
import {
  healthArticleSchema,
  serviceCategorySchema,
  serviceSchema,
} from '@/lib/validations/admin';
import { recordAudit } from '@/lib/audit';
import { toKobo } from '@/lib/utils';
import type { ActionResult } from '@/types';

function toResult<T = unknown>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof AuthError) return { ok: false, message: error.message };
  if ((error as { code?: number }).code === 11000) {
    return { ok: false, fieldErrors: { slug: ['That slug is already in use'] } };
  }
  console.error('[admin:services]', error);
  return { ok: false, message: fallback };
}

/** Repeatable list inputs post as several fields with the same name. */
function listFrom(formData: FormData, name: string): string[] {
  return formData
    .getAll(name)
    .map((value) => String(value).trim())
    .filter(Boolean);
}

export async function saveServiceAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const serviceId = String(formData.get('serviceId') ?? '');
    const isEdit = serviceId.length > 0;

    const user = await apiRequirePermission(isEdit ? 'services.edit' : 'services.create');

    /* FAQs arrive as parallel arrays of questions and answers. */
    const questions = formData.getAll('faqQuestion').map(String);
    const answers = formData.getAll('faqAnswer').map(String);
    const faqs = questions
      .map((question, index) => ({ question: question.trim(), answer: (answers[index] ?? '').trim() }))
      .filter((faq) => faq.question && faq.answer);

    const parsed = serviceSchema.safeParse({
      name: formData.get('name'),
      slug: formData.get('slug'),
      categoryId: formData.get('categoryId'),
      shortDescription: formData.get('shortDescription'),
      description: formData.get('description'),
      image: formData.get('image') || '',
      icon: formData.get('icon') || 'stethoscope',
      price: formData.get('price'),
      homeVisitSurcharge: formData.get('homeVisitSurcharge') || 0,
      durationMinutes: formData.get('durationMinutes'),
      bufferMinutes: formData.get('bufferMinutes') || 15,
      serviceType: formData.get('serviceType'),
      whatsIncluded: listFrom(formData, 'whatsIncluded'),
      requirements: listFrom(formData, 'requirements'),
      preparation: listFrom(formData, 'preparation'),
      faqs,
      status: formData.get('status') || 'draft',
      isFeatured: formData.get('isFeatured') === 'on',
      seoTitle: formData.get('seoTitle') || undefined,
      seoDescription: formData.get('seoDescription') || undefined,
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();
    const data = parsed.data;

    const document = {
      name: data.name,
      slug: data.slug,
      category: data.categoryId,
      shortDescription: data.shortDescription,
      description: data.description,
      image: data.image || undefined,
      icon: data.icon,
      // Admins type naira; storage is kobo.
      priceKobo: toKobo(data.price),
      homeVisitSurchargeKobo: toKobo(data.homeVisitSurcharge),
      durationMinutes: data.durationMinutes,
      bufferMinutes: data.bufferMinutes,
      serviceType: data.serviceType,
      whatsIncluded: data.whatsIncluded,
      requirements: data.requirements,
      preparation: data.preparation,
      faqs: data.faqs,
      status: data.status,
      isFeatured: data.isFeatured,
      seo: { title: data.seoTitle, description: data.seoDescription },
    };

    let id = serviceId;

    if (isEdit) {
      const existing = await Service.findById(serviceId).lean();
      if (!existing) return { ok: false, message: 'Service not found.' };

      await Service.updateOne({ _id: serviceId }, { $set: document });

      await recordAudit({
        actor: user,
        action: 'service.update',
        entity: 'Service',
        entityId: serviceId,
        summary: `Service "${data.name}" updated`,
        before: {
          name: existing.name,
          priceKobo: existing.priceKobo,
          status: existing.status,
          durationMinutes: existing.durationMinutes,
        },
        after: {
          name: data.name,
          priceKobo: document.priceKobo,
          status: data.status,
          durationMinutes: data.durationMinutes,
        },
      });
    } else {
      const created = await Service.create(document);
      id = String(created._id);

      await recordAudit({
        actor: user,
        action: 'service.create',
        entity: 'Service',
        entityId: id,
        summary: `Service "${data.name}" created`,
        after: { name: data.name, priceKobo: document.priceKobo, status: data.status },
      });
    }

    revalidatePath('/admin/services');
    revalidatePath('/services');
    revalidatePath(`/services/${data.slug}`);

    return {
      ok: true,
      message: isEdit ? 'Service updated.' : 'Service created.',
      data: { id },
    };
  } catch (error) {
    return toResult(error, 'We could not save that service.');
  }
}

export async function setServiceStatusAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('services.edit');

    const parsed = z
      .object({
        serviceId: z.string().min(1),
        status: z.enum(['draft', 'published', 'archived']),
      })
      .safeParse({
        serviceId: formData.get('serviceId'),
        status: formData.get('status'),
      });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();

    /* Archiving a service with live bookings would strand those patients. */
    if (parsed.data.status === 'archived') {
      const live = await Booking.countDocuments({
        service: parsed.data.serviceId,
        status: { $in: ['pending_payment', 'confirmed', 'in_progress'] },
      });
      if (live > 0) {
        return {
          ok: false,
          message:
            `This service has ${live} upcoming appointment${live === 1 ? '' : 's'}. ` +
            `Unpublish it instead — that hides it from new bookings without affecting existing ones.`,
        };
      }
    }

    const service = await Service.findById(parsed.data.serviceId);
    if (!service) return { ok: false, message: 'Service not found.' };

    const before = { status: service.status };
    service.status = parsed.data.status;
    await service.save();

    await recordAudit({
      actor: user,
      action: 'service.status',
      entity: 'Service',
      entityId: parsed.data.serviceId,
      summary: `Service "${service.name}" set to ${parsed.data.status}`,
      before,
      after: { status: parsed.data.status },
    });

    revalidatePath('/admin/services');
    revalidatePath('/services');

    return {
      ok: true,
      message:
        parsed.data.status === 'published'
          ? 'Service published and now bookable.'
          : parsed.data.status === 'draft'
            ? 'Service unpublished — it is hidden from the public site.'
            : 'Service archived.',
    };
  } catch (error) {
    return toResult(error, 'We could not change that service.');
  }
}

export async function saveCategoryAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('services.edit');
    const categoryId = String(formData.get('categoryId') ?? '');

    const parsed = serviceCategorySchema.safeParse({
      name: formData.get('name'),
      slug: formData.get('slug'),
      description: formData.get('description') || undefined,
      icon: formData.get('icon') || 'heart-pulse',
      accent: formData.get('accent') || 'crimson',
      sortOrder: formData.get('sortOrder') || 0,
      isActive: formData.get('isActive') === 'on',
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();

    if (categoryId) {
      await ServiceCategory.updateOne({ _id: categoryId }, { $set: parsed.data });
    } else {
      await ServiceCategory.create(parsed.data);
    }

    await recordAudit({
      actor: user,
      action: categoryId ? 'category.update' : 'category.create',
      entity: 'ServiceCategory',
      entityId: categoryId || undefined,
      summary: `Category "${parsed.data.name}" ${categoryId ? 'updated' : 'created'}`,
      after: { name: parsed.data.name, isActive: parsed.data.isActive },
    });

    revalidatePath('/admin/services');
    revalidatePath('/services');

    return { ok: true, message: categoryId ? 'Category updated.' : 'Category created.' };
  } catch (error) {
    return toResult(error, 'We could not save that category.');
  }
}

/* ── Health articles ──────────────────────────────────────────────── */

export async function saveArticleAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  try {
    const user = await apiRequirePermission('content.manage');
    const articleId = String(formData.get('articleId') ?? '');
    const isEdit = articleId.length > 0;

    const parsed = healthArticleSchema.safeParse({
      title: formData.get('title'),
      slug: formData.get('slug'),
      excerpt: formData.get('excerpt'),
      content: formData.get('content'),
      coverImage: formData.get('coverImage') || '',
      category: formData.get('category') || 'General Health',
      tags: String(formData.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      authorName: formData.get('authorName') || 'NurseOnCall Clinical Team',
      readMinutes: formData.get('readMinutes') || 4,
      status: formData.get('status') || 'draft',
    });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();
    const data = parsed.data;

    let id = articleId;

    if (isEdit) {
      const existing = await HealthArticle.findById(articleId);
      if (!existing) return { ok: false, message: 'Article not found.' };

      const wasPublished = existing.status === 'published';
      Object.assign(existing, data, {
        coverImage: data.coverImage || undefined,
        seo: { title: data.title, description: data.excerpt },
        // Stamp publishedAt the first time it goes live, and keep it after.
        publishedAt:
          data.status === 'published' && !wasPublished ? new Date() : existing.publishedAt,
      });
      await existing.save();
    } else {
      const created = await HealthArticle.create({
        ...data,
        coverImage: data.coverImage || undefined,
        seo: { title: data.title, description: data.excerpt },
        publishedAt: data.status === 'published' ? new Date() : null,
      });
      id = String(created._id);
    }

    await recordAudit({
      actor: user,
      action: isEdit ? 'article.update' : 'article.create',
      entity: 'HealthArticle',
      entityId: id,
      summary: `Article "${data.title}" ${isEdit ? 'updated' : 'created'} (${data.status})`,
      after: { title: data.title, status: data.status },
    });

    revalidatePath('/admin/content');
    revalidatePath('/health-resources');
    revalidatePath(`/health-resources/${data.slug}`);

    return { ok: true, message: isEdit ? 'Article updated.' : 'Article created.', data: { id } };
  } catch (error) {
    return toResult(error, 'We could not save that article.');
  }
}

export async function deleteArticleAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('content.manage');
    const articleId = String(formData.get('articleId') ?? '');

    await connectDB();
    const article = await HealthArticle.findByIdAndDelete(articleId);
    if (!article) return { ok: false, message: 'Article not found.' };

    await recordAudit({
      actor: user,
      action: 'article.delete',
      entity: 'HealthArticle',
      entityId: articleId,
      summary: `Article "${article.title}" deleted`,
      before: { title: article.title, status: article.status },
    });

    revalidatePath('/admin/content');
    revalidatePath('/health-resources');

    return { ok: true, message: 'Article deleted.' };
  } catch (error) {
    return toResult(error, 'We could not delete that article.');
  }
}
