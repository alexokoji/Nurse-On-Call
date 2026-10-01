'use client';

import { useActionState, useState } from 'react';
import { ShieldOff } from 'lucide-react';
import { setPatientStatusAction } from '../../actions/people';
import { Button } from '@/components/ui/button';
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
import type { ActionResult, UserStatus } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

/**
 * Suspending an account signs the patient out everywhere and blocks new
 * bookings, so it is confirmed rather than done from a dropdown.
 */
export function PatientStatusControl({
  patientId,
  status,
}: {
  patientId: string;
  status: UserStatus;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(setPatientStatusAction, INITIAL);

  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  const suspended = status !== 'active';
  const target: UserStatus = suspended ? 'active' : 'suspended';

  return (
    <>
      <Button
        variant="outline"
        className={suspended ? '' : 'text-destructive hover:bg-red-50'}
        onClick={() => setOpen(true)}
      >
        <ShieldOff className="size-4" />
        {suspended ? 'Reactivate account' : 'Suspend account'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {suspended ? 'Reactivate this account?' : 'Suspend this account?'}
            </DialogTitle>
            <DialogDescription>
              {suspended
                ? 'The patient will be able to sign in and book again straight away.'
                : 'The patient is signed out everywhere immediately and cannot sign in or book. Existing appointments are not cancelled — cancel those separately if needed.'}
            </DialogDescription>
          </DialogHeader>

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <form action={formAction}>
              <input type="hidden" name="patientId" value={patientId} />
              <input type="hidden" name="status" value={target} />
              <SubmitButton
                variant={suspended ? 'default' : 'destructive'}
                pendingLabel="Updating…"
              >
                {suspended ? 'Reactivate account' : 'Suspend account'}
              </SubmitButton>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
