'use client';

import { useActionState, useState } from 'react';
import { Check, X } from 'lucide-react';
import { confirmBankTransferAction, declineBankTransferAction } from '../actions/finance';
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
 * Confirming a bank transfer is the one place in the system where money is
 * marked received on a person's word rather than a gateway's. It therefore
 * states the amount and the narration to check against the bank statement,
 * and sits behind a dialog instead of being a single click in a table row.
 */
export function TransferDecision({
  paymentId,
  amountKobo,
  patientName,
  bookingReference,
  narration,
}: {
  paymentId: string;
  amountKobo: number;
  patientName: string;
  bookingReference: string;
  /** What the patient was told to use, which is what to look for. */
  narration?: string;
}) {
  const [decision, setDecision] = useState<'confirm' | 'decline' | null>(null);
  const [state, formAction] = useActionState(
    decision === 'decline' ? declineBankTransferAction : confirmBankTransferAction,
    INITIAL,
  );

  useActionFeedback(state, { onSuccess: () => setDecision(null) });

  const confirming = decision === 'confirm';

  return (
    <>
      <div className="flex justify-end gap-1.5">
        <Button size="sm" variant="outline" onClick={() => setDecision('confirm')}>
          <Check className="size-3.5" />
          Confirm
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="text-destructive hover:bg-red-50"
          onClick={() => setDecision('decline')}
        >
          <X className="size-3.5" />
          Not received
        </Button>
      </div>

      <Dialog open={decision !== null} onOpenChange={(open) => !open && setDecision(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirming
                ? `Confirm ${formatNaira(amountKobo)} received?`
                : 'Mark this transfer as not received?'}
            </DialogTitle>
            <DialogDescription>
              {confirming
                ? `Check your bank statement for ${formatNaira(amountKobo)} from ${patientName}${
                    narration ? `, quoting ${narration}` : ''
                  }. Confirming books the appointment and emails the patient.`
                : `${patientName} will be told we could not match a transfer to ${bookingReference}, and the slot is released.`}
            </DialogDescription>
          </DialogHeader>

          <form action={formAction} className="space-y-4">
            <input type="hidden" name="paymentId" value={paymentId} />

            {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

            {confirming ? (
              <Field
                label="Note"
                description="Recorded against the payment in the audit log."
                error={state.fieldErrors?.note?.[0]}
              >
                <Textarea
                  name="note"
                  rows={2}
                  placeholder="Optional — e.g. the bank's transaction id."
                />
              </Field>
            ) : (
              <Field
                label="Reason"
                description="Sent to the patient, so write it for them to read."
                error={state.fieldErrors?.reason?.[0]}
              >
                <Textarea
                  name="reason"
                  rows={3}
                  required
                  placeholder="We could not find a transfer matching this reference."
                />
              </Field>
            )}

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setDecision(null)}>
                Cancel
              </Button>
              <SubmitButton
                variant={confirming ? 'default' : 'destructive'}
                pendingLabel={confirming ? 'Confirming…' : 'Updating…'}
              >
                {confirming ? `Confirm ${formatNaira(amountKobo)}` : 'Mark not received'}
              </SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
