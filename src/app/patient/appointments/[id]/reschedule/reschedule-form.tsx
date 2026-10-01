'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { BookingDatePicker } from '@/components/booking/date-picker';
import { SlotPicker } from '@/components/booking/slot-picker';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/feedback';
import { formatTimeLabel } from '@/lib/utils';
import { rescheduleBookingAction } from '@/app/patient/actions';
import type { ActionResult, LocationType, TimeSlot } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

export function RescheduleForm({
  bookingId,
  serviceId,
  locationType,
  currentDateKey,
  maximumAdvanceDays,
}: {
  bookingId: string;
  serviceId: string;
  locationType: string;
  currentDateKey: string;
  maximumAdvanceDays: number;
}) {
  const router = useRouter();
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  const [state, formAction] = useActionState(rescheduleBookingAction, INITIAL);

  useActionFeedback(state, {
    onSuccess: () => router.push(`/patient/appointments/${bookingId}`),
  });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="dateKey" value={dateKey ?? ''} />
      <input type="hidden" name="startTime" value={slot?.start ?? ''} />

      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <section className="rounded-xl border border-border bg-card p-6 shadow-card">
        <h2 className="text-sm font-semibold text-navy-800">1. Pick a new date</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Currently booked for {format(new Date(currentDateKey), 'EEEE, d MMMM yyyy')}.
        </p>

        <div className="mt-4">
          <BookingDatePicker
            selected={dateKey}
            maximumAdvanceDays={maximumAdvanceDays}
            onSelect={(chosen) => {
              setDateKey(chosen);
              // A date change invalidates any previously chosen time.
              setSlot(null);
            }}
          />
        </div>
      </section>

      {dateKey && (
        <section className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-sm font-semibold text-navy-800">2. Pick a new time</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {format(new Date(dateKey), 'EEEE, d MMMM yyyy')}
          </p>

          <div className="mt-4">
            <SlotPicker
              serviceId={serviceId}
              dateKey={dateKey}
              locationType={locationType as LocationType}
              selected={slot?.start ?? null}
              onSelect={setSlot}
            />
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-6">
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/patient/appointments/${bookingId}`)}
        >
          Cancel
        </Button>

        <div className="flex items-center gap-4">
          {slot && dateKey && (
            <p className="text-sm text-muted-foreground">
              Moving to{' '}
              <span className="font-medium text-navy-800">
                {format(new Date(dateKey), 'd MMM')} at {formatTimeLabel(slot.start)}
              </span>
            </p>
          )}
          <SubmitButton disabled={!slot || !dateKey} pendingLabel="Rescheduling…">
            Confirm new time
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
