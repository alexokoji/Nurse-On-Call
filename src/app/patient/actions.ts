'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import { Booking, PatientProfile, Review, SupportTicket, User, nextReference } from '@/models';
import { requirePatient } from '@/lib/auth/guards';
import { cancelBooking, rescheduleBooking, BookingError } from '@/lib/bookings/service';
import { markNotificationRead, markAllNotificationsRead } from '@/lib/notifications/service';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { changePasswordSchema, phoneSchema } from '@/lib/validations/auth';
import { GENDERS } from '@/types';
import { normalisePhone } from '@/lib/utils';
import { recordAudit } from '@/lib/audit';
import type { ActionResult } from '@/types';

/**
 * Patient-facing server actions.
 *
 * Every one starts with `requirePatient()` and then scopes its query to that
 * user's id — a booking id from the form is never trusted on its own.
 */

/* ── Appointments ─────────────────────────────────────────────────── */

export async function cancelBookingAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePatient();

  const parsed = z
    .object({
      bookingId: z.string().min(1),
      reason: z.string().trim().min(3, 'Tell us briefly why').max(500),
    })
    .safeParse({
      bookingId: formData.get('bookingId'),
      reason: formData.get('reason'),
    });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await cancelBooking({ ...parsed.data, actor: user });
    revalidatePath('/patient/appointments');
    revalidatePath(`/patient/appointments/${parsed.data.bookingId}`);
    return { ok: true, message: 'Your appointment has been cancelled.' };
  } catch (error) {
    if (error instanceof BookingError) return { ok: false, message: error.message };
    console.error('[patient] cancel failed', error);
    return { ok: false, message: 'We could not cancel that appointment. Please contact support.' };
  }
}

export async function rescheduleBookingAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePatient();

  const parsed = z
    .object({
      bookingId: z.string().min(1),
      dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Choose a date'),
      startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Choose a time'),
    })
    .safeParse({
      bookingId: formData.get('bookingId'),
      dateKey: formData.get('dateKey'),
      startTime: formData.get('startTime'),
    });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  try {
    await rescheduleBooking({ ...parsed.data, actor: user });
    revalidatePath('/patient/appointments');
    revalidatePath(`/patient/appointments/${parsed.data.bookingId}`);
    return { ok: true, message: 'Your appointment has been moved.' };
  } catch (error) {
    if (error instanceof BookingError) return { ok: false, message: error.message };
    console.error('[patient] reschedule failed', error);
    return { ok: false, message: 'We could not reschedule that appointment.' };
  }
}

/* ── Reviews ──────────────────────────────────────────────────────── */

const reviewSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1, 'Choose a rating').max(5),
  comment: z.string().trim().min(10, 'Tell us a little more').max(2000),
});

export async function submitReviewAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePatient();

  const parsed = reviewSchema.safeParse({
    bookingId: formData.get('bookingId'),
    rating: formData.get('rating'),
    comment: formData.get('comment'),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await connectDB();

  // Only the patient's own *completed* booking can be reviewed.
  const booking = await Booking.findOne({
    _id: parsed.data.bookingId,
    patient: user.id,
    status: 'completed',
  });

  if (!booking) {
    return {
      ok: false,
      message: 'You can only review an appointment once it has been completed.',
    };
  }

  if (booking.hasReview) {
    return { ok: false, message: 'You have already reviewed this appointment.' };
  }

  try {
    await Review.create({
      patient: user.id,
      booking: booking._id,
      service: booking.service,
      staff: booking.staff,
      rating: parsed.data.rating,
      comment: parsed.data.comment,
      // Reviews are moderated before they appear publicly.
      status: 'pending',
    });

    booking.hasReview = true;
    await booking.save();

    revalidatePath('/patient/reviews');
    revalidatePath(`/patient/appointments/${parsed.data.bookingId}`);

    return {
      ok: true,
      message: 'Thank you — your review has been submitted and will appear once approved.',
    };
  } catch (error) {
    // Unique index on booking: a double submit lands here.
    if ((error as { code?: number }).code === 11000) {
      return { ok: false, message: 'You have already reviewed this appointment.' };
    }
    console.error('[patient] review failed', error);
    return { ok: false, message: 'We could not save your review. Please try again.' };
  }
}

/* ── Profile ──────────────────────────────────────────────────────── */

const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  phone: phoneSchema,
  dateOfBirth: z.string().optional(),
  gender: z.enum(GENDERS).optional().or(z.literal('')),
  bloodGroup: z.string().trim().max(10).optional(),
  allergies: z.string().trim().max(500).optional(),
  chronicConditions: z.string().trim().max(500).optional(),
  street: z.string().trim().max(200).optional(),
  area: z.string().trim().max(120).optional(),
  city: z.string().trim().max(120).optional(),
  state: z.string().trim().max(120).optional(),
  landmark: z.string().trim().max(200).optional(),
  emergencyName: z.string().trim().max(120).optional(),
  emergencyRelationship: z.string().trim().max(80).optional(),
  emergencyPhone: z.string().trim().max(30).optional(),
});

