'use client';

import { useActionState, useState } from 'react';
import { Check, X } from 'lucide-react';
import { decideRefundAction } from '../actions/finance';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Alert } from '@/components/ui/feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNaira } from '@/lib/utils';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

/**
 * Approving actually calls the payment gateway, so it is behind a confirm
 * dialog that states the amount and the recipient in plain words. Money
 * leaving the business should never be one stray click away.
 */
export function RefundDecision({
  refundId,
  reference,
  amountKobo,
  patientName,
}: {
  refundId: string;
  reference: string;
  amountKobo: number;
  patientName: string;
}) {
  const [decision, setDecision] = useState<'approve' | 'reject' | null>(null);
  const [state, formAction] = useActionState(decideRefundAction, INITIAL);

  useActionFeedback(state, { onSuccess: () => setDecision(null) });

  const approving = decision === 'approve';

  return (
    <>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="outline" onClick={() => setDecision('approve')}>
          <Check className="size-3.5" />
          Approve
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-red-50"
          onClick={() => setDecision('reject')}
        >
          <X className="size-3.5" />
          Reject
        </Button>
      </div>

      <Dialog open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {approving ? `Refund ${formatNaira(amountKobo)}?` : 'Reject this refund?'}
            </DialogTitle>
            <DialogDescription>
              {approving
                ? `This sends ${formatNaira(amountKobo)} back to ${patientName} through the original payment gateway. It cannot be undone from here.`
                : `${patientName} will not be refunded for ${reference}.`}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="refundId" value={refundId} />
            <input type="hidden" name="decision" value={decision ?? ''} />

            {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

            <Field
              label="Note"
              description="Recorded against the refund in the audit log."
              error={state.fieldErrors?.note?.[0]}
            >
              <Textarea name="note" rows={3} placeholder="Optional context for this decision." />
            </Field>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <SubmitButton
                variant={approving ? 'default' : 'destructive'}
                pendingLabel={approving ? 'Processing…' : 'Rejecting…'}
              >
                {approving ? `Approve and refund ${formatNaira(amountKobo)}` : 'Reject refund'}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
