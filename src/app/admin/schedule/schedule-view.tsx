'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { CalendarPlus, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { BlockTimeDialog } from './block-time-dialog';
import { Button } from '@/components/ui/button';
import { cn, formatTimeLabel, fromDateKey, toDateKey } from '@/lib/utils';
import { LABELS, type BookingStatus } from '@/types';

/**
 * Day / week / month schedule.
 *
 * The view, the anchor date and the staff filter all live in the URL, so a
 * particular week for a particular nurse is a shareable link — which is how
 * schedules actually get discussed between coordinators.
 */

interface ScheduleEvent {
  id: string;
  reference: string;
  title: string;
  patientName: string;
  staffId: string | null;
  staffName: string;
  dateKey: string;
  startTime: string;
  endTime: string;
  status: BookingStatus;
  locationType: string;
}

interface ScheduleBlock {
  id: string;
  staffId: string | null;
  type: string;
  startDateKey: string;
  endDateKey: string;
  startTime: string | null;
  endTime: string | null;
  reason: string;
}

const STATUS_TONE: Record<BookingStatus, string> = {
  pending_payment: 'border-l-amber-400 bg-amber-50 text-amber-900',
  confirmed: 'border-l-emerald-500 bg-emerald-50 text-emerald-900',
  in_progress: 'border-l-blue-500 bg-blue-50 text-blue-900',
  completed: 'border-l-brand-500 bg-brand-50 text-brand-900',
  cancelled: 'border-l-red-400 bg-red-50 text-red-900',
  no_show: 'border-l-slate-400 bg-slate-50 text-slate-700',
  expired: 'border-l-slate-400 bg-slate-50 text-slate-700',
};

export function ScheduleView({
  view,
  anchorDate,
  staff,
  selectedStaffId,
  events,
  blocks,
}: {
  view: 'day' | 'week' | 'month';
  anchorDate: string;
  staff: { id: string; name: string; title: string }[];
  selectedStaffId: string | null;
  events: ScheduleEvent[];
  blocks: ScheduleBlock[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [blockOpen, setBlockOpen] = useState(false);

  const anchor = fromDateKey(anchorDate);

  const navigate = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(changes)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const shift = (direction: -1 | 1) => {
    const next =
      view === 'day'
        ? addDays(anchor, direction)
        : view === 'week'
          ? addDays(anchor, direction * 7)
          : direction === 1
            ? addMonths(anchor, 1)
            : subMonths(anchor, 1);
    navigate({ date: toDateKey(next) });
  };

  const heading =
    view === 'day'
      ? format(anchor, 'EEEE, d MMMM yyyy')
      : view === 'week'
        ? `${format(startOfWeek(anchor), 'd MMM')} – ${format(addDays(startOfWeek(anchor), 6), 'd MMM yyyy')}`
        : format(anchor, 'MMMM yyyy');

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card lg:flex-row lg:items-center">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon-sm" onClick={() => shift(-1)} aria-label="Previous">
            <ChevronLeft className="size-4" />
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => shift(1)} aria-label="Next">
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate({ date: toDateKey(new Date()) })}>
            Today
          </Button>
          <p className="ml-2 text-sm font-semibold text-navy-800" aria-live="polite">
            {heading}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <select
            value={selectedStaffId ?? 'all'}
            onChange={(event) =>
              navigate({ staffId: event.target.value === 'all' ? null : event.target.value })
            }
            aria-label="Filter by staff member"
            className="h-9 rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="all">All staff</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>

          <div className="flex rounded-lg bg-secondary p-0.5">
            {(['day', 'week', 'month'] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => navigate({ view: option })}
                aria-pressed={view === option}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors',
                  view === option
                    ? 'bg-background text-navy-800 shadow-sm'
                    : 'text-muted-foreground hover:text-navy-800',
                )}
              >
                {option}
              </button>
            ))}
          </div>

          <Button variant="outline" size="sm" onClick={() => setBlockOpen(true)}>
            <Plus className="size-3.5" />
            Block time
          </Button>

          <Button asChild size="sm">
            <Link href="/admin/appointments/new">
              <CalendarPlus className="size-3.5" />
              New appointment
            </Link>
          </Button>
        </div>
      </div>

      {view === 'month' ? (
        <MonthGrid anchor={anchor} events={events} blocks={blocks} onPickDay={(dateKey) => navigate({ date: dateKey, view: 'day' })} />
      ) : (
        <DayColumns
          days={
            view === 'day'
              ? [anchor]
              : eachDayOfInterval({ start: startOfWeek(anchor), end: addDays(startOfWeek(anchor), 6) })
          }
          events={events}
          blocks={blocks}
        />
      )}

      <Legend />

      <BlockTimeDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        staff={staff}
        defaultStaffId={selectedStaffId}
        defaultDateKey={anchorDate}
      />
    </div>
  );
}

/* ── Day / week columns ───────────────────────────────────────────── */

