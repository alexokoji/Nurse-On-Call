'use client';

import { useMemo, useState } from 'react';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, toDateKey } from '@/lib/utils';

/**
 * Month calendar constrained to the bookable window.
 *
 * Shared by the booking wizard and the reschedule flow so both enforce the
 * same date rules and look identical.
 */
export function BookingDatePicker({
  selected,
  maximumAdvanceDays,
  onSelect,
}: {
  selected: string | null;
  maximumAdvanceDays: number;
  onSelect: (dateKey: string) => void;
}) {
  const today = startOfDay(new Date());
  const lastBookable = addDays(today, maximumAdvanceDays);
  const [month, setMonth] = useState(() =>
    startOfMonth(selected ? new Date(selected) : today),
  );

  const cells = useMemo(() => {
    const start = startOfMonth(month);
    const end = endOfMonth(month);
    const leading = start.getDay();
    const days: (Date | null)[] = Array.from({ length: leading }, () => null);
    for (let d = 1; d <= end.getDate(); d++) {
      days.push(new Date(month.getFullYear(), month.getMonth(), d));
    }
    return days;
  }, [month]);

  const canGoBack = isBefore(startOfMonth(today), month);
  const canGoForward = isBefore(month, startOfMonth(lastBookable));

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setMonth(subMonths(month, 1))}
          disabled={!canGoBack}
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </Button>
        <p className="text-sm font-semibold text-navy-800" aria-live="polite">
          {format(month, 'MMMM yyyy')}
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          onClick={() => setMonth(addMonths(month, 1))}
          disabled={!canGoForward}
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <abbr
            key={day}
            title={day}
            className="py-1 text-[11px] font-semibold text-muted-foreground no-underline"
          >
            {day[0]}
          </abbr>
        ))}

        {cells.map((day, index) => {
          if (!day) return <span key={`pad-${index}`} />;

          const key = toDateKey(day);
          const disabled = isBefore(day, today) || isBefore(lastBookable, day);
          const isSelected = selected === key;
          const isToday = isSameDay(day, today);

          return (
            <button
              key={key}
              type="button"
              disabled={disabled}
              onClick={() => onSelect(key)}
              aria-label={format(day, 'EEEE d MMMM yyyy')}
              aria-pressed={isSelected}
              className={cn(
                'flex aspect-square items-center justify-center rounded-lg text-sm font-medium transition-colors',
                disabled && 'cursor-not-allowed text-slate-300',
                !disabled && !isSelected && 'text-navy-800 hover:bg-secondary',
                isSelected && 'bg-primary text-primary-foreground',
                isToday && !isSelected && 'ring-1 ring-inset ring-brand-300',
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
