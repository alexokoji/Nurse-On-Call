import type { Metadata } from 'next';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { Star } from 'lucide-react';
import { SummaryTile } from '@/components/admin/stat-card';
import { FilterBar } from '@/components/admin/filter-bar';
import { ReviewActions } from './review-actions';
import { StatusBadge } from '@/components/ui/status-badge';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, TableSkeleton, CardSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminReviews, getReviewStats } from '@/lib/queries/admin';
import { cn } from '@/lib/utils';
import { REVIEW_STATUSES } from '@/types';

export const metadata: Metadata = { title: 'Reviews' };

export default async function AdminReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdmin('reviews.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      <Suspense fallback={<CardSkeleton count={4} />}>
        <Stats />
      </Suspense>

      <FilterBar
        searchPlaceholder="Search reviews…"
        filters={[
          {
            name: 'status',
            label: 'All Status',
            options: REVIEW_STATUSES.map((status) => ({
              value: status,
              label: status[0].toUpperCase() + status.slice(1),
            })),
          },
        ]}
      />

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={6} columns={4} />
          </div>
        }
      >
        <ReviewList params={params} />
      </Suspense>
    </div>
  );
}

async function Stats() {
  const stats = await getReviewStats();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <SummaryTile label="Total Reviews" value={stats.total} icon={Star} />
      <SummaryTile
        label="Awaiting Moderation"
        value={stats.pending}
        icon={Star}
        accent="bg-amber-50 text-amber-600"
      />
      <SummaryTile
        label="Published"
        value={stats.approved}
        icon={Star}
        accent="bg-emerald-50 text-emerald-600"
      />
      <SummaryTile
        label="Average Rating"
        value={stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '—'}
        icon={Star}
        accent="bg-violet-50 text-violet-600"
      />
    </div>
  );
}

async function ReviewList({ params }: { params: { status?: string; page?: string } }) {
  const user = await requireAdmin('reviews.view');
  const canModerate = userCan(user, 'reviews.moderate');

  const result = await getAdminReviews({
    status: params.status,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={Star}
          title="No reviews available"
          description="Patients can review an appointment once it is completed."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result.data.map((review) => (
        <article key={review.id} className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-0.5" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'size-4',
                        i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-300',
                      )}
                      aria-hidden
                    />
                  ))}
                </div>
                <StatusBadge kind="review" status={review.status} />
              </div>

              <p className="mt-2 text-sm font-semibold text-navy-800">{review.patientName}</p>
              <p className="text-xs text-muted-foreground">
                {review.serviceName}
                {review.staffName && ` · attended by ${review.staffName}`} ·{' '}
                <span className="font-mono">{review.bookingReference}</span> ·{' '}
                {format(new Date(review.createdAt), 'd MMM yyyy')}
              </p>
            </div>

            {canModerate && (
              <ReviewActions
                reviewId={review.id}
                status={review.status}
                hasResponse={Boolean(review.response)}
              />
            )}
          </div>

          <blockquote className="mt-3 border-l-2 border-border pl-4 text-sm leading-relaxed text-muted-foreground">
            {review.comment}
          </blockquote>

          {review.response && (
            <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
              <span className="font-semibold text-navy-800">Our response:</span> {review.response}
            </p>
          )}
        </article>
      ))}

      <div className="rounded-xl border border-border bg-card shadow-card">
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
          label="reviews"
        />
      </div>
    </div>
  );
}
