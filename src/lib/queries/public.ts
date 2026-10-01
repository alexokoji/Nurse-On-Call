import 'server-only';
import { cache } from 'react';
import { connectDB } from '@/lib/db/connect';
import { Service, ServiceCategory, StaffProfile, Review, Booking, User, HealthArticle } from '@/models';

/**
 * Read models for the public site.
 *
 * Each returns plain, serialisable objects (never Mongoose documents) so they
 * can cross the server/client boundary, and each degrades to an empty result
 * if the database is unreachable — a marketing page should not 500 because
 * Mongo blinked.
 */

export interface PublicService {
  id: string;
  name: string;
  slug: string;
  shortDescription: string;
  priceKobo: number;
  homeVisitSurchargeKobo: number;
  durationMinutes: number;
  serviceType: string;
  icon: string;
  image?: string;
  averageRating: number;
  reviewCount: number;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string; accent: string; icon: string } | null;
}

function toPublicService(doc: Record<string, unknown>): PublicService {
  const category = doc.category as Record<string, unknown> | null;
  return {
    id: String(doc._id),
    name: String(doc.name),
    slug: String(doc.slug),
    shortDescription: String(doc.shortDescription ?? ''),
    priceKobo: Number(doc.priceKobo ?? 0),
    homeVisitSurchargeKobo: Number(doc.homeVisitSurchargeKobo ?? 0),
    durationMinutes: Number(doc.durationMinutes ?? 60),
    serviceType: String(doc.serviceType ?? 'clinic'),
    icon: String(doc.icon ?? 'stethoscope'),
    image: doc.image ? String(doc.image) : undefined,
    averageRating: Number(doc.averageRating ?? 0),
    reviewCount: Number(doc.reviewCount ?? 0),
    isFeatured: Boolean(doc.isFeatured),
    category:
      category && category._id
        ? {
            id: String(category._id),
            name: String(category.name),
            slug: String(category.slug),
            accent: String(category.accent ?? 'teal'),
            icon: String(category.icon ?? 'heart-pulse'),
          }
        : null,
  };
}

export const getPublishedServices = cache(async (): Promise<PublicService[]> => {
  try {
    await connectDB();
    const docs = await Service.find({ status: 'published' })
      .populate('category', 'name slug accent icon')
      .sort({ isFeatured: -1, bookingCount: -1, name: 1 })
      .lean();
    return docs.map((doc) => toPublicService(doc as unknown as Record<string, unknown>));
  } catch {
    return [];
  }
});

export const getFeaturedServices = cache(async (limit = 5): Promise<PublicService[]> => {
  const services = await getPublishedServices();
  const featured = services.filter((service) => service.isFeatured);
  return (featured.length >= limit ? featured : services).slice(0, limit);
});

export const getServiceCategories = cache(async () => {
  try {
    await connectDB();
    const docs = await ServiceCategory.find({ isActive: true }).sort({ sortOrder: 1, name: 1 }).lean();
    return docs.map((doc) => ({
      id: String(doc._id),
      name: doc.name,
      slug: doc.slug,
      description: doc.description ?? '',
      icon: doc.icon,
      accent: doc.accent,
    }));
  } catch {
    return [];
  }
});

export const getServiceBySlug = cache(async (slug: string) => {
  try {
    await connectDB();
    const doc = await Service.findOne({ slug, status: 'published' })
      .populate('category', 'name slug accent icon')
      .lean();
    if (!doc) return null;

    return {
      ...toPublicService(doc as unknown as Record<string, unknown>),
      description: doc.description,
      bufferMinutes: doc.bufferMinutes,
      whatsIncluded: doc.whatsIncluded ?? [],
      requirements: doc.requirements ?? [],
      preparation: doc.preparation ?? [],
      faqs: doc.faqs ?? [],
      seo: doc.seo ?? null,
    };
  } catch {
    return null;
  }
});

