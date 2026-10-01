import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { BookOpen, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { getPublishedArticles } from '@/lib/queries/public';
import { cloudinaryVariant } from '@/lib/storage/image-url';

export const metadata: Metadata = {
  title: 'Health Resources',
  description:
    'Practical, plainly written health guidance from the NurseOnCall clinical team — chronic ' +
    'conditions, home care, diagnostics and preventive health.',
  alternates: { canonical: '/health-resources' },
};

export default async function HealthResourcesPage() {
  const articles = await getPublishedArticles();
  const [lead, ...rest] = articles;

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50/60 to-background">
        <div className="container py-12 md:py-16">
          <p className="eyebrow">Health Resources</p>
          <h1 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Guidance worth acting on
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground">
            Written by our clinical team for people managing real conditions at home — not
            search-engine filler.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          {articles.length === 0 ? (
            <EmptyState
              icon={BookOpen}
              title="No articles published yet"
              description="Our clinical team is preparing the first pieces. Check back soon."
              action={{ label: 'Browse services', href: '/services' }}
            />
          ) : (
            <>
              {lead && (
                <Link
                  href={`/health-resources/${lead.slug}`}
                  className="group block overflow-hidden rounded-3xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
                >
                  {lead.coverImage && (
                    <div className="relative aspect-[21/9]">
                      <Image
                        src={cloudinaryVariant(
                          lead.coverImage,
                          'c_fill,w_1200,h_514,q_auto,f_auto',
                        )}
                        alt=""
                        fill
                        priority
                        sizes="(min-width: 1280px) 64rem, 95vw"
                        className="object-cover"
                      />
                    </div>
                  )}
                  <div className="p-8 sm:p-10">
                  <Badge variant="info">{lead.category}</Badge>
                  <h2 className="mt-4 max-w-3xl text-balance font-display text-2xl font-bold tracking-tight text-navy-800 group-hover:text-primary sm:text-3xl">
                    {lead.title}
                  </h2>
                  <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    {lead.excerpt}
                  </p>
                  <ArticleMeta article={lead} className="mt-5" />
                  </div>
                </Link>
              )}

              {rest.length > 0 && (
                <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {rest.map((article) => (
                    <Link
                      key={article.id}
                      href={`/health-resources/${article.slug}`}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
                    >
                      {article.coverImage && (
                        <div className="relative aspect-[16/9]">
                          <Image
                            src={cloudinaryVariant(
                              article.coverImage,
                              'c_fill,w_600,h_338,q_auto,f_auto',
                            )}
                            alt=""
                            fill
                            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 90vw"
                            className="object-cover"
                          />
                        </div>
                      )}
                      <div className="flex flex-1 flex-col p-6">
                      <Badge variant="outline" className="self-start">
                        {article.category}
                      </Badge>
                      <h2 className="mt-3 text-base font-semibold text-navy-800 group-hover:text-primary">
                        {article.title}
                      </h2>
                      <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                        {article.excerpt}
                      </p>
                      <ArticleMeta article={article} className="mt-4" />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </section>
    </>
  );
}

function ArticleMeta({
  article,
  className,
}: {
  article: { readMinutes: number; authorName: string; publishedAt: string | null };
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground ${className ?? ''}`}>
      <span>{article.authorName}</span>
      <span aria-hidden>·</span>
      <span className="flex items-center gap-1">
        <Clock className="size-3.5" aria-hidden />
        {article.readMinutes} min read
      </span>
      {article.publishedAt && (
        <>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>
            {new Date(article.publishedAt).toLocaleDateString('en-NG', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </time>
        </>
      )}
    </div>
  );
}
