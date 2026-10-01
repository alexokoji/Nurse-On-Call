import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { ExternalLink, FileText, Pencil, Plus } from 'lucide-react';
import { FilterBar } from '@/components/admin/filter-bar';
import { DeleteArticleButton } from './article-actions';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, TableSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminArticles } from '@/lib/queries/admin';

export const metadata: Metadata = { title: 'Content' };

export default async function AdminContentPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const user = await requireAdmin('content.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Health resources
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Articles published at /health-resources. Drafts are not visible to the public.
        </p>
      </div>

      <FilterBar
        searchPlaceholder="Search articles…"
        filters={[
          {
            name: 'status',
            label: 'All Status',
            options: [
              { value: 'published', label: 'Published' },
              { value: 'draft', label: 'Draft' },
            ],
          },
        ]}
      >
        {userCan(user, 'content.manage') && (
          <Button asChild>
            <Link href="/admin/content/new">
              <Plus className="size-4" />
              New Article
            </Link>
          </Button>
        )}
      </FilterBar>

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={6} columns={5} />
          </div>
        }
      >
        <ArticleTable params={params} />
      </Suspense>
    </div>
  );
}

async function ArticleTable({ params }: { params: { status?: string; page?: string } }) {
  const user = await requireAdmin('content.view');
  const canManage = userCan(user, 'content.manage');

  const result = await getAdminArticles({
    status: params.status,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={FileText}
          title="No articles yet"
          description="Publish practical health guidance to help patients and bring people to the site."
          action={canManage ? { label: 'Write an article', href: '/admin/content/new' } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Author</TableHead>
            <TableHead>Published</TableHead>
            <TableHead>Status</TableHead>
            {canManage && (
              <TableHead className="w-24 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((article) => (
            <TableRow key={article.id}>
              <TableCell>
                <Link
                  href={`/admin/content/${article.id}`}
                  className="block max-w-[24rem] truncate text-sm font-medium text-navy-800 hover:text-primary"
                >
                  {article.title}
                </Link>
                <span className="block font-mono text-xs text-muted-foreground">
                  /{article.slug} · {article.readMinutes} min read
                </span>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {article.category}
                </span>
              </TableCell>

              <TableCell>
                <span className="block max-w-[12rem] truncate text-sm text-muted-foreground">
                  {article.authorName}
                </span>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {article.publishedAt
                    ? format(new Date(article.publishedAt), 'd MMM yyyy')
                    : '—'}
                </span>
              </TableCell>

              <TableCell>
                <Badge variant={article.status === 'published' ? 'success' : 'warning'}>
                  {article.status}
                </Badge>
              </TableCell>

              {canManage && (
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    {article.status === 'published' && (
                      <Button asChild variant="ghost" size="icon-sm">
                        <Link
                          href={`/health-resources/${article.slug}`}
                          target="_blank"
                          aria-label={`View ${article.title} on the public site`}
                        >
                          <ExternalLink className="size-3.5" />
                        </Link>
                      </Button>
                    )}
                    <Button asChild variant="ghost" size="icon-sm">
                      <Link
                        href={`/admin/content/${article.id}`}
                        aria-label={`Edit ${article.title}`}
                      >
                        <Pencil className="size-3.5" />
                      </Link>
                    </Button>
                    <DeleteArticleButton articleId={article.id} title={article.title} />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="articles"
      />
    </div>
  );
}
