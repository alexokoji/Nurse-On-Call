import type { MetadataRoute } from 'next';
import { connectDB } from '@/lib/db/connect';
import { Service, HealthArticle } from '@/models';

export const dynamic = 'force-dynamic';

/**
 * Sitemap built from what is actually published — drafts and archived
 * services never appear. Only public pages are listed; the patient portal and
 * admin panel are excluded by design and by robots.txt.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: base, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/services`, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${base}/book`, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/about`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/team`, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/health-resources`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${base}/faq`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${base}/contact`, changeFrequency: 'yearly', priority: 0.6 },
    { url: `${base}/privacy`, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${base}/terms`, changeFrequency: 'yearly', priority: 0.3 },
  ];

  try {
    await connectDB();

    const [services, articles] = await Promise.all([
      Service.find({ status: 'published' }).select('slug updatedAt').lean(),
      HealthArticle.find({ status: 'published' }).select('slug updatedAt').lean(),
    ]);

    return [
      ...staticRoutes,
      ...services.map((service) => ({
        url: `${base}/services/${service.slug}`,
        lastModified: service.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.8,
      })),
      ...articles.map((article) => ({
        url: `${base}/health-resources/${article.slug}`,
        lastModified: article.updatedAt,
        changeFrequency: 'monthly' as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // A database outage must not break the sitemap entirely.
    return staticRoutes;
  }
}
