import { describe, it, expect } from 'vitest';
import {
  computeSlots,
  candidateStarts,
  mergeIntervals,
  subtractIntervals,
  staffAvailableAt,
  workingDayToIntervals,
  weekdayForDateKey,
  overlaps,
  contains,
  type StaffWindow,
} from '@/lib/bookings/availability-core';
import { minimumNoticeFloor, serviceSupportsLocation, locationsForService } from '@/lib/bookings/availability';
import { timeToMinutes, minutesToTime } from '@/lib/utils';

/**
 * The availability engine decides what a patient is allowed to book, so its
 * edge cases are worth pinning down precisely: an off-by-one here either
 * double-books a nurse or silently hides bookable time.
 */

const HOUR = (h: number, m = 0) => h * 60 + m;

describe('interval arithmetic', () => {
  it('merges overlapping and touching intervals', () => {
    expect(
      mergeIntervals([
        { start: 60, end: 120 },
        { start: 100, end: 180 },
        { start: 300, end: 360 },
      ]),
    ).toEqual([
      { start: 60, end: 180 },
      { start: 300, end: 360 },
    ]);
  });

  it('subtracts a hole from the middle of a window, leaving two pieces', () => {
    expect(subtractIntervals([{ start: 480, end: 1020 }], [{ start: 780, end: 840 }])).toEqual([
      { start: 480, end: 780 },
      { start: 840, end: 1020 },
    ]);
  });

  it('removes a window entirely when the hole covers it', () => {
    expect(subtractIntervals([{ start: 600, end: 660 }], [{ start: 540, end: 720 }])).toEqual([]);
  });

  it('treats touching intervals as non-overlapping', () => {
    // 09:00–10:00 and 10:00–11:00 must both be bookable.
    expect(overlaps({ start: 540, end: 600 }, { start: 600, end: 660 })).toBe(false);
  });

  it('requires full containment, not partial', () => {
    expect(contains({ start: 480, end: 600 }, { start: 500, end: 600 })).toBe(true);
    expect(contains({ start: 480, end: 600 }, { start: 500, end: 601 })).toBe(false);
  });
});

describe('working hours', () => {
  it('splits a shift around its break', () => {
    expect(
      workingDayToIntervals({
        start: '08:00',
        end: '17:00',
        breakStart: '13:00',
        breakEnd: '14:00',
      }),
    ).toEqual([
      { start: HOUR(8), end: HOUR(13) },
      { start: HOUR(14), end: HOUR(17) },
    ]);
  });

  it('ignores an incomplete break rather than corrupting the shift', () => {
    expect(workingDayToIntervals({ start: '09:00', end: '17:00', breakStart: '13:00' })).toEqual([
      { start: HOUR(9), end: HOUR(17) },
    ]);
  });

  it('returns nothing when the end is not after the start', () => {
    expect(workingDayToIntervals({ start: '17:00', end: '09:00' })).toEqual([]);
  });

  it('maps a date key to the right weekday', () => {
    // 2026-08-31 is a Monday.
    expect(weekdayForDateKey('2026-08-31')).toBe('monday');
    expect(weekdayForDateKey('2026-08-30')).toBe('sunday');
  });
});

describe('candidate slot generation', () => {
  const options = {
    durationMinutes: 60,
    bufferMinutes: 15,
    intervalMinutes: 30,
  };

  it('aligns starts to the interval grid', () => {
    const starts = candidateStarts([{ start: HOUR(8, 10), end: HOUR(12) }], options);
    // First candidate rounds up from 08:10 to 08:30.
    expect(minutesToTime(starts[0])).toBe('08:30');
  });

  it('leaves room for the appointment *and* its buffer', () => {
    // 09:00–10:30 fits one 60+15 appointment starting at 09:00 only.
    const starts = candidateStarts([{ start: HOUR(9), end: HOUR(10, 30) }], options);
    expect(starts.map(minutesToTime)).toEqual(['09:00']);
  });

  it('produces nothing when the window is shorter than duration + buffer', () => {
    expect(candidateStarts([{ start: HOUR(9), end: HOUR(10) }], options)).toEqual([]);
  });

  it('honours the minimum-notice floor', () => {
    const starts = candidateStarts([{ start: HOUR(8), end: HOUR(17) }], {
      ...options,
      earliestStart: HOUR(12),
    });
    expect(starts.every((start) => start >= HOUR(12))).toBe(true);
    expect(minutesToTime(starts[0])).toBe('12:00');
  });
});

