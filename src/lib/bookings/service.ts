import 'server-only';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/connect';
import {
  Booking,
  Payment,
  PatientProfile,
  Promotion,
  Service,
  User,
  nextReference,
  type IBooking,
} from '@/models';
import { getSettings } from '@/lib/settings';
import { fromDateKey, timeToMinutes, minutesToTime } from '@/lib/utils';
import { resolveSlotStaff, LIVE_BOOKING_STATUSES } from './availability';
import { calculatePrice, refundableAmount } from './pricing';
import { recordAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications/service';
import type { CreateBookingInput } from '@/lib/validations/booking';
import type { CurrentUser } from '@/lib/auth/current-user';

/**
 * Booking lifecycle operations.
 *
 * Every mutation here re-derives price and availability from the database.
 * Nothing the caller supplies about money, staff assignment or status is
 * trusted, and the write is protected by a unique partial index so a race
 * between two simultaneous requests fails loudly rather than double-booking.
 */

export class BookingError extends Error {
  constructor(
    message: string,
    public code:
      | 'SERVICE_UNAVAILABLE'
      | 'SLOT_TAKEN'
      | 'VALIDATION'
      | 'NOT_FOUND'
      | 'FORBIDDEN'
      | 'CONFLICT' = 'VALIDATION',
  ) {
    super(message);
    this.name = 'BookingError';
  }
}

export interface CreateBookingResult {
  booking: IBooking;
  /** Zero when a promotion covered the full amount — no payment needed. */
  amountDueKobo: number;
}

export async function createBooking(params: {
  input: CreateBookingInput;
  /** The account the booking belongs to. */
  patientUserId: string;
  /** Set when an admin books on a patient's behalf. */
  actor?: CurrentUser | null;
}): Promise<CreateBookingResult> {
  const { input, patientUserId, actor } = params;

  await connectDB();
  const bookingSettings = await getSettings('booking');

  const service = await Service.findById(input.serviceId).lean();
  if (!service) throw new BookingError('That service could not be found.', 'NOT_FOUND');
  if (service.status !== 'published') {
    throw new BookingError('That service is not currently bookable.', 'SERVICE_UNAVAILABLE');
  }

  /* Authoritative availability check — also picks the staff member. */
  const resolution = await resolveSlotStaff({
    serviceId: String(service._id),
    dateKey: input.dateKey,
    startTime: input.startTime,
    locationType: input.locationType,
    preferredStaffId: input.staffId ?? null,
  });

  if (!resolution.ok) throw new BookingError(resolution.reason, 'SLOT_TAKEN');

  /* Server-side pricing. */
  const price = await calculatePrice({
    service,
    locationType: input.locationType,
    promotionCode: input.promotionCode,
    patientId: patientUserId,
  });

  if (price.promotionError) {
    throw new BookingError(price.promotionError, 'VALIDATION');
  }

  const patientProfile = await PatientProfile.findOne({ user: patientUserId })
    .select('_id')
    .lean();

  const startMinutes = timeToMinutes(input.startTime);
  const endTime = minutesToTime(startMinutes + service.durationMinutes);
  const { startAt, endAt } = toInstants(input.dateKey, input.startTime, endTime);

  const reference = await nextReference('booking');

  const holdExpiresAt =
    price.totalKobo > 0
      ? new Date(Date.now() + bookingSettings.paymentHoldMinutes * 60 * 1000)
      : null;

  const doc = {
    reference,
    patient: patientUserId,
    patientProfile: patientProfile?._id ?? null,
    service: service._id,
    staff: resolution.staffId,

    snapshot: {
      serviceName: service.name,
      serviceSlug: service.slug,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes ?? 0,
    },

    dateKey: input.dateKey,
    startTime: input.startTime,
    endTime,
    startAt,
    endAt,

    locationType: input.locationType,
    address: input.locationType === 'home' ? input.address : undefined,

    contact: {
      name: input.contact.name,
      phone: input.contact.phone,
      email: input.contact.email,
      dateOfBirth: input.contact.dateOfBirth ? new Date(input.contact.dateOfBirth) : undefined,
      gender: input.contact.gender,
    },
    emergencyContact: input.emergencyContact,
    notes: input.notes,
    serviceAnswers: input.serviceAnswers,

    // A fully discounted booking needs no payment, so it confirms immediately.
    status: price.totalKobo > 0 ? ('pending_payment' as const) : ('confirmed' as const),

    servicePriceKobo: price.servicePriceKobo,
    surchargeKobo: price.surchargeKobo,
    discountKobo: price.discountKobo,
    totalKobo: price.totalKobo,
    promotionCode: price.promotionCode,

    isPaid: price.totalKobo === 0,
    paidAt: price.totalKobo === 0 ? new Date() : null,
    holdExpiresAt,

    createdBy: actor?.id ?? patientUserId,
  };

  /**
   * Claim the promotion use *before* writing the booking.
   *
   * The filter makes the increment conditional in a single atomic operation,
   * so two simultaneous bookings cannot push `usageCount` past `usageLimit`.
   * Checking and then incrementing separately would let both pass the check.
   */
  if (price.promotionCode) {
    const claimed = await claimPromotionUse(price.promotionCode);
    if (!claimed) {
      throw new BookingError('That promotion has just been fully claimed.', 'VALIDATION');
    }
  }

  let booking: IBooking;
  try {
    booking = await Booking.create(doc);
  } catch (error) {
    // The booking failed, so hand the promotion use back.
    if (price.promotionCode) await releasePromotionUse(price.promotionCode);

    // E11000 on uniq_staff_slot_live means another request won the race.
    if (isDuplicateKeyError(error)) {
      throw new BookingError(
        'That time was booked moments ago. Please choose another slot.',
        'SLOT_TAKEN',
      );
    }
    throw error;
  }

  await Service.updateOne({ _id: service._id }, { $inc: { bookingCount: 1 } });

  await recordAudit({
    actor: actor ?? null,
    action: 'booking.create',
    entity: 'Booking',
    entityId: String(booking._id),
    summary: `Booking ${reference} created for ${service.name} on ${input.dateKey} at ${input.startTime}`,
    after: { reference, status: booking.status, totalKobo: booking.totalKobo },
  });

  if (booking.status === 'confirmed') {
    await onBookingConfirmed(booking);
  }

  return { booking, amountDueKobo: price.totalKobo };
}

/**
 * Runs once a booking becomes confirmed — whether by payment verification or
 * a zero-value booking. Updates patient aggregates and sends the confirmation.
 */
export async function onBookingConfirmed(booking: IBooking) {
  await PatientProfile.updateOne(
    { user: booking.patient },
    {
      $inc: { totalAppointments: 1, totalSpentKobo: booking.totalKobo },
      $set: { lastAppointmentAt: booking.startAt },
    },
  );

  await notify({
    recipientId: String(booking.patient),
    template: 'booking_confirmation',
    channels: ['email', 'in_app'],
    data: {
      reference: booking.reference,
      serviceName: booking.snapshot.serviceName,
      dateKey: booking.dateKey,
      startTime: booking.startTime,
      totalKobo: booking.totalKobo,
    },
    link: `/patient/appointments/${booking._id}`,
    relatedBooking: String(booking._id),
  });
}

export async function cancelBooking(params: {
  bookingId: string;
  reason: string;
  actor: CurrentUser;
}): Promise<IBooking> {
  await connectDB();

  const booking = await Booking.findById(params.bookingId);
  if (!booking) throw new BookingError('Booking not found.', 'NOT_FOUND');

  // A patient may only cancel their own booking.
  if (params.actor.role === 'patient' && String(booking.patient) !== params.actor.id) {
    throw new BookingError('You do not have access to this booking.', 'FORBIDDEN');
  }

  if (['cancelled', 'completed', 'expired'].includes(booking.status)) {
    throw new BookingError(`This booking is already ${booking.status}.`, 'CONFLICT');
  }

  const before = { status: booking.status };

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancelledBy = new mongoose.Types.ObjectId(params.actor.id);
  booking.cancellationReason = params.reason;
  await booking.save();

  const bookingSettings = await getSettings('booking');
  const refundDue = booking.isPaid
    ? refundableAmount({
        paidKobo: booking.totalKobo,
        startAt: booking.startAt,
        cancellationWindowHours: bookingSettings.cancellationWindowHours,
      })
    : 0;

  await recordAudit({
    actor: params.actor,
    action: 'booking.cancel',
    entity: 'Booking',
    entityId: String(booking._id),
    summary: `Booking ${booking.reference} cancelled — ${params.reason}`,
    before,
    after: { status: 'cancelled', refundDueKobo: refundDue },
  });

  await notify({
    recipientId: String(booking.patient),
    template: 'cancellation',
    channels: ['email', 'in_app'],
    data: {
      reference: booking.reference,
      serviceName: booking.snapshot.serviceName,
      dateKey: booking.dateKey,
      startTime: booking.startTime,
      reason: params.reason,
      refundKobo: refundDue,
    },
    link: `/patient/appointments/${booking._id}`,
    relatedBooking: String(booking._id),
  });

  return booking;
}

export async function rescheduleBooking(params: {
  bookingId: string;
  dateKey: string;
  startTime: string;
  staffId?: string | null;
  reason?: string;
  actor: CurrentUser;
}): Promise<IBooking> {
  await connectDB();

  const booking = await Booking.findById(params.bookingId);
  if (!booking) throw new BookingError('Booking not found.', 'NOT_FOUND');

  if (params.actor.role === 'patient' && String(booking.patient) !== params.actor.id) {
    throw new BookingError('You do not have access to this booking.', 'FORBIDDEN');
  }
  if (!['pending_payment', 'confirmed'].includes(booking.status)) {
    throw new BookingError(`A ${booking.status} booking cannot be rescheduled.`, 'CONFLICT');
  }

  const resolution = await resolveSlotStaff({
    serviceId: String(booking.service),
    dateKey: params.dateKey,
    startTime: params.startTime,
    locationType: booking.locationType,
    preferredStaffId: params.staffId ?? null,
  });
  if (!resolution.ok) throw new BookingError(resolution.reason, 'SLOT_TAKEN');

  const before = {
    dateKey: booking.dateKey,
    startTime: booking.startTime,
    staff: String(booking.staff),
  };

  const endTime = minutesToTime(timeToMinutes(params.startTime) + booking.snapshot.durationMinutes);
  const { startAt, endAt } = toInstants(params.dateKey, params.startTime, endTime);

  booking.dateKey = params.dateKey;
  booking.startTime = params.startTime;
  booking.endTime = endTime;
  booking.startAt = startAt;
  booking.endAt = endAt;
  booking.staff = new mongoose.Types.ObjectId(resolution.staffId);
  // A rescheduled appointment needs a fresh reminder.
  booking.reminderSentAt = null;

  try {
    await booking.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new BookingError('That slot was taken moments ago.', 'SLOT_TAKEN');
    }
    throw error;
  }

  await recordAudit({
    actor: params.actor,
    action: 'booking.reschedule',
    entity: 'Booking',
    entityId: String(booking._id),
    summary: `Booking ${booking.reference} moved to ${params.dateKey} at ${params.startTime}`,
    before,
    after: { dateKey: params.dateKey, startTime: params.startTime, staff: resolution.staffId },
  });

  await notify({
    recipientId: String(booking.patient),
    template: 'reschedule',
    channels: ['email', 'in_app'],
    data: {
      reference: booking.reference,
      serviceName: booking.snapshot.serviceName,
      dateKey: params.dateKey,
      startTime: params.startTime,
      reason: params.reason ?? '',
    },
    link: `/patient/appointments/${booking._id}`,
    relatedBooking: String(booking._id),
  });

  return booking;
}

