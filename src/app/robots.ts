import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Nothing behind authentication should ever be crawled or indexed.
        disallow: [
          '/admin',
          '/admin/',
          '/patient',
          '/patient/',
          '/api/',
          '/login',
          '/register',
          '/forgot-password',
          '/reset-password',
          '/book/callback',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
