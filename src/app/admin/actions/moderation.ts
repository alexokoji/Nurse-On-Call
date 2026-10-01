'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import { Review, Service, StaffProfile, SupportTicket } from '@/models';
import { apiRequirePermission, AuthError } from '@/lib/auth/guards';
import { reviewModerationSchema, sendNotificationSchema } from '@/lib/validations/admin';
import { notify, notifyBulk } from '@/lib/notifications/service';
import { recordAudit } from '@/lib/audit';
import { User } from '@/models';
import type { ActionResult } from '@/types';

function toResult(error: unknown, fallback: string): ActionResult {
  if (error instanceof AuthError) return { ok: false, message: error.message };
  console.error('[admin:moderation]', error);
  return { ok: false, message: fallback };
}

/* ── Reviews ──────────────────────────────────────────────────────── */

/**
 * Moderating a review changes what the public site shows, so the cached
 * service rating is recomputed from approved reviews only — otherwise a
 * hidden one-star review would keep dragging the average down.
 */
export async function moderateReviewAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('reviews.moderate');

    const parsed = reviewModerationSchema.safeParse({
      reviewId: formData.get('reviewId'),
      action: formData.get('action'),
    });
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();
    const review = await Review.findById(parsed.data.reviewId);
    if (!review) return { ok: false, message: 'Review not found.' };

    const before = { status: review.status };
    const serviceId = review.service;
    const staffId = review.staff;

    if (parsed.data.action === 'delete') {
      await review.deleteOne();
    } else {
      review.status = parsed.data.action === 'approve' ? 'approved' : 'hidden';
      review.moderatedBy = user.id as never;
      review.moderatedAt = new Date();
      await review.save();
    }

    await recomputeRatings(String(serviceId), staffId ? String(staffId) : null);

    await recordAudit({
      actor: user,
      action: `review.${parsed.data.action}`,
      entity: 'Review',
      entityId: parsed.data.reviewId,
      summary: `Review ${parsed.data.action === 'delete' ? 'deleted' : parsed.data.action + 'd'}`,
      before,
      after: parsed.data.action === 'delete' ? undefined : { status: review.status },
    });

    revalidatePath('/admin/reviews');

    return {
      ok: true,
      message:
        parsed.data.action === 'approve'
          ? 'Review approved and is now public.'
          : parsed.data.action === 'hide'
            ? 'Review hidden from the public site.'
            : 'Review deleted.',
    };
  } catch (error) {
    return toResult(error, 'We could not moderate that review.');
  }
}

export async function respondToReviewAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('reviews.moderate');

    const parsed = z
      .object({
        reviewId: z.string().min(1),
        response: z.string().trim().min(5, 'Write a reply').max(1000),
      })
      .safeParse({
        reviewId: formData.get('reviewId'),
        response: formData.get('response'),
      });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();
    const result = await Review.updateOne(
      { _id: parsed.data.reviewId },
      { $set: { response: parsed.data.response } },
    );
    if (result.matchedCount === 0) return { ok: false, message: 'Review not found.' };

    await recordAudit({
      actor: user,
      action: 'review.respond',
      entity: 'Review',
      entityId: parsed.data.reviewId,
      summary: 'Public response added to a review',
    });

    revalidatePath('/admin/reviews');
    return { ok: true, message: 'Your response has been published with the review.' };
  } catch (error) {
    return toResult(error, 'We could not save that response.');
  }
}

