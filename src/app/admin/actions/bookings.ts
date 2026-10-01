'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import { Booking, Payment, PatientProfile, User, nextReference } from '@/models';
import { apiRequirePermission, AuthError } from '@/lib/auth/guards';
import {
  assignStaff,
  cancelBooking,
  createBooking,
  rescheduleBooking,
  updateBookingStatus,
  BookingError,
  onBookingConfirmed,
} from '@/lib/bookings/service';
import {
  assignStaffSchema,
  cancelBookingSchema,
  createBookingSchema,
  rescheduleSchema,
  updateBookingStatusSchema,
} from '@/lib/validations/booking';
import { recordAudit } from '@/lib/audit';
import { formatNaira } from '@/lib/utils';
import type { ActionResult } from '@/types';

/**
 * Admin booking actions.
 *
 * Each one checks a specific permission — an "admin" who lacks
 * `appointments.cancel` cannot cancel, regardless of what the UI showed them.
 */

/** Generic so a caller with a typed `data` payload keeps its own type. */
function toResult<T = unknown>(error: unknown, fallback: string): ActionResult<T> {
  if (error instanceof AuthError || error instanceof BookingError) {
    return { ok: false, message: error.message };
  }
  console.error('[admin:bookings]', error);
  return { ok: false, message: fallback };
}

function refreshBooking(bookingId?: string) {
  revalidatePath('/admin/appointments');
  revalidatePath('/admin');
  if (bookingId) revalidatePath(`/admin/appointments/${bookingId}`);
}

export async function adminCancelBookingAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('appointments.cancel');

    const parsed = cancelBookingSchema.safeParse({
      bookingId: formData.get('bookingId'),
      reason: formData.get('reason'),
    });
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await cancelBooking({ ...parsed.data, actor: user });
    refreshBooking(parsed.data.bookingId);

    return { ok: true, message: 'Appointment cancelled.' };
  } catch (error) {
    return toResult(error, 'We could not cancel that appointment.');
  }
}

export async function adminAssignStaffAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('appointments.assign');

    const parsed = assignStaffSchema.safeParse({
      bookingId: formData.get('bookingId'),
      staffId: formData.get('staffId'),
    });
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await assignStaff({ ...parsed.data, actor: user });
    refreshBooking(parsed.data.bookingId);

    return { ok: true, message: 'Staff member assigned.' };
  } catch (error) {
    return toResult(error, 'We could not assign that staff member.');
  }
}

export async function adminRescheduleAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('appointments.reschedule');

    const parsed = rescheduleSchema.safeParse({
      bookingId: formData.get('bookingId'),
      dateKey: formData.get('dateKey'),
      startTime: formData.get('startTime'),
      staffId: formData.get('staffId') || null,
      reason: formData.get('reason') || undefined,
    });
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await rescheduleBooking({ ...parsed.data, actor: user });
    refreshBooking(parsed.data.bookingId);

    return { ok: true, message: 'Appointment rescheduled.' };
  } catch (error) {
    return toResult(error, 'We could not reschedule that appointment.');
  }
}

export async function adminUpdateStatusAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('appointments.edit');

    const parsed = updateBookingStatusSchema.safeParse({
      bookingId: formData.get('bookingId'),
      status: formData.get('status'),
    });
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await updateBookingStatus({ ...parsed.data, actor: user });
    refreshBooking(parsed.data.bookingId);

    return { ok: true, message: `Appointment marked ${parsed.data.status.replace(/_/g, ' ')}.` };
  } catch (error) {
    return toResult(error, 'We could not update that appointment.');
  }
}

/**
 * Records a payment taken outside the online gateways — bank transfer or cash
 * at the visit, both common here. This is a real business capability, not a
 * simulated payment: it writes a `manual` transaction with the admin who took
 * it recorded in the audit trail.
 */
