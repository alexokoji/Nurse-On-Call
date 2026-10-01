import type { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { apiRequireUser } from '@/lib/auth/guards';
import { createBooking } from '@/lib/bookings/service';
import { createBookingSchema } from '@/lib/validations/booking';
import { rateLimit, RATE_LIMITS, clientIp } from '@/lib/auth/rate-limit';
import { apiSuccess, apiError, handleApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/bookings
 *
 * Creates a booking for the *signed-in* user. The patient is taken from the
 * session, never from the request body — a caller cannot book on someone
 * else's account by supplying their id. Price, staff assignment and status
 * are all derived server-side.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await apiRequireUser();

    const ip = clientIp(await headers());
    const limit = rateLimit(`booking:${user.id}:${ip}`, RATE_LIMITS.booking);
    if (!limit.success) {
      return apiError(
        'You have created several bookings in a short time. Please wait a moment and try again.',
        429,
        { code: 'RATE_LIMITED' },
      );
    }

    const input = createBookingSchema.parse(await request.json());

    const { booking, amountDueKobo } = await createBooking({
      input,
      // Admins booking on a patient's behalf go through the admin action,
      // not this route, so the session user is always the patient here.
      patientUserId: user.id,
      actor: user,
    });

    return apiSuccess(
      {
        bookingId: String(booking._id),
        reference: booking.reference,
        status: booking.status,
        amountDueKobo,
        requiresPayment: amountDueKobo > 0,
      },
      201,
    );
  } catch (error) {
    return handleApiError(error, 'bookings.create');
  }
}
