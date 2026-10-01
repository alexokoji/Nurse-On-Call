'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { CalendarClock, CreditCard, Star, XCircle } from 'lucide-react';
import { cancelBookingAction, submitReviewAction } from '../../actions';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Alert } from '@/components/ui/feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { StatusBadge } from '@/components/ui/status-badge';
import { cn, formatNaira } from '@/lib/utils';
import type { ActionResult, ReviewStatus } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

/**
 * The action bar on an appointment.
 *
 * Which actions appear is decided on the server (the `can*` props) — the
 * server actions re-check the same rules, so hiding a button is a courtesy
 * rather than the enforcement.
 */
export function AppointmentActions({
  bookingId,
  serviceName,
  canCancel,
  canReschedule,
  canPay,
  canReview,
  amountDueKobo,
  cancellationPolicy,
  existingReview,
}: {
  bookingId: string;
  serviceName: string;
  canCancel: boolean;
  canReschedule: boolean;
  canPay: boolean;
  canReview: boolean;
  amountDueKobo: number;
  cancellationPolicy: string;
  existingReview: { id: string; rating: number; comment: string; status: string } | null;
}) {
  const [paying, setPaying] = useState(false);

  const startPayment = async () => {
    setPaying(true);
    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const payload = await response.json();

      if (!response.ok) {
        toast.error(payload.error ?? 'We could not start the payment.');
        return;
      }
      window.location.href = payload.authorizationUrl;
    } catch {
      toast.error('We could not reach the payment service. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const nothingToDo = !canCancel && !canReschedule && !canPay && !canReview && !existingReview;
  if (nothingToDo) return null;

  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h2 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
        Manage this appointment
      </h2>

      <div className="space-y-4 p-5">
        <div className="flex flex-wrap gap-2">
          {canPay && (
            <Button onClick={startPayment} loading={paying}>
              <CreditCard className="size-4" />
              Pay {formatNaira(amountDueKobo)}
            </Button>
          )}

          {canReschedule && (
            <Button variant="outline" asChild>
              <Link href={`/patient/appointments/${bookingId}/reschedule`}>
                <CalendarClock className="size-4" />
                Reschedule
              </Link>
            </Button>
          )}

          {canCancel && <CancelDialog bookingId={bookingId} policy={cancellationPolicy} />}

          {canReview && <ReviewDialog bookingId={bookingId} serviceName={serviceName} />}
        </div>

        {existingReview && (
          <div className="rounded-lg border border-border bg-secondary/40 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex gap-0.5" aria-label={`You rated this ${existingReview.rating} out of 5`}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'size-4',
                      i < existingReview.rating
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300',
                    )}
                    aria-hidden
                  />
                ))}
              </div>
              <StatusBadge kind="review" status={existingReview.status as ReviewStatus} />
            </div>
            <p className="mt-2 text-sm text-muted-foreground">“{existingReview.comment}”</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Cancel ───────────────────────────────────────────────────────── */

function CancelDialog({ bookingId, policy }: { bookingId: string; policy: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(cancelBookingAction, INITIAL);

  // Close on success and surface the outcome as a toast. This runs in an
  // effect rather than during render — setState while rendering warns and
  // can loop.
  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive hover:bg-red-50">
          <XCircle className="size-4" />
          Cancel appointment
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription>
            This frees the slot for another patient and cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="warning" title="Cancellation policy">
          {policy}
        </Alert>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Field label="Why are you cancelling?" required error={state.fieldErrors?.reason?.[0]}>
            <Textarea name="reason" rows={3} placeholder="A brief reason helps us improve." required />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep appointment
            </Button>
            <SubmitButton variant="destructive" pendingLabel="Cancelling…">
              Cancel appointment
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Review ───────────────────────────────────────────────────────── */

function ReviewDialog({ bookingId, serviceName }: { bookingId: string; serviceName: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [state, formAction] = useActionState(submitReviewAction, INITIAL);

  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="accent">
          <Star className="size-4" />
          Leave a review
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>How was your {serviceName} appointment?</DialogTitle>
          <DialogDescription>
            Your review is checked by our team before it appears publicly.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="rating" value={rating} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <fieldset>
            <legend className="text-sm font-medium text-navy-800">
              Your rating <span className="text-destructive">*</span>
            </legend>
            <div className="mt-2 flex gap-1" onMouseLeave={() => setHovered(0)}>
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRating(value)}
                  onMouseEnter={() => setHovered(value)}
                  aria-label={`${value} star${value > 1 ? 's' : ''}`}
                  aria-pressed={rating === value}
                  className="rounded p-1 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Star
                    className={cn(
                      'size-7 transition-colors',
                      value <= (hovered || rating)
                        ? 'fill-amber-400 text-amber-400'
                        : 'text-slate-300',
                    )}
                  />
                </button>
              ))}
            </div>
            {state.fieldErrors?.rating?.[0] && (
              <p role="alert" className="mt-1 text-xs font-medium text-destructive">
                {state.fieldErrors.rating[0]}
              </p>
            )}
          </fieldset>

          <Field label="Your review" required error={state.fieldErrors?.comment?.[0]}>
            <Textarea
              name="comment"
              rows={4}
              placeholder="What went well? What could we have done better?"
              required
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Not now
            </Button>
            <SubmitButton disabled={rating === 0} pendingLabel="Submitting…">
              Submit review
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