export async function updateProfileAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePatient();

  const parsed = profileSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = parsed.data;
  await connectDB();

  await User.updateOne(
    { _id: user.id },
    { $set: { name: data.name, phone: normalisePhone(data.phone) } },
  );

  await PatientProfile.updateOne(
    { user: user.id },
    {
      $set: {
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender || undefined,
        bloodGroup: data.bloodGroup,
        allergies: splitList(data.allergies),
        chronicConditions: splitList(data.chronicConditions),
        address: {
          street: data.street,
          area: data.area,
          city: data.city,
          state: data.state,
          landmark: data.landmark,
        },
        emergencyContact: {
          name: data.emergencyName,
          relationship: data.emergencyRelationship,
          phone: data.emergencyPhone,
        },
      },
    },
    { upsert: true },
  );

  revalidatePath('/patient/profile');
  revalidatePath('/patient/dashboard');

  return { ok: true, message: 'Your profile has been updated.' };
}

export async function changePasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePatient();

  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get('currentPassword'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await connectDB();
  const account = await User.findById(user.id).select('+password');
  if (!account) return { ok: false, message: 'We could not find your account.' };

  const valid = await verifyPassword(parsed.data.currentPassword, account.password);
  if (!valid) {
    return { ok: false, fieldErrors: { currentPassword: ['That password is not correct'] } };
  }

  account.password = await hashPassword(parsed.data.password);
  // Bumping this signs out every other device.
  account.sessionVersion += 1;
  await account.save();

  await recordAudit({
    actor: user,
    action: 'auth.password_change',
    entity: 'User',
    entityId: user.id,
    summary: `${user.name} changed their password`,
  });

  return {
    ok: true,
    message: 'Your password has been changed. Other devices have been signed out.',
  };
}

/* ── Support ──────────────────────────────────────────────────────── */

const ticketSchema = z.object({
  subject: z.string().trim().min(3, 'Enter a subject').max(200),
  message: z.string().trim().min(10, 'Tell us a little more').max(4000),
  bookingId: z.string().optional(),
});

export async function createTicketAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePatient();

  const parsed = ticketSchema.safeParse({
    subject: formData.get('subject'),
    message: formData.get('message'),
    bookingId: formData.get('bookingId') || undefined,
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await connectDB();

  await SupportTicket.create({
    reference: await nextReference('ticket'),
    patient: user.id,
    subject: parsed.data.subject,
    category: 'general',
    status: 'open',
    relatedBooking: parsed.data.bookingId ?? null,
    messages: [
      {
        author: user.id,
        authorName: user.name,
        isStaff: false,
        body: parsed.data.message,
        createdAt: new Date(),
      },
    ],
  });

  revalidatePath('/patient/support');
  return { ok: true, message: 'Your request has been sent. We usually reply within a few hours.' };
}

export async function replyToTicketAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requirePatient();

  const parsed = z
    .object({
      ticketId: z.string().min(1),
      message: z.string().trim().min(2, 'Enter a message').max(4000),
    })
    .safeParse({
      ticketId: formData.get('ticketId'),
      message: formData.get('message'),
    });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await connectDB();

  const result = await SupportTicket.updateOne(
    { _id: parsed.data.ticketId, patient: user.id },
    {
      $push: {
        messages: {
          author: user.id,
          authorName: user.name,
          isStaff: false,
          body: parsed.data.message,
          createdAt: new Date(),
        },
      },
      // A patient reply reopens a resolved ticket.
      $set: { status: 'open' },
    },
  );

  if (result.matchedCount === 0) {
    return { ok: false, message: 'We could not find that request.' };
  }

  revalidatePath('/patient/support');
  return { ok: true, message: 'Your reply has been sent.' };
}

/* ── Notifications ────────────────────────────────────────────────── */

export async function markNotificationReadAction(notificationId: string) {
  const user = await requirePatient();
  await markNotificationRead(notificationId, user.id);
  revalidatePath('/patient/notifications');
}

export async function markAllReadAction() {
  const user = await requirePatient();
  await markAllNotificationsRead(user.id);
  revalidatePath('/patient/notifications');
  revalidatePath('/patient/dashboard');
}

/* ── helpers ──────────────────────────────────────────────────────── */

function splitList(value?: string): string[] {
  if (!value?.trim()) return [];
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}