export async function assignStaff(params: {
  bookingId: string;
  staffId: string;
  actor: CurrentUser;
}): Promise<IBooking> {
  await connectDB();

  const booking = await Booking.findById(params.bookingId);
  if (!booking) throw new BookingError('Booking not found.', 'NOT_FOUND');

  /* The target must actually be free for this slot. */
  const clash = await Booking.findOne({
    _id: { $ne: booking._id },
    staff: params.staffId,
    dateKey: booking.dateKey,
    status: { $in: LIVE_BOOKING_STATUSES },
    startAt: { $lt: booking.endAt },
    endAt: { $gt: booking.startAt },
  }).lean();

  if (clash) {
    throw new BookingError(
      'That staff member already has an appointment overlapping this time.',
      'CONFLICT',
    );
  }

  const before = { staff: booking.staff ? String(booking.staff) : null };
  booking.staff = new mongoose.Types.ObjectId(params.staffId);

  try {
    await booking.save();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new BookingError('That staff member is already booked for this slot.', 'CONFLICT');
    }
    throw error;
  }

  await recordAudit({
    actor: params.actor,
    action: 'booking.assign_staff',
    entity: 'Booking',
    entityId: String(booking._id),
    summary: `Staff assigned to booking ${booking.reference}`,
    before,
    after: { staff: params.staffId },
  });

  await notify({
    recipientId: String(booking.patient),
    template: 'staff_assigned',
    channels: ['in_app'],
    data: { reference: booking.reference, serviceName: booking.snapshot.serviceName },
    link: `/patient/appointments/${booking._id}`,
    relatedBooking: String(booking._id),
  });

  return booking;
}

