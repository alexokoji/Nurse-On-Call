'use client';

import { useActionState, useRef, useState } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { createTicketAction, replyToTicketAction } from '../actions';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

export function NewTicketForm() {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(createTicketAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useActionFeedback(state, {
    onSuccess: () => {
      formRef.current?.reset();
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}>
        <MessageSquarePlus className="size-4" />
        New support request
      </Button>
    );
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card shadow-card"
    >
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-navy-800">New support request</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Please don&apos;t include card details or passwords.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

        <Field label="Subject" required error={state.fieldErrors?.subject?.[0]}>
          <Input name="subject" placeholder="What do you need help with?" required />
        </Field>

        <Field label="Message" required error={state.fieldErrors?.message?.[0]}>
          <Textarea name="message" rows={5} placeholder="Tell us what happened…" required />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Sending…">Send request</SubmitButton>
      </div>
    </form>
  );
}

export function TicketReplyForm({ ticketId }: { ticketId: string }) {
  const [state, formAction] = useActionState(replyToTicketAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  useActionFeedback(state, { onSuccess: () => formRef.current?.reset() });

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input type="hidden" name="ticketId" value={ticketId} />

      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <Field label="Add a reply" error={state.fieldErrors?.message?.[0]}>
        <Textarea name="message" rows={3} placeholder="Type your reply…" required />
      </Field>

      <div className="flex justify-end">
        <SubmitButton size="sm" pendingLabel="Sending…">
          Send reply
        </SubmitButton>
      </div>
    </form>
  );
}
