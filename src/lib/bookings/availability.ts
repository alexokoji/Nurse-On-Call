import 'server-only';
import { connectDB } from '@/lib/db/connect';
import { Booking, BlockedSchedule, Availability, StaffProfile, Service } from '@/models';
import { getSettings } from '@/lib/settings';
import { timeToMinutes, fromDateKey, toDateKey } from '@/lib/utils';
import type { LocationType, TimeSlot } from '@/types';
import {
  computeSlots,
  workingDayToIntervals,
  weekdayForDateKey,
  type Interval,
  type StaffWindow,
} from './availability-core';

/**
 * Availability is computed on the server from five inputs, in this order:
 *
 *   1. the service (duration, buffer, which staff are cleared to deliver it)
 *   2. each staff member's recurring working hours, minus breaks
 *   3. one-off availability overrides for the date
 *   4. blocked time — leave, holidays, training (staff-specific or org-wide)
 *   5. live bookings already holding a slot
 *
 * Nothing here trusts the client. The same function backs both the public
 * slot picker and the final pre-write conflict check, so what a patient sees
 * and what the server enforces can never diverge.
 */

/** Statuses that still hold a slot. Cancelled/expired free it again. */
export const LIVE_BOOKING_STATUSES = ['pending_payment', 'confirmed', 'in_progress'] as const;

export interface AvailabilityResult {
  dateKey: string;
  slots: TimeSlot[];
  /** Present when the whole day is unbookable, for a helpful empty state. */
  unavailableReason?: string;
}

export async function getAvailability(params: {
  serviceId: string;
  dateKey: string;
  locationType: LocationType;
  /** Restrict to one staff member (admin reschedule flows). */
  staffId?: string;
}): Promise<AvailabilityResult> {
  const { serviceId, dateKey, locationType, staffId } = params;

  await connectDB();
  const bookingSettings = await getSettings('booking');

  const service = await Service.findById(serviceId).lean();
  if (!service) {
    return { dateKey, slots: [], unavailableReason: 'This service is no longer available.' };
  }
  if (service.status !== 'published') {
    return { dateKey, slots: [], unavailableReason: 'This service is not currently bookable.' };
  }
  if (!serviceSupportsLocation(service.serviceType, locationType)) {
    return {
      dateKey,
      slots: [],
      unavailableReason: 'This service is not offered at the selected location.',
    };
  }

  /* ── Date-window rules ─────────────────────────────────────────── */

  const requested = fromDateKey(dateKey);
  const todayKey = toDateKey(new Date());

  if (dateKey < todayKey) {
    return { dateKey, slots: [], unavailableReason: 'That date has already passed.' };
  }
  if (dateKey === todayKey && !bookingSettings.allowSameDayBooking) {
    return { dateKey, slots: [], unavailableReason: 'Same-day booking is not available.' };
  }

  const maxDate = new Date();
  maxDate.setDate(maxDate.getDate() + bookingSettings.maximumAdvanceDays);
  if (requested > maxDate) {
    return {
      dateKey,
      slots: [],
      unavailableReason: `Bookings open ${bookingSettings.maximumAdvanceDays} days in advance.`,
    };
  }

  /* ── Organisation-wide blocks (public holidays) ────────────────── */

  const orgBlocks = await BlockedSchedule.find({
    staff: null,
    approved: true,
    startDateKey: { $lte: dateKey },
    endDateKey: { $gte: dateKey },
  }).lean();

  const fullDayOrgBlock = orgBlocks.find((block) => !block.startTime || !block.endTime);
  if (fullDayOrgBlock) {
    return {
      dateKey,
      slots: [],
      unavailableReason: fullDayOrgBlock.reason || 'We are closed on this date.',
    };
  }

  /* ── Eligible staff ────────────────────────────────────────────── */

  const staffFilter: Record<string, unknown> = { isActive: true, services: service._id };
  if (staffId) staffFilter._id = staffId;

  const staffMembers = await StaffProfile.find(staffFilter)
    .select('_id workingHours maxConcurrentAppointments')
    .lean();

  if (staffMembers.length === 0) {
    return {
      dateKey,
      slots: [],
      unavailableReason: 'No care professional is assigned to this service yet.',
    };
  }

  const staffIds = staffMembers.map((member) => member._id);
  const weekday = weekdayForDateKey(dateKey);

  /* ── Per-staff blocks, overrides and existing bookings ─────────── */

  const [staffBlocks, overrides, existingBookings] = await Promise.all([
    BlockedSchedule.find({
      staff: { $in: staffIds },
      approved: true,
      startDateKey: { $lte: dateKey },
      endDateKey: { $gte: dateKey },
    }).lean(),

    Availability.find({ staff: { $in: staffIds }, dateKey }).lean(),

    Booking.find({
      staff: { $in: staffIds },
      dateKey,
      status: { $in: LIVE_BOOKING_STATUSES },
    })
      .select('staff startTime endTime snapshot.bufferMinutes')
      .lean(),
  ]);

  /* Org-wide partial blocks apply to everyone. */
  const orgHoles: Interval[] = orgBlocks
    .filter((block) => block.startTime && block.endTime)
    .map((block) => ({
      start: timeToMinutes(block.startTime!),
      end: timeToMinutes(block.endTime!),
    }));

  const windows: StaffWindow[] = staffMembers.map((member) => {
    const memberId = String(member._id);

    /* Free time: an override for the date replaces the recurring hours. */
    const memberOverrides = overrides.filter((o) => String(o.staff) === memberId);
    let free: Interval[];

    if (memberOverrides.length > 0) {
      free = memberOverrides.map((o) => ({
        start: timeToMinutes(o.start),
        end: timeToMinutes(o.end),
      }));
    } else {
      const workingDay = member.workingHours?.find((day) => day.day === weekday);
      free = workingDay?.enabled ? workingDayToIntervals(workingDay) : [];
    }

    /* Busy time: blocked windows + existing bookings, each incl. its buffer. */
    const busy: Interval[] = [...orgHoles];

    for (const block of staffBlocks) {
      if (String(block.staff) !== memberId) continue;
      if (!block.startTime || !block.endTime) {
        // Whole-day leave: no free time at all for this person.
        free = [];
        break;
      }
      busy.push({ start: timeToMinutes(block.startTime), end: timeToMinutes(block.endTime) });
    }

    for (const booking of existingBookings) {
      if (String(booking.staff) !== memberId) continue;
      busy.push({
        start: timeToMinutes(booking.startTime),
        end: timeToMinutes(booking.endTime) + (booking.snapshot?.bufferMinutes ?? 0),
      });
    }

    return {
      staffId: memberId,
      free,
      busy,
      capacity: member.maxConcurrentAppointments ?? 1,
    };
  });

  /* ── Minimum-notice floor ──────────────────────────────────────── */

  const earliestStart = minimumNoticeFloor(dateKey, bookingSettings.minimumNoticeHours);

  const slots = computeSlots(windows, {
    durationMinutes: service.durationMinutes,
    bufferMinutes: service.bufferMinutes ?? 0,
    intervalMinutes: bookingSettings.slotIntervalMinutes,
    earliestStart,
  });

  if (slots.length === 0) {
    return {
      dateKey,
      slots: [],
      unavailableReason: 'No appointments are offered on this date. Please choose another day.',
    };
  }

  return { dateKey, slots };
}