/** Recalculates cached averages from approved reviews only. */
async function recomputeRatings(serviceId: string, staffId: string | null) {
  const [serviceAgg] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { service: (await import('mongoose')).Types.ObjectId.createFromHexString(serviceId), status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await Service.updateOne(
    { _id: serviceId },
    {
      $set: {
        averageRating: serviceAgg ? Math.round(serviceAgg.avg * 10) / 10 : 0,
        reviewCount: serviceAgg?.count ?? 0,
      },
    },
  );

  if (!staffId) return;

  const [staffAgg] = await Review.aggregate<{ avg: number; count: number }>([
    { $match: { staff: (await import('mongoose')).Types.ObjectId.createFromHexString(staffId), status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  await StaffProfile.updateOne(
    { _id: staffId },
    {
      $set: {
        averageRating: staffAgg ? Math.round(staffAgg.avg * 10) / 10 : 0,
        reviewCount: staffAgg?.count ?? 0,
      },
    },
  );
}

/* ── Notifications ────────────────────────────────────────────────── */

export async function sendNotificationAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('notifications.send');

    const parsed = sendNotificationSchema.safeParse({
      channel: formData.get('channel'),
      audience: formData.get('audience'),
      recipientId: formData.get('recipientId') || undefined,
      subject: formData.get('subject'),
      body: formData.get('body'),
    });
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();

    if (parsed.data.audience === 'individual') {
      await notify({
        recipientId: parsed.data.recipientId!,
        template: 'custom',
        channels: [parsed.data.channel],
        data: { subject: parsed.data.subject, body: parsed.data.body },
        sentBy: user.id,
      });

      await recordAudit({
        actor: user,
        action: 'notification.send',
        entity: 'Notification',
        summary: `Sent a ${parsed.data.channel} notification to one recipient`,
      });

      revalidatePath('/admin/notifications');
      return { ok: true, message: 'Notification sent.' };
    }

    const filter =
      parsed.data.audience === 'all_patients'
        ? { role: 'patient' }
        : parsed.data.audience === 'active_patients'
          ? { role: 'patient', status: 'active' }
          : { role: 'staff', status: 'active' };

    const recipients = await User.find(filter).select('_id').lean();

    if (recipients.length === 0) {
      return { ok: false, message: 'No recipients match that audience.' };
    }

    const { sent } = await notifyBulk({
      recipientIds: recipients.map((recipient) => String(recipient._id)),
      channel: parsed.data.channel,
      subject: parsed.data.subject,
      body: parsed.data.body,
      sentBy: user.id,
    });

    await recordAudit({
      actor: user,
      action: 'notification.bulk_send',
      entity: 'Notification',
      summary: `Sent a ${parsed.data.channel} broadcast to ${sent} ${parsed.data.audience.replace(/_/g, ' ')}`,
      after: { subject: parsed.data.subject, recipients: sent },
    });

    revalidatePath('/admin/notifications');
    return { ok: true, message: `Notification queued for ${sent} recipients.` };
  } catch (error) {
    return toResult(error, 'We could not send that notification.');
  }
}

/* ── Support tickets ──────────────────────────────────────────────── */

export async function replyToTicketAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('support.respond');

    const parsed = z
      .object({
        ticketId: z.string().min(1),
        message: z.string().trim().min(2, 'Enter a reply').max(4000),
        status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
      })
      .safeParse({
        ticketId: formData.get('ticketId'),
        message: formData.get('message'),
        status: formData.get('status') || undefined,
      });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();

    const ticket = await SupportTicket.findById(parsed.data.ticketId);
    if (!ticket) return { ok: false, message: 'Support request not found.' };

    ticket.messages.push({
      author: user.id as never,
      authorName: user.name,
      isStaff: true,
      body: parsed.data.message,
      createdAt: new Date(),
    });

    if (parsed.data.status) ticket.status = parsed.data.status;
    if (parsed.data.status === 'resolved') ticket.resolvedAt = new Date();
    ticket.assignedTo = user.id as never;
    await ticket.save();

    // Tell the patient there is a reply waiting.
    await notify({
      recipientId: String(ticket.patient),
      template: 'custom',
      channels: ['email', 'in_app'],
      data: {
        subject: `Re: ${ticket.subject}`,
        body: `${parsed.data.message}\n\nYou can reply from your dashboard under Support.`,
      },
      link: '/patient/support',
      sentBy: user.id,
    });

    await recordAudit({
      actor: user,
      action: 'support.reply',
      entity: 'SupportTicket',
      entityId: parsed.data.ticketId,
      summary: `Replied to support request ${ticket.reference}`,
    });

    revalidatePath('/admin/messages');
    return { ok: true, message: 'Reply sent to the patient.' };
  } catch (error) {
    return toResult(error, 'We could not send that reply.');
  }
}
