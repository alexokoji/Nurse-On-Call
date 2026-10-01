import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ArticleForm } from '../article-form';
import { requireAdmin } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'New article' };

export default async function NewArticlePage() {
  await requireAdmin('content.manage');

  return (
    <div className="space-y-5">
      <Link
        href="/admin/content"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All articles
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Write an article
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Save as a draft while you work — nothing is public until you publish it.
        </p>
      </div>

      <ArticleForm article={null} />
    </div>
  );
}