/** Legal status transitions. Anything not listed here is rejected. */
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending_payment: ['confirmed', 'cancelled', 'expired'],
  confirmed: ['in_progress', 'completed', 'cancelled', 'no_show'],
  in_progress: ['completed', 'cancelled'],
  completed: [],
  cancelled: [],
  no_show: [],
  expired: [],
};

export function canTransition(from: string, to: string): boolean {
  return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function updateBookingStatus(params: {
  bookingId: string;
  status: 'confirmed' | 'in_progress' | 'completed' | 'no_show';
  actor: CurrentUser;
}): Promise<IBooking> {
  await connectDB();

  const booking = await Booking.findById(params.bookingId);
  if (!booking) throw new BookingError('Booking not found.', 'NOT_FOUND');

  if (!canTransition(booking.status, params.status)) {
    throw new BookingError(
      `A ${booking.status} booking cannot be marked ${params.status}.`,
      'CONFLICT',
    );
  }

  const before = { status: booking.status };
  booking.status = params.status;
  if (params.status === 'completed') booking.completedAt = new Date();
  await booking.save();

  await recordAudit({
    actor: params.actor,
    action: 'booking.status',
    entity: 'Booking',
    entityId: String(booking._id),
    summary: `Booking ${booking.reference} marked ${params.status}`,
    before,
    after: { status: params.status },
  });

  return booking;
}

/**
 * Release slots held by unpaid bookings whose hold has lapsed.
 * Invoked opportunistically before availability-sensitive reads and from the
 * maintenance endpoint, so a stalled checkout cannot block a slot forever.
 */
export async function expireStaleHolds(): Promise<number> {
  await connectDB();
  const result = await Booking.updateMany(
    {
      status: 'pending_payment',
      isPaid: false,
      holdExpiresAt: { $ne: null, $lt: new Date() },
    },
    { $set: { status: 'expired', holdExpiresAt: null } },
  );
  return result.modifiedCount ?? 0;
}

/* ── Promotion usage ──────────────────────────────────────────────── */

/**
 * Atomically take one use of a promotion.
 *
 * Returns false when the code has hit its limit. `usageLimit: 0` means
 * unlimited, so that case skips the comparison entirely.
 */
async function claimPromotionUse(code: string): Promise<boolean> {
  const result = await Promotion.updateOne(
    {
      code,
      isActive: true,
      $or: [{ usageLimit: 0 }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }],
    },
    { $inc: { usageCount: 1 } },
  );

  return (result.modifiedCount ?? 0) > 0;
}

