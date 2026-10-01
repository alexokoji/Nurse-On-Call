import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import { Booking } from '@/models';
import { apiRequireUser } from '@/lib/auth/guards';
import { createPayment, availableProviders } from '@/lib/payments/service';
import { apiSuccess, apiError, handleApiError } from '@/lib/api';
import { PAYMENT_PROVIDERS } from '@/types';

export const dynamic = 'force-dynamic';

const schema = z.object({
  bookingId: z.string().min(1),
  provider: z.enum(PAYMENT_PROVIDERS).optional(),
});

/**
 * POST /api/payments/initialize
 *
 * Starts a checkout for a booking the caller owns and returns the gateway's
 * hosted payment URL. Ownership is checked against the session; the amount
 * comes from the stored booking, never from the request.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await apiRequireUser();
    const { bookingId, provider } = schema.parse(await request.json());

    await connectDB();
    const booking = await Booking.findById(bookingId).select('patient').lean();
    if (!booking) return apiError('Booking not found.', 404, { code: 'NOT_FOUND' });

    // A patient may only pay for their own booking; staff with the payments
    // permission settle on a patient's behalf through the admin screens.
    if (String(booking.patient) !== user.id && user.role === 'patient') {
      return apiError('You do not have access to this booking.', 403, { code: 'FORBIDDEN' });
    }

    const enabled = await availableProviders();
    if (enabled.length === 0) {
      return apiError(
        'Online payment is temporarily unavailable. Please call us on 0800 123 4567 to ' +
          'complete your booking.',
        503,
        { code: 'NO_PROVIDER' },
      );
    }

    if (provider && !enabled.includes(provider)) {
      return apiError('That payment method is not available right now.', 400, {
        code: 'PROVIDER_DISABLED',
      });
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

    const { payment, authorizationUrl } = await createPayment({
      bookingId,
      provider,
      callbackUrl: `${appUrl}/book/callback`,
    });

    return apiSuccess({
      reference: payment.reference,
      provider: payment.provider,
      authorizationUrl,
    });
  } catch (error) {
    return handleApiError(error, 'payments.initialize');
  }
}

/** GET returns which providers the checkout can currently offer. */
export async function GET() {
  try {
    return apiSuccess({ providers: await availableProviders() });
  } catch (error) {
    return handleApiError(error, 'payments.providers');
  }
}
