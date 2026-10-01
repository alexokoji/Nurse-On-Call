import { timeToMinutes, minutesToTime } from '@/lib/utils';
import type { Weekday } from '@/types';

/**
 * Pure slot arithmetic — no database, no clock, no I/O.
 *
 * Everything here works in "minutes since local midnight", which sidesteps
 * timezone and DST arithmetic entirely. The caller converts to UTC instants
 * exactly once, at persistence time.
 *
 * Keeping this pure is what makes the double-booking rules unit-testable
 * (see tests/availability.test.ts).
 */

export interface Interval {
  start: number;
  end: number;
}

export interface StaffWindow {
  staffId: string;
  /** Working windows for the day, already break-adjusted. */
  free: Interval[];
  /** Slots the staff member is already committed to, incl. buffers. */
  busy: Interval[];
  /** How many appointments this person can hold at the same instant. */
  capacity: number;
}

export interface SlotOptions {
  /** Appointment length in minutes. */
  durationMinutes: number;
  /** Travel/clean-up reserved after each appointment. */
  bufferMinutes: number;
  /** Gap between candidate slot starts, e.g. 30. */
  intervalMinutes: number;
  /**
   * Earliest bookable minute-of-day, already accounting for the minimum
   * notice rule. Use -Infinity when the day is entirely in the future.
   */
  earliestStart?: number;
}

export interface ComputedSlot {
  start: string;
  end: string;
  available: boolean;
  staffIds: string[];
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export function contains(outer: Interval, inner: Interval): boolean {
  return inner.start >= outer.start && inner.end <= outer.end;
}

/** Merge overlapping/adjacent intervals into a minimal sorted set. */
export function mergeIntervals(intervals: Interval[]): Interval[] {
  if (intervals.length === 0) return [];
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: Interval[] = [{ ...sorted[0] }];

  for (const current of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (current.start <= last.end) {
      last.end = Math.max(last.end, current.end);
    } else {
      merged.push({ ...current });
    }
  }
  return merged;
}

/** Remove `holes` from `base`, returning the remaining open intervals. */
export function subtractIntervals(base: Interval[], holes: Interval[]): Interval[] {
  const merged = mergeIntervals(holes);
  let result = [...base];

  for (const hole of merged) {
    const next: Interval[] = [];
    for (const window of result) {
      if (!overlaps(window, hole)) {
        next.push(window);
        continue;
      }
      if (window.start < hole.start) next.push({ start: window.start, end: hole.start });
      if (hole.end < window.end) next.push({ start: hole.end, end: window.end });
    }
    result = next;
  }

  return result.filter((interval) => interval.end > interval.start);
}

/**
 * Split a working day into free intervals, removing the lunch/break window.
 * `breakStart`/`breakEnd` are optional and ignored when incomplete.
 */
export function workingDayToIntervals(day: {
  start: string;
  end: string;
  breakStart?: string | null;
  breakEnd?: string | null;
}): Interval[] {
  const base: Interval = { start: timeToMinutes(day.start), end: timeToMinutes(day.end) };
  if (base.end <= base.start) return [];

  if (day.breakStart && day.breakEnd) {
    const brk: Interval = {
      start: timeToMinutes(day.breakStart),
      end: timeToMinutes(day.breakEnd),
    };
    if (brk.end > brk.start) return subtractIntervals([base], [brk]);
  }

  return [base];
}

/**
 * Candidate slot starts across the union of all staff working windows.
 * Slots are aligned to `intervalMinutes` past the hour so the grid the
 * patient sees is stable regardless of which staff member is free.
 */
export function candidateStarts(
  windows: Interval[],
  { durationMinutes, bufferMinutes, intervalMinutes, earliestStart }: SlotOptions,
): number[] {
  const occupied = durationMinutes + bufferMinutes;
  const floor = earliestStart ?? Number.NEGATIVE_INFINITY;
  const starts = new Set<number>();

  for (const window of mergeIntervals(windows)) {
    // Align the first candidate up to the interval grid.
    const first = Math.ceil(window.start / intervalMinutes) * intervalMinutes;
    for (let start = first; start + occupied <= window.end; start += intervalMinutes) {
      if (start >= floor) starts.add(start);
    }
  }

  return [...starts].sort((a, b) => a - b);
}

/**
 * Which staff members can take an appointment starting at `start`?
 *
 * A staff member qualifies when the whole occupied window (appointment +
 * buffer) sits inside one free interval and collides with fewer existing
 * commitments than their concurrency capacity.
 */
export function staffAvailableAt(
  start: number,
  staff: StaffWindow[],
  { durationMinutes, bufferMinutes }: Pick<SlotOptions, 'durationMinutes' | 'bufferMinutes'>,
): string[] {
  const occupied: Interval = { start, end: start + durationMinutes + bufferMinutes };

  return staff
    .filter((member) => {
      const fitsInShift = member.free.some((window) => contains(window, occupied));
      if (!fitsInShift) return false;

      const collisions = member.busy.filter((busy) => overlaps(busy, occupied)).length;
      return collisions < Math.max(1, member.capacity);
    })
    .map((member) => member.staffId);
}

/**
 * Build the day's slot grid.
 *
 * Unavailable slots are returned too (with `available: false`) so the UI can
 * render a full grid and grey out what is taken — patients read that as an
 * honest calendar rather than a suspiciously short list.
 */
export function computeSlots(staff: StaffWindow[], options: SlotOptions): ComputedSlot[] {
  if (staff.length === 0) return [];

  const allWindows = staff.flatMap((member) => member.free);
  const starts = candidateStarts(allWindows, options);

  return starts.map((start) => {
    const staffIds = staffAvailableAt(start, staff, options);
    return {
      start: minutesToTime(start),
      end: minutesToTime(start + options.durationMinutes),
      available: staffIds.length > 0,
      staffIds,
    };
  });
}

const WEEKDAY_ORDER: Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** Weekday key for a "YYYY-MM-DD" date, evaluated in local time. */
export function weekdayForDateKey(dateKey: string): Weekday {
  const [y, m, d] = dateKey.split('-').map(Number);
  return WEEKDAY_ORDER[new Date(y, m - 1, d).getDay()];
}