function DayColumns({
  days,
  events,
  blocks,
}: {
  days: Date[];
  events: ScheduleEvent[];
  blocks: ScheduleBlock[];
}) {
  return (
    <div className="overflow-x-auto scrollbar-thin">
      <div
        className="grid min-w-[52rem] gap-3"
        style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
      >
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const dayEvents = events
            .filter((event) => event.dateKey === dateKey)
            .sort((a, b) => a.startTime.localeCompare(b.startTime));

          const dayBlocks = blocks.filter(
            (block) => block.startDateKey <= dateKey && block.endDateKey >= dateKey,
          );

          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={dateKey}
              className={cn(
                'rounded-xl border bg-card shadow-card',
                isToday ? 'border-brand-300' : 'border-border',
              )}
            >
              <div
                className={cn(
                  'border-b px-3 py-2.5',
                  isToday ? 'border-brand-200 bg-brand-50/60' : 'border-border',
                )}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {format(day, 'EEE')}
                </p>
                <p
                  className={cn(
                    'font-display text-lg font-bold',
                    isToday ? 'text-primary' : 'text-navy-800',
                  )}
                >
                  {format(day, 'd MMM')}
                </p>
              </div>

              <div className="space-y-2 p-3">
                {dayBlocks.map((block) => (
                  <div
                    key={`${block.id}-${dateKey}`}
                    className="rounded-lg border-l-4 border-l-slate-400 bg-slate-50 px-2.5 py-2"
                  >
                    <p className="text-xs font-semibold capitalize text-slate-700">
                      {block.type}
                      {!block.staffId && ' (whole clinic)'}
                    </p>
                    <p className="text-[11px] text-slate-600">
                      {block.startTime && block.endTime
                        ? `${formatTimeLabel(block.startTime)}–${formatTimeLabel(block.endTime)}`
                        : 'All day'}
                      {block.reason && ` · ${block.reason}`}
                    </p>
                  </div>
                ))}

                {dayEvents.length === 0 && dayBlocks.length === 0 && (
                  <p className="py-6 text-center text-xs text-muted-foreground">Nothing booked</p>
                )}

                {dayEvents.map((event) => (
                  <Link
                    key={event.id}
                    href={`/admin/appointments/${event.id}`}
                    className={cn(
                      'block rounded-lg border-l-4 px-2.5 py-2 transition-opacity hover:opacity-80',
                      STATUS_TONE[event.status],
                    )}
                  >
                    <p className="text-[11px] font-semibold">
                      {formatTimeLabel(event.startTime)} – {formatTimeLabel(event.endTime)}
                    </p>
                    <p className="mt-0.5 truncate text-xs font-medium">{event.patientName}</p>
                    <p className="truncate text-[11px] opacity-80">{event.title}</p>
                    <p className="mt-1 truncate text-[11px] opacity-70">
                      {event.staffName} ·{' '}
                      {LABELS.locationType[event.locationType as keyof typeof LABELS.locationType]}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Month grid ───────────────────────────────────────────────────── */

function MonthGrid({
  anchor,
  events,
  blocks,
  onPickDay,
}: {
  anchor: Date;
  events: ScheduleEvent[];
  blocks: ScheduleBlock[];
  onPickDay: (dateKey: string) => void;
}) {
  const gridStart = startOfWeek(startOfMonth(anchor));
  const gridEnd = addDays(startOfWeek(endOfMonth(anchor)), 6);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
      <div className="grid grid-cols-7 border-b border-border">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div
            key={day}
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((day) => {
          const dateKey = toDateKey(day);
          const dayEvents = events.filter((event) => event.dateKey === dateKey);
          const blocked = blocks.some(
            (block) => block.startDateKey <= dateKey && block.endDateKey >= dateKey,
          );
          const inMonth = isSameMonth(day, anchor);
          const isToday = isSameDay(day, new Date());

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => onPickDay(dateKey)}
              className={cn(
                'min-h-[6.5rem] border-b border-r border-border p-2 text-left transition-colors hover:bg-secondary/50',
                !inMonth && 'bg-secondary/30',
              )}
            >
              <span
                className={cn(
                  'inline-flex size-6 items-center justify-center rounded-full text-xs font-medium',
                  isToday && 'bg-primary text-primary-foreground',
                  !isToday && inMonth && 'text-navy-800',
                  !inMonth && 'text-slate-400',
                )}
              >
                {day.getDate()}
              </span>

              {blocked && (
                <span className="mt-1 block truncate rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-700">
                  Blocked
                </span>
              )}

              <span className="mt-1 block space-y-0.5">
                {dayEvents.slice(0, 2).map((event) => (
                  <span
                    key={event.id}
                    className={cn(
                      'block truncate rounded px-1.5 py-0.5 text-[10px] font-medium',
                      STATUS_TONE[event.status],
                    )}
                  >
                    {formatTimeLabel(event.startTime)} {event.patientName}
                  </span>
                ))}
                {dayEvents.length > 2 && (
                  <span className="block px-1.5 text-[10px] text-muted-foreground">
                    +{dayEvents.length - 2} more
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {(
        [
          ['confirmed', 'Confirmed'],
          ['pending_payment', 'Awaiting payment'],
          ['in_progress', 'In progress'],
          ['completed', 'Completed'],
          ['cancelled', 'Cancelled'],
        ] as const
      ).map(([status, label]) => (
        <span key={status} className="flex items-center gap-1.5">
          <span
            className={cn('size-2.5 rounded-sm border-l-4', STATUS_TONE[status])}
            aria-hidden
          />
          {label}
        </span>
      ))}
    </div>
  );
}
