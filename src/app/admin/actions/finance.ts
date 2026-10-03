'use server';

import { revalidatePath } from 'next/cache';
import { apiRequirePermission, AuthError } from '@/lib/auth/guards';
import { requestRefund, decideRefund, PaymentError } from '@/lib/payments/service';
import { refundRequestSchema, refundDecisionSchema } from '@/lib/validations/admin';
import { z } from 'zod';
import { confirmBankTransfer, declineBankTransfer } from '@/lib/payments/bank-transfer';
import { recordAudit } from '@/lib/audit';
import { formatNaira, toKobo } from '@/lib/utils';
import type { ActionResult } from '@/types';

/** Refund actions. Requesting and approving are separate permissions on
 *  purpose — the person who raises a refund should not be the one who
 *  approves it in an organisation that cares about separation of duties. */

function toResult(error: unknown, fallback: string): ActionResult {
  if (error instanceof AuthError || error instanceof PaymentError) {
    return { ok: false, message: error.message };
  }
  console.error('[admin:finance]', error);
  return { ok: false, message: fallback };
}

export async function requestRefundAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('payments.refund');

    const parsed = refundRequestSchema.safeParse({
      paymentId: formData.get('paymentId'),
      amount: formData.get('amount'),
      reason: formData.get('reason'),
    });
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    await requestRefund({
      paymentId: parsed.data.paymentId,
      // The form collects naira; storage is always kobo.
      amountKobo: toKobo(parsed.data.amount),
      reason: parsed.data.reason,
      actor: user,
    });

    revalidatePath('/admin/refunds');
    revalidatePath('/admin/payments');

    return { ok: true, message: 'Refund requested and is awaiting approval.' };
  } catch (error) {
    return toResult(error, 'We could not raise that refund.');
  }
}

export async function decideRefundAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('refunds.approve');

    const parsed = refundDecisionSchema.safeParse({
      refundId: formData.get('refundId'),
      decision: formData.get('decision'),
      note: formData.get('note') || undefined,
    });
    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const refund = await decideRefund({ ...parsed.data, actor: user });

    revalidatePath('/admin/refunds');
    revalidatePath('/admin/payments');

    return {
      ok: true,
      message:
        parsed.data.decision === 'reject'
          ? 'Refund rejected.'
          : refund.status === 'completed'
            ? 'Refund approved and processed by the gateway.'
            : 'Refund approved — the gateway is settling it now.',
    };
  } catch (error) {
    return toResult(error, 'We could not process that refund.');
  }
}

/* ── Bank transfer confirmation ────────────────────────────────────────
   A transfer has no gateway to ask, so a person vouches for it. These are
   therefore the only actions that mark money as received on someone's word,
   which is why both are permissioned, audited, and record the actor on the
   payment itself.

   `payments.refund` is the existing "handles money" permission, already
   required to record a manual payment. Reusing it keeps the two offline
   settlement paths behind one grant, and needs no change to roles already
   stored in a live database. */

export async function confirmBankTransferAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('payments.refund');

    const parsed = z
      .object({
        paymentId: z.string().min(1),
        note: z.string().trim().max(300).optional(),
      })
      .safeParse({
        paymentId: formData.get('paymentId'),
        note: formData.get('note') || undefined,
      });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const { booking, payment } = await confirmBankTransfer(
      parsed.data.paymentId,
      { id: user.id, name: user.name },
      parsed.data.note,
    );

    await recordAudit({
      actor: user,
      action: 'payment.transfer.confirm',
      entity: 'Payment',
      entityId: String(payment._id),
      summary:
        `Bank transfer of ${formatNaira(payment.amountPaidKobo)} confirmed for ` +
        `${booking.reference}`,
      after: { note: parsed.data.note, bookingStatus: booking.status },
    });

    revalidatePath('/admin/payments');
    revalidatePath('/admin/appointments');
    revalidatePath(`/admin/appointments/${String(booking._id)}`);
    revalidatePath('/admin');

    return { ok: true, message: 'Transfer confirmed and the appointment is booked.' };
  } catch (error) {
    return toResult(error, 'We could not confirm that transfer.');
  }
}

export async function declineBankTransferAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('payments.refund');

    const parsed = z
      .object({
        paymentId: z.string().min(1),
        /* Required, unlike the confirmation note: this one is sent to the
           patient, and "we could not confirm your payment" with no reason is
           an invitation to a phone call. */
        reason: z.string().trim().min(5).max(300),
      })
      .safeParse({
        paymentId: formData.get('paymentId'),
        reason: formData.get('reason'),
      });

    if (!parsed.success) return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };

    const { booking, payment } = await declineBankTransfer(
      parsed.data.paymentId,
      { id: user.id, name: user.name },
      parsed.data.reason,
    );

    await recordAudit({
      actor: user,
      action: 'payment.transfer.decline',
      entity: 'Payment',
      entityId: String(payment._id),
      summary: `Bank transfer for ${booking.reference} could not be confirmed`,
      after: { reason: parsed.data.reason },
    });

    revalidatePath('/admin/payments');
    revalidatePath(`/admin/appointments/${String(booking._id)}`);

    return { ok: true, message: 'Marked as not received. The patient has been told.' };
  } catch (error) {
    return toResult(error, 'We could not update that transfer.');
  }
}
