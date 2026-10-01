import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ArticleForm } from '../article-form';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth/guards';
import { connectDB } from '@/lib/db/connect';
import { HealthArticle } from '@/models';

export const metadata: Metadata = { title: 'Edit article' };

export default async function EditArticlePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('content.manage');
  const { id } = await params;

  await connectDB();
  const doc = await HealthArticle.findById(id).lean();
  if (!doc) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/content"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All articles
        </Link>

        {doc.status === 'published' && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/health-resources/${doc.slug}`} target="_blank">
              <ExternalLink className="size-4" />
              View public page
            </Link>
          </Button>
        )}
      </div>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">{doc.title}</h2>
        <p className="mt-1 font-mono text-sm text-muted-foreground">
          /health-resources/{doc.slug}
        </p>
      </div>

      <ArticleForm
        article={{
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
          status: doc.status,
        }}
      />
    </div>
  );
}
