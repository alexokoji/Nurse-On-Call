import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getArticleBySlug, getPublishedArticles } from '@/lib/queries/public';
import { cloudinaryVariant } from '@/lib/storage/image-url';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: 'Article not found' };

  return {
    title: article.seo?.title ?? article.title,
    description: article.seo?.description ?? article.excerpt,
    alternates: { canonical: `/health-resources/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.excerpt,
      type: 'article',
      publishedTime: article.publishedAt ?? undefined,
      authors: [article.authorName],
    },
  };
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);

  if (!article) notFound();

  const others = (await getPublishedArticles())
    .filter((item) => item.slug !== article.slug)
    .slice(0, 3);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.excerpt,
    author: { '@type': 'Organization', name: article.authorName },
    publisher: { '@type': 'Organization', name: 'NurseOnCall' },
    datePublished: article.publishedAt,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <article className="section">
        <div className="container max-w-3xl">
          <Link
            href="/health-resources"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
          >
            <ArrowLeft className="size-4" aria-hidden />
            All health resources
          </Link>

          {article.coverImage && (
            <div className="relative mt-6 aspect-[21/9] overflow-hidden rounded-2xl shadow-soft">
              <Image
                src={cloudinaryVariant(
                  article.coverImage,
                  'c_fill,w_1400,h_600,q_auto,f_auto',
                )}
                alt={article.title}
                fill
                priority
                sizes="(min-width: 768px) 48rem, 95vw"
                className="object-cover"
              />
            </div>
          )}

          <header className="mt-6">
            <Badge variant="info">{article.category}</Badge>
            <h1 className="mt-4 text-balance font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
              {article.title}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {article.excerpt}
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border pb-5 text-sm text-muted-foreground">
              <span className="font-medium text-navy-800">{article.authorName}</span>
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
          </header>

          <div className="mt-8">
            <ArticleBody content={article.content} />
          </div>

          {article.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2 border-t border-border pt-6">
              {article.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          )}

          <aside className="mt-10 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <p className="text-sm font-semibold text-amber-900">A note on general guidance</p>
            <p className="mt-1.5 text-sm leading-relaxed text-amber-800">
              This article is general health information, not a diagnosis or a treatment plan for
              your situation. If something here applies to you, book a consultation and let a
              clinician look at your specific case.
            </p>
          </aside>

          <div className="mt-10 rounded-2xl bg-navy-800 p-8 text-center">
            <h2 className="font-display text-xl font-bold text-white">Need to speak to someone?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-white/75">
              Book a consultation in clinic, at home or online.
            </p>
            <Button asChild variant="accent" className="mt-5">
              <Link href="/book">Book a consultation</Link>
            </Button>
          </div>
        </div>
      </article>

      {others.length > 0 && (
        <section className="section bg-secondary/40">
          <div className="container max-w-5xl">
            <h2 className="font-display text-2xl font-bold tracking-tight">Read next</h2>
            <div className="mt-6 grid gap-5 sm:grid-cols-3">
              {others.map((item) => (
                <Link
                  key={item.id}
                  href={`/health-resources/${item.slug}`}
                  className="group rounded-2xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
                >
                  <Badge variant="outline">{item.category}</Badge>
                  <h3 className="mt-3 text-sm font-semibold text-navy-800 group-hover:text-primary">
                    {item.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{item.excerpt}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

/**
 * Minimal, safe renderer for the article body.
 *
 * Content is stored as plain text with `## ` headings and `- ` bullets. It is
 * rendered as React elements rather than injected as HTML, so an article can
 * never introduce script into the page — worth the small feature ceiling.
 */
function ArticleBody({ content }: { content: string }) {
  const blocks = content.split('\n\n').filter((block) => block.trim());

  return (
    <div className="space-y-5">
      {blocks.map((block, index) => {
        const trimmed = block.trim();

        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={index}
              className="pt-3 font-display text-xl font-bold tracking-tight text-navy-800"
            >
              {trimmed.slice(3)}
            </h2>
          );
        }

        if (trimmed.startsWith('### ')) {
          return (
            <h3 key={index} className="pt-2 font-display text-lg font-semibold text-navy-800">
              {trimmed.slice(4)}
            </h3>
          );
        }

        if (trimmed.startsWith('- ')) {
          return (
            <ul key={index} className="space-y-2 pl-1">
              {trimmed.split('\n').map((line, i) => (
                <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-muted-foreground">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-crimson-500" aria-hidden />
                  <Inline text={line.replace(/^-\s*/, '')} />
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index} className="text-sm leading-relaxed text-muted-foreground sm:text-base">
            <Inline text={trimmed} />
          </p>
        );
      })}
    </div>
  );
}

/** Renders **bold** spans without dangerouslySetInnerHTML. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith('**') && part.endsWith('**') ? (
          <strong key={index} className="font-semibold text-navy-800">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={index}>{part}</span>
        ),
      )}
    </>
  );
}
