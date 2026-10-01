import type { NextRequest } from 'next/server';
import { apiRequireUser } from '@/lib/auth/guards';
import { verifyPayment } from '@/lib/payments/service';
import { apiSuccess, apiError, handleApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/verify?reference=TXN-000123
 *
 * Called when the gateway redirects the patient back. It asks the gateway
 * what really happened rather than believing the redirect — a URL parameter
 * saying "success" proves nothing.
 *
 * Idempotent: the webhook may have already settled this payment, in which
 * case the stored outcome is returned unchanged.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await apiRequireUser();

    const reference = request.nextUrl.searchParams.get('reference');
    if (!reference) return apiError('A payment reference is required.', 400);

    const outcome = await verifyPayment({ reference });

    if (String(outcome.payment.patient) !== user.id && user.role === 'patient') {
      return apiError('You do not have access to this payment.', 403, { code: 'FORBIDDEN' });
    }

    return apiSuccess({
      status: outcome.status,
      message: outcome.message,
      reference: outcome.payment.reference,
      bookingReference: outcome.bookingReference,
      bookingId: String(outcome.payment.booking),
      amountKobo: outcome.payment.amountPaidKobo || outcome.payment.amountKobo,
    });
  } catch (error) {
    return handleApiError(error, 'payments.verify');
  }
}