export async function adminRecordManualPaymentAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('payments.refund');

    const parsed = z
      .object({
        bookingId: z.string().min(1),
        method: z.enum(['bank_transfer', 'cash', 'pos']),
        note: z.string().trim().max(300).optional(),
      })
      .safeParse({
        bookingId: formData.get('bookingId'),
        method: formData.get('method'),
        note: formData.get('note') || undefined,
      });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await connectDB();

    const booking = await Booking.findById(parsed.data.bookingId);
    if (!booking) return { ok: false, message: 'Booking not found.' };
    if (booking.isPaid) return { ok: false, message: 'This booking is already paid.' };
    if (['cancelled', 'expired'].includes(booking.status)) {
      return { ok: false, message: 'This booking is no longer active.' };
    }

    const now = new Date();

    await Payment.create({
      reference: await nextReference('payment'),
      booking: booking._id,
      patient: booking.patient,
      provider: 'manual',
      amountKobo: booking.totalKobo,
      amountPaidKobo: booking.totalKobo,
      currency: 'NGN',
      status: 'successful',
      channel: parsed.data.method,
      paidAt: now,
      verifiedAt: now,
      metadata: {
        recordedBy: user.id,
        recordedByName: user.name,
        note: parsed.data.note,
      },
    });

    const wasPending = booking.status === 'pending_payment';
    booking.isPaid = true;
    booking.paidAt = now;
    booking.holdExpiresAt = null;
    if (wasPending) booking.status = 'confirmed';
    await booking.save();

    if (wasPending) await onBookingConfirmed(booking);

    await recordAudit({
      actor: user,
      action: 'payment.manual',
      entity: 'Booking',
      entityId: String(booking._id),
      summary:
        `Manual payment of ${formatNaira(booking.totalKobo)} recorded for ${booking.reference} ` +
        `(${parsed.data.method.replace(/_/g, ' ')})`,
      after: { method: parsed.data.method, note: parsed.data.note },
    });

    refreshBooking(parsed.data.bookingId);
    revalidatePath('/admin/payments');

    return { ok: true, message: 'Payment recorded and the appointment is confirmed.' };
  } catch (error) {
    return toResult(error, 'We could not record that payment.');
  }
}

/**
 * Creates a booking on a patient's behalf — the phone-booking path.
 * If the phone number or email is new, a patient account is created so the
 * person still gets a dashboard, receipts and reminders.
 */
export async function adminCreateBookingAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult<{ bookingId: string; reference: string }>> {
  try {
    const user = await apiRequirePermission('appointments.create');

    const raw = {
      serviceId: formData.get('serviceId'),
      locationType: formData.get('locationType'),
      dateKey: formData.get('dateKey'),
      startTime: formData.get('startTime'),
      staffId: formData.get('staffId') || null,
      contact: {
        name: formData.get('name'),
        phone: formData.get('phone'),
        email: formData.get('email'),
      },
      address:
        formData.get('locationType') === 'home'
          ? {
              street: formData.get('street'),
              area: formData.get('area') || undefined,
              city: formData.get('city'),
              state: formData.get('state'),
              landmark: formData.get('landmark') || undefined,
            }
          : undefined,
      notes: formData.get('notes') || undefined,
    };

    const parsed = createBookingSchema.safeParse(raw);
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return {
        ok: false,
        fieldErrors: {
          ...flat.fieldErrors,
          // Surface nested contact errors at the top level for the form.
          ...Object.fromEntries(
            parsed.error.issues
              .filter((issue) => issue.path[0] === 'contact')
              .map((issue) => [String(issue.path[1]), [issue.message]]),
          ),
        } as Record<string, string[]>,
      };
    }

    await connectDB();

    /* Find or create the patient account. */
    const email = parsed.data.contact.email;
    let patient = await User.findOne({ email }).select('_id role').lean();

    if (!patient) {
      const created = await User.create({
        name: parsed.data.contact.name,
        email,
        phone: parsed.data.contact.phone,
        // A random unusable password: the patient sets their own via reset.
        password: await import('crypto').then((c) => c.randomBytes(32).toString('hex')),
        role: 'patient',
        status: 'active',
      });

      await PatientProfile.create({
        user: created._id,
        patientNumber: await nextReference('patient'),
        address: parsed.data.address,
      });

      await recordAudit({
        actor: user,
        action: 'patient.create',
        entity: 'User',
        entityId: String(created._id),
        summary: `Patient account created for ${parsed.data.contact.name} during admin booking`,
      });

      patient = { _id: created._id, role: 'patient' } as never;
    } else if (patient.role !== 'patient') {
      return {
        ok: false,
        fieldErrors: { email: ['That email belongs to a staff account. Use a different address.'] },
      };
    }

    const { booking } = await createBooking({
      input: parsed.data,
      patientUserId: String(patient!._id),
      actor: user,
    });

    refreshBooking();

    return {
      ok: true,
      message: `Booking ${booking.reference} created.`,
      data: { bookingId: String(booking._id), reference: booking.reference },
    };
  } catch (error) {
    return toResult(error, 'We could not create that booking.');
  }
}
