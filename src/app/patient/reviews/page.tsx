import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { Star } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientReviews, getReviewableBookings } from '@/lib/queries/patient';
import { cn } from '@/lib/utils';
import type { ReviewStatus } from '@/types';

export const metadata: Metadata = { title: 'My Reviews' };

export default async function PatientReviewsPage() {
  const user = await requirePatient();

  const [reviews, awaiting] = await Promise.all([
    getPatientReviews(user.id),
    getReviewableBookings(user.id),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">My reviews</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reviews are checked by our team before they appear on the public site.
        </p>
      </div>

      {awaiting.length > 0 && (
        <section className="rounded-xl border border-brand-200 bg-brand-50/50 p-5">
          <h2 className="text-sm font-semibold text-navy-800">
            {awaiting.length === 1
              ? 'One appointment is waiting for your review'
              : `${awaiting.length} appointments are waiting for your review`}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Your feedback tells us what to keep doing and what to fix.
          </p>

          <ul className="mt-4 space-y-2">
            {awaiting.map((booking) => (
              <li
                key={booking.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-background p-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-800">{booking.serviceName}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(booking.dateKey), 'd MMM yyyy')} · {booking.reference}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/patient/appointments/${booking.id}`}>Leave a review</Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviews.length === 0 ? (
        <EmptyState
          icon={Star}
          title="No reviews yet"
          description="After a completed appointment you can share how it went."
          action={
            awaiting.length === 0
              ? { label: 'Book a service', href: '/book' }
              : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {reviews.map((review) => (
            <li
              key={review.id}
              className="rounded-xl border border-border bg-card p-5 shadow-card"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-navy-800">{review.serviceName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {review.bookingReference} ·{' '}
                    {format(new Date(review.createdAt), 'd MMM yyyy')}
                  </p>
                </div>
                <StatusBadge kind="review" status={review.status as ReviewStatus} />
              </div>

              <div
                className="mt-3 flex gap-0.5"
                aria-label={`You rated this ${review.rating} out of 5`}
              >
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

              <blockquote className="mt-3 text-sm leading-relaxed text-muted-foreground">
                “{review.comment}”
              </blockquote>

              {review.response && (
                <p className="mt-4 rounded-lg bg-secondary/60 p-3 text-sm text-muted-foreground">
                  <span className="font-semibold text-navy-800">NurseOnCall replied:</span>{' '}
                  {review.response}
                </p>
              )}

              {review.status === 'pending' && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Awaiting moderation — it is not visible publicly yet.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
