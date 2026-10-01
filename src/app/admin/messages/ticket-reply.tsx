'use client';

import { useActionState, useRef } from 'react';
import { replyToTicketAction } from '../actions/moderation';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

export function TicketReply({
  ticketId,
  currentStatus,
}: {
  ticketId: string;
  currentStatus: string;
}) {
  const [state, formAction] = useActionState(replyToTicketAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useActionFeedback(state, { onSuccess: () => formRef.current?.reset() });

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />

      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <Field label="Reply to the patient" required error={state.fieldErrors?.message?.[0]}>
        <Textarea
          name="message"
          rows={3}
          placeholder="The patient receives this by email and in their dashboard."
          required
        />
      </Field>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          Set status
          <select
            name="status"
            defaultValue={currentStatus}
            className="h-9 rounded-lg border border-input bg-background px-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="open">Open</option>
            <option value="in_progress">In progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </select>
        </label>

        <SubmitButton size="sm" pendingLabel="Sending…">
          Send reply
        </SubmitButton>
      </div>
    </form>
  );
}
