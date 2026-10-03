import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { connectDB } from '@/lib/db/connect';
import { Booking } from '@/models';
import { apiRequireUser } from '@/lib/auth/guards';
import { startBankTransfer } from '@/lib/payments/bank-transfer';
import { PaymentError } from '@/lib/payments/service';
import { apiSuccess, apiError, handleApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * A 24-character hex id, checked before the database sees it.
 *
 * `findById` on a malformed id throws a CastError, which surfaces as a 500 —
 * an input problem reported as a server fault. Validating the shape here turns
 * it into the 404 it actually is.
 */
const schema = z.object({
  bookingId: z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, 'That booking reference is not valid.'),
});

/**
 * POST /api/payments/bank-transfer
 *
 * Records that the patient intends to pay by transfer, holds the slot for the
 * configured window, and returns the account details to display.
 *
 * It confirms nothing. The booking stays unpaid until an administrator sees
 * the money arrive, so this endpoint cannot be used to confirm an appointment
 * without paying — which is the whole reason the method needs a pending state.
 */
export async function POST(request: NextRequest) {
  try {
    const user = await apiRequireUser();
    const { bookingId } = schema.parse(await request.json());

    await connectDB();
    const booking = await Booking.findById(bookingId).select('patient').lean();
    if (!booking) return apiError('Booking not found.', 404, { code: 'NOT_FOUND' });

    if (String(booking.patient) !== user.id && user.role === 'patient') {
      return apiError('You do not have access to this booking.', 403, { code: 'FORBIDDEN' });
    }

    const { offer, narration, holdExpiresAt } = await startBankTransfer(bookingId);

    return apiSuccess({
      bankName: offer.bankName,
      accountName: offer.accountName,
      accountNumber: offer.accountNumber,
      instructions: offer.instructions,
      narration,
      holdExpiresAt: holdExpiresAt.toISOString(),
    });
  } catch (error) {
    if (error instanceof PaymentError) {
      const status = error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 400;
      return apiError(error.message, status, { code: error.code });
    }
    return handleApiError(error, 'payments.bankTransfer');
  }
}