describe('staff availability at a given time', () => {
  const options = { durationMinutes: 60, bufferMinutes: 15 };

  const nurse = (overrides: Partial<StaffWindow> = {}): StaffWindow => ({
    staffId: 'nurse-1',
    free: [{ start: HOUR(8), end: HOUR(17) }],
    busy: [],
    capacity: 1,
    ...overrides,
  });

  it('offers a free staff member', () => {
    expect(staffAvailableAt(HOUR(9), [nurse()], options)).toEqual(['nurse-1']);
  });

  it('refuses a staff member already booked at that time', () => {
    const busy = nurse({ busy: [{ start: HOUR(9), end: HOUR(10, 15) }] });
    expect(staffAvailableAt(HOUR(9), [busy], options)).toEqual([]);
  });

  it('refuses a slot that collides with the previous appointment’s buffer', () => {
    // 08:00 appointment runs to 09:00 and holds a buffer to 09:15,
    // so a 09:00 start must be rejected.
    const busy = nurse({ busy: [{ start: HOUR(8), end: HOUR(9, 15) }] });
    expect(staffAvailableAt(HOUR(9), [busy], options)).toEqual([]);
    // 09:30 is clear.
    expect(staffAvailableAt(HOUR(9, 30), [busy], options)).toEqual(['nurse-1']);
  });

  it('refuses a slot that runs past the end of the shift', () => {
    const shortShift = nurse({ free: [{ start: HOUR(8), end: HOUR(9, 30) }] });
    // 09:00 + 60 + 15 = 10:15, past the 09:30 finish.
    expect(staffAvailableAt(HOUR(9), [shortShift], options)).toEqual([]);
  });

  it('refuses a slot inside a break', () => {
    const withBreak = nurse({
      free: [
        { start: HOUR(8), end: HOUR(13) },
        { start: HOUR(14), end: HOUR(17) },
      ],
    });
    expect(staffAvailableAt(HOUR(13), [withBreak], options)).toEqual([]);
    expect(staffAvailableAt(HOUR(14), [withBreak], options)).toEqual(['nurse-1']);
  });

  it('allows concurrent bookings up to the staff member’s capacity', () => {
    const doubleBooked = nurse({
      capacity: 2,
      busy: [{ start: HOUR(9), end: HOUR(10, 15) }],
    });
    expect(staffAvailableAt(HOUR(9), [doubleBooked], options)).toEqual(['nurse-1']);

    const atCapacity = nurse({
      capacity: 2,
      busy: [
        { start: HOUR(9), end: HOUR(10, 15) },
        { start: HOUR(9), end: HOUR(10, 15) },
      ],
    });
    expect(staffAvailableAt(HOUR(9), [atCapacity], options)).toEqual([]);
  });

  it('returns every qualified staff member who is free', () => {
    const team = [
      nurse(),
      nurse({ staffId: 'nurse-2' }),
      nurse({ staffId: 'nurse-3', busy: [{ start: HOUR(9), end: HOUR(10) }] }),
    ];
    expect(staffAvailableAt(HOUR(9), team, options)).toEqual(['nurse-1', 'nurse-2']);
  });
});