/** Return a use after the booking it was claimed for failed to save. */
async function releasePromotionUse(code: string): Promise<void> {
  try {
    await Promotion.updateOne(
      { code, usageCount: { $gt: 0 } },
      { $inc: { usageCount: -1 } },
    );
  } catch (error) {
    // Losing a single count is far less harmful than masking the original
    // booking failure, so this never rethrows.
    console.error('[bookings] failed to release promotion use', { code, error });
  }
}

/* ── helpers ──────────────────────────────────────────────────────── */

/** Combine a local date key and "HH:mm" times into UTC instants. */
export function toInstants(dateKey: string, startTime: string, endTime: string) {
  const day = fromDateKey(dateKey);
  const startAt = new Date(day);
  startAt.setHours(...(splitTime(startTime) as [number, number]), 0, 0);
  const endAt = new Date(day);
  endAt.setHours(...(splitTime(endTime) as [number, number]), 0, 0);
  return { startAt, endAt };
}

function splitTime(time: string): [number, number] {
  const [h, m] = time.split(':').map(Number);
  return [h, m];
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === 11000
  );
}

/** Exposed for the seed script and tests. */
/**
 * Re-exported for the seed script and tests.
 *
 * Note there is no transaction wrapper here by design: concurrency safety
 * comes from the unique partial index on (staff, startAt) and from the
 * conditional promotion increment above, both of which are atomic on a
 * standalone MongoDB. That means the app does not require a replica set.
 */
export { Payment, User };