/** Approved reviews for one service, newest first. */
export const getServiceReviews = cache(async (serviceId: string, limit = 6) => {
  try {
    await connectDB();
    const docs = await Review.find({ service: serviceId, status: 'approved' })
      .populate('patient', 'name')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return docs.map((doc) => ({
      id: String(doc._id),
      rating: doc.rating,
      title: doc.title ?? '',
      comment: doc.comment,
      // Public reviews show a first name and initial only.
      author: anonymiseName((doc.patient as unknown as { name?: string })?.name ?? 'Patient'),
      createdAt: doc.createdAt.toISOString(),
      response: doc.response ?? null,
    }));
  } catch {
    return [];
  }
});

/** Highest-rated approved reviews across all services, for the homepage. */
export const getTestimonials = cache(async (limit = 6) => {
  try {
    await connectDB();
    const docs = await Review.find({ status: 'approved', rating: { $gte: 4 } })
      .populate('patient', 'name')
      .populate('service', 'name')
      .sort({ rating: -1, createdAt: -1 })
      .limit(limit)
      .lean();

    return docs.map((doc) => ({
      id: String(doc._id),
      rating: doc.rating,
      comment: doc.comment,
      author: anonymiseName((doc.patient as unknown as { name?: string })?.name ?? 'Patient'),
      service: (doc.service as unknown as { name?: string })?.name ?? '',
    }));
  } catch {
    return [];
  }
});

export const getPublicTeam = cache(async (limit?: number) => {
  try {
    await connectDB();
    const query = StaffProfile.find({ isActive: true, isPubliclyVisible: true })
      .populate('user', 'name avatar')
      .populate('services', 'name slug')
      .sort({ averageRating: -1, createdAt: 1 });

    if (limit) query.limit(limit);
    const docs = await query.lean();

    return docs.map((doc) => {
      const user = doc.user as unknown as { name?: string; avatar?: string } | null;
      return {
        id: String(doc._id),
        name: user?.name ?? 'Care professional',
        avatar: user?.avatar ?? '',
        title: doc.title,
        department: doc.department,
        bio: doc.bio ?? '',
        qualifications: doc.qualifications ?? [],
        specialisations: doc.specialisations ?? [],
        yearsOfExperience: doc.yearsOfExperience ?? 0,
        averageRating: doc.averageRating ?? 0,
        reviewCount: doc.reviewCount ?? 0,
        services: (doc.services as unknown as { name: string; slug: string }[] | undefined) ?? [],
      };
    });
  } catch {
    return [];
  }
});

/** Trust indicators on the homepage — real counts, not decoration. */
export const getPublicStats = cache(async () => {
  const fallback = { patients: 0, appointments: 0, staff: 0, services: 0 };
  try {
    await connectDB();
    const [patients, appointments, staff, services] = await Promise.all([
      User.countDocuments({ role: 'patient', status: 'active' }),
      Booking.countDocuments({ status: 'completed' }),
      StaffProfile.countDocuments({ isActive: true }),
      Service.countDocuments({ status: 'published' }),
    ]);
    return { patients, appointments, staff, services };
  } catch {
    return fallback;
  }
});

export const getPublishedArticles = cache(async (limit?: number) => {
  try {
    await connectDB();
    const query = HealthArticle.find({ status: 'published' }).sort({ publishedAt: -1 });
    if (limit) query.limit(limit);
    const docs = await query.lean();

    return docs.map((doc) => ({
      id: String(doc._id),
      title: doc.title,
      slug: doc.slug,
      excerpt: doc.excerpt,
      coverImage: doc.coverImage ?? '',
      category: doc.category,
      authorName: doc.authorName,
      readMinutes: doc.readMinutes,
      publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    }));
  } catch {
    return [];
  }
});

export const getArticleBySlug = cache(async (slug: string) => {
  try {
    await connectDB();
    const doc = await HealthArticle.findOne({ slug, status: 'published' }).lean();
    if (!doc) return null;
    return {
      id: String(doc._id),
      title: doc.title,
      slug: doc.slug,
      excerpt: doc.excerpt,
      content: doc.content,
      coverImage: doc.coverImage ?? '',
      category: doc.category,
      tags: doc.tags ?? [],
      authorName: doc.authorName,
      readMinutes: doc.readMinutes,
      publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
      seo: doc.seo ?? null,
    };
  } catch {
    return null;
  }
});

/** "Adaeze Okonkwo" → "Adaeze O." — enough to feel real, not identifying. */
function anonymiseName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}