describe('slot grid', () => {
  const options = { durationMinutes: 60, bufferMinutes: 15, intervalMinutes: 30 };

  it('returns an empty grid when nobody can deliver the service', () => {
    expect(computeSlots([], options)).toEqual([]);
  });

  it('marks taken slots unavailable rather than hiding them', () => {
    const staff: StaffWindow[] = [
      {
        staffId: 'nurse-1',
        free: [{ start: HOUR(9), end: HOUR(12) }],
        busy: [{ start: HOUR(10), end: HOUR(11, 15) }],
        capacity: 1,
      },
    ];

    const slots = computeSlots(staff, options);
    const byStart = Object.fromEntries(slots.map((slot) => [slot.start, slot.available]));

    expect(byStart['10:00']).toBe(false);
    // The grid still lists the taken slot — patients see an honest calendar
    // with times greyed out, not a suspiciously short list.
    expect(slots.some((slot) => slot.start === '10:00')).toBe(true);
    // 11:30 is clear again: 11:30 + 60 + 15 = 12:45… past the 12:00 finish,
    // so the last genuinely bookable start is 10:45 — which is still blocked.
    expect(byStart['11:30']).toBeUndefined();
  });

  it('blocks a slot whose buffer would run into an existing appointment', () => {
    // The buffer is travel/clean-up time, so it must reserve the space
    // *after* an appointment as firmly as the appointment itself.
    const staff: StaffWindow[] = [
      {
        staffId: 'nurse-1',
        free: [{ start: HOUR(9), end: HOUR(12) }],
        busy: [{ start: HOUR(10), end: HOUR(11) }],
        capacity: 1,
      },
    ];

    const byStart = Object.fromEntries(
      computeSlots(staff, options).map((slot) => [slot.start, slot.available]),
    );

    // 09:00 runs to 10:00 and holds its buffer to 10:15 — that overlaps the
    // 10:00 booking, so it must not be offered.
    expect(byStart['09:00']).toBe(false);
    // 08:45 would be clear, but the shift starts at 09:00, so the first
    // genuinely free start is after the existing appointment ends.
    expect(byStart['09:30']).toBe(false);
  });

  it('offers a slot once the previous appointment and its buffer have cleared', () => {
    const staff: StaffWindow[] = [
      {
        staffId: 'nurse-1',
        free: [{ start: HOUR(9), end: HOUR(14) }],
        busy: [{ start: HOUR(9), end: HOUR(10) }],
        capacity: 1,
      },
    ];

    const byStart = Object.fromEntries(
      computeSlots(staff, options).map((slot) => [slot.start, slot.available]),
    );

    expect(byStart['09:30']).toBe(false); // still inside the 09:00–10:00 booking
    expect(byStart['10:00']).toBe(true); // clear the moment it ends
  });

  it('keeps a slot open while any one staff member is still free', () => {
    const staff: StaffWindow[] = [
      {
        staffId: 'nurse-1',
        free: [{ start: HOUR(9), end: HOUR(12) }],
        busy: [{ start: HOUR(9), end: HOUR(10, 15) }],
        capacity: 1,
      },
      { staffId: 'nurse-2', free: [{ start: HOUR(9), end: HOUR(12) }], busy: [], capacity: 1 },
    ];

    const nine = computeSlots(staff, options).find((slot) => slot.start === '09:00');
    expect(nine?.available).toBe(true);
    expect(nine?.staffIds).toEqual(['nurse-2']);
  });

  it('reports the correct end time for each slot', () => {
    const staff: StaffWindow[] = [
      { staffId: 'nurse-1', free: [{ start: HOUR(9), end: HOUR(12) }], busy: [], capacity: 1 },
    ];
    const first = computeSlots(staff, options)[0];
    // The end shown to the patient is the appointment end, not end + buffer.
    expect(first.start).toBe('09:00');
    expect(first.end).toBe('10:00');
  });
});

describe('minimum notice', () => {
  it('does not restrict a date beyond the notice window', () => {
    const farFuture = new Date();
    farFuture.setDate(farFuture.getDate() + 10);
    const key = farFuture.toISOString().slice(0, 10);
    expect(minimumNoticeFloor(key, 4)).toBe(Number.NEGATIVE_INFINITY);
  });

  it('closes a date entirely when it falls before the notice window', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const y = yesterday.getFullYear();
    const m = String(yesterday.getMonth() + 1).padStart(2, '0');
    const d = String(yesterday.getDate()).padStart(2, '0');
    expect(minimumNoticeFloor(`${y}-${m}-${d}`, 4)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('service location rules', () => {
  it('matches a single-location service to its own location only', () => {
    expect(serviceSupportsLocation('home', 'home')).toBe(true);
    expect(serviceSupportsLocation('home', 'clinic')).toBe(false);
    expect(serviceSupportsLocation('virtual', 'home')).toBe(false);
  });

  it('lets a hybrid service be booked at the clinic or at home, but not virtually', () => {
    expect(serviceSupportsLocation('hybrid', 'clinic')).toBe(true);
    expect(serviceSupportsLocation('hybrid', 'home')).toBe(true);
    expect(serviceSupportsLocation('hybrid', 'virtual')).toBe(false);
  });

  it('offers the matching set of locations to the booking wizard', () => {
    expect(locationsForService('hybrid')).toEqual(['clinic', 'home']);
    expect(locationsForService('virtual')).toEqual(['virtual']);
    expect(locationsForService('nonsense')).toEqual([]);
  });
});

describe('time helpers', () => {
  it('round-trips between "HH:mm" and minutes', () => {
    for (const time of ['00:00', '08:30', '13:45', '23:59']) {
      expect(minutesToTime(timeToMinutes(time))).toBe(time);
    }
  });
});
