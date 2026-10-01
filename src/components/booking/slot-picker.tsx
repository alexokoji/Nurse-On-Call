'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Alert } from '@/components/ui/feedback';
import { cn, formatTimeLabel } from '@/lib/utils';
import type { LocationType, TimeSlot } from '@/types';

/**
 * Fetches and renders the slot grid for one date.
 *
 * Availability always comes from `/api/availability` — never computed on the
 * client — so what the patient can click is exactly what the server will
 * accept. Taken slots are rendered greyed rather than hidden, which reads as
 * an honest calendar instead of a suspiciously short list.
 */
export function SlotPicker({
  serviceId,
  dateKey,
  locationType,
  selected,
  onSelect,
  onEmpty,
}: {
  serviceId: string;
  dateKey: string;
  locationType: LocationType;
  selected: string | null;
  onSelect: (slot: TimeSlot) => void;
  /** Called when the day yields nothing bookable, so the parent can react. */
  onEmpty?: (reason: string) => void;
}) {
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);

  /* Identifies one availability request. When it changes, the previous day's
     slots are cleared during render rather than in an effect — that way the
     stale grid is never painted for a frame before the spinner appears. */
  const requestKey = `${serviceId}|${dateKey}|${locationType}`;
  const [lastRequest, setLastRequest] = useState(requestKey);

  if (requestKey !== lastRequest) {
    setLastRequest(requestKey);
    setLoading(true);
    setMessage(null);
    setSlots([]);
  }

  // Parents usually pass an inline arrow for onEmpty; holding it in a ref
  // keeps it out of the fetch's dependencies so a re-render cannot refetch.
  const onEmptyRef = useRef(onEmpty);
  useEffect(() => {
    onEmptyRef.current = onEmpty;
  });

  /**
   * Fetching remote data is the case effects exist for, so this one stays an
   * effect. `ignore` discards a response that arrives after the patient has
   * already moved to another date — otherwise a slow request for Monday
   * could overwrite the slots being shown for Tuesday.
   */
  useEffect(() => {
    let ignore = false;

    (async () => {
      try {
        const params = new URLSearchParams({ serviceId, dateKey, locationType });
        const response = await fetch(`/api/availability?${params}`, { cache: 'no-store' });
        const payload = await response.json();
        if (ignore) return;

        if (!response.ok) {
          const reason = payload.error ?? 'We could not load availability for that date.';
          setMessage(reason);
          onEmptyRef.current?.(reason);
          return;
        }

        setSlots(payload.slots ?? []);

        if (payload.unavailableReason) {
          setMessage(payload.unavailableReason);
          onEmptyRef.current?.(payload.unavailableReason);
        }
      } catch {
        if (ignore) return;
        const reason = 'We could not reach the availability service. Please try again.';
        setMessage(reason);
        onEmptyRef.current?.(reason);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();

    return () => {
      ignore = true;
    };
  }, [serviceId, dateKey, locationType]);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3 py-10" role="status">
        <Loader2 className="size-6 animate-spin text-primary" aria-hidden />
        <p className="text-sm text-muted-foreground">Checking live availability…</p>
      </div>
    );
  }

  if (message) {
    return (
      <Alert variant="warning" title="Nothing available">
        {message}
      </Alert>
    );
  }

  const available = slots.filter((slot) => slot.available);

  return (
    <div>
      <p className="text-sm text-muted-foreground" aria-live="polite">
        {available.length} of {slots.length} slots are free.
        {available.length === 0 && ' Please choose another date.'}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
        {slots.map((slot) => (
          <button
            key={slot.start}
            type="button"
            disabled={!slot.available}
            onClick={() => onSelect(slot)}
            aria-pressed={selected === slot.start}
            className={cn(
              'rounded-lg border px-2 py-2.5 text-sm font-medium transition-all',
              !slot.available &&
                'cursor-not-allowed border-border bg-secondary/60 text-slate-400 line-through',
              slot.available &&
                selected !== slot.start &&
                'border-border text-navy-800 hover:border-brand-300 hover:bg-brand-50',
              selected === slot.start && 'border-primary bg-primary text-primary-foreground',
            )}
          >
            {formatTimeLabel(slot.start)}
          </button>
        ))}
      </div>
    </div>
  );
}
