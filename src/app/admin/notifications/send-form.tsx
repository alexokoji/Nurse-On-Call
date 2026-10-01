'use client';

import { useActionState, useRef, useState } from 'react';
import { Send, Users } from 'lucide-react';
import { sendNotificationAction } from '../actions/moderation';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

const AUDIENCES = [
  { value: 'individual', label: 'One specific person' },
  { value: 'active_patients', label: 'All active patients' },
  { value: 'all_patients', label: 'All patients' },
  { value: 'all_staff', label: 'All staff' },
] as const;

/**
 * Broadcast composer. A bulk send is a one-way action reaching real people,
 * so the button states the audience explicitly rather than saying "Send".
 */
export function SendNotificationForm() {
  const [state, formAction] = useActionState(sendNotificationAction, INITIAL);
  const [audience, setAudience] = useState<string>('individual');
  const [open, setOpen] = useState(false);
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
        <Send className="size-4" />
        Send a notification
      </Button>
    );
  }

  const isBroadcast = audience !== 'individual';
  const audienceLabel = AUDIENCES.find((option) => option.value === audience)?.label ?? '';

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card shadow-card"
    >
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-navy-800">Send a notification</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Messages are recorded in the history below, whether or not delivery succeeds.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Channel" required error={state.fieldErrors?.channel?.[0]}>
            <select
              name="channel"
              defaultValue="in_app"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="in_app">In-app notification</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
            </select>
          </Field>

          <Field label="Audience" required error={state.fieldErrors?.audience?.[0]}>
            <select
              name="audience"
              value={audience}
              onChange={(event) => setAudience(event.target.value)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {AUDIENCES.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {audience === 'individual' && (
          <Field
            label="Recipient user ID"
            required
            description="Copy this from the patient or staff record."
            error={state.fieldErrors?.recipientId?.[0]}
          >
            <Input name="recipientId" placeholder="e.g. 6a90c04c177b5fa97fb02ab6" />
          </Field>
        )}

        {isBroadcast && (
          <Alert variant="warning" title="This reaches real people">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              This will be delivered to <strong>{audienceLabel.toLowerCase()}</strong>. It cannot be
              recalled once sent.
            </span>
          </Alert>
        )}

        <Field label="Subject" required error={state.fieldErrors?.subject?.[0]}>
          <Input name="subject" placeholder="Clinic closed on Monday" required />
        </Field>

        <Field label="Message" required error={state.fieldErrors?.body?.[0]}>
          <Textarea
            name="body"
            rows={5}
            placeholder="Write the message exactly as the recipient will read it."
            required
          />
        </Field>
      </div>

      <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <SubmitButton pendingLabel="Sending…">
          <Send className="size-4" />
          {isBroadcast ? `Send to ${audienceLabel.toLowerCase()}` : 'Send notification'}
        </SubmitButton>
      </div>
    </form>
  );
}