/**
 * Earliest bookable minute-of-day for a date, given the notice requirement.
 * Returns -Infinity for dates far enough ahead that notice cannot bind.
 */
export function minimumNoticeFloor(dateKey: string, noticeHours: number): number {
  const earliest = new Date(Date.now() + noticeHours * 60 * 60 * 1000);
  const earliestKey = toDateKey(earliest);

  if (dateKey > earliestKey) return Number.NEGATIVE_INFINITY;
  // The whole requested day is inside the notice window.
  if (dateKey < earliestKey) return Number.POSITIVE_INFINITY;
  return earliest.getHours() * 60 + earliest.getMinutes();
}

export function serviceSupportsLocation(serviceType: string, location: LocationType): boolean {
  if (serviceType === 'hybrid') return location === 'clinic' || location === 'home';
  return serviceType === location;
}

/** Location options a service actually offers, for the booking wizard. */
export function locationsForService(serviceType: string): LocationType[] {
  switch (serviceType) {
    case 'hybrid':
      return ['clinic', 'home'];
    case 'clinic':
      return ['clinic'];
    case 'home':
      return ['home'];
    case 'virtual':
      return ['virtual'];
    default:
      return [];
  }
}

/**
 * Authoritative pre-write check.
 *
 * Called inside booking creation *after* validation and immediately before
 * the insert. Returns the staff member to assign, or a reason to reject.
 * The unique partial index on Booking is the last line of defence if two
 * requests clear this check simultaneously.
 */
export async function resolveSlotStaff(params: {
  serviceId: string;
  dateKey: string;
  startTime: string;
  locationType: LocationType;
  preferredStaffId?: string | null;
}): Promise<{ ok: true; staffId: string } | { ok: false; reason: string }> {
  const availability = await getAvailability({
    serviceId: params.serviceId,
    dateKey: params.dateKey,
    locationType: params.locationType,
    staffId: params.preferredStaffId ?? undefined,
  });

  if (availability.unavailableReason) {
    return { ok: false, reason: availability.unavailableReason };
  }

  const slot = availability.slots.find((s) => s.start === params.startTime);
  if (!slot) {
    return { ok: false, reason: 'That time is not offered for this service.' };
  }
  if (!slot.available || slot.staffIds.length === 0) {
    return { ok: false, reason: 'That time has just been taken. Please choose another slot.' };
  }

  if (params.preferredStaffId) {
    if (!slot.staffIds.includes(params.preferredStaffId)) {
      return { ok: false, reason: 'The selected care professional is not free at that time.' };
    }
    return { ok: true, staffId: params.preferredStaffId };
  }

  // Balance load by preferring the staff member with the fewest bookings that day.
  const staffId = await leastLoadedStaff(slot.staffIds, params.dateKey);
  return { ok: true, staffId };
}

async function leastLoadedStaff(staffIds: string[], dateKey: string): Promise<string> {
  if (staffIds.length === 1) return staffIds[0];

  const counts = await Booking.aggregate<{ _id: unknown; count: number }>([
    {
      $match: {
        dateKey,
        status: { $in: [...LIVE_BOOKING_STATUSES] },
      },
    },
    { $group: { _id: '$staff', count: { $sum: 1 } } },
  ]);

  const loadByStaff = new Map(counts.map((row) => [String(row._id), row.count]));

  return staffIds.reduce((best, current) =>
    (loadByStaff.get(current) ?? 0) < (loadByStaff.get(best) ?? 0) ? current : best,
  );
}
