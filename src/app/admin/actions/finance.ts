'use server';

import { revalidatePath } from 'next/cache';
import { apiRequirePermission, AuthError } from '@/lib/auth/guards';
import { requestRefund, decideRefund, PaymentError } from '@/lib/payments/service';
import { refundRequestSchema, refundDecisionSchema } from '@/lib/validations/admin';
import { toKobo } from '@/lib/utils';
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
