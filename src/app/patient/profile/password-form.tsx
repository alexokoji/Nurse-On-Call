'use client';

import { useActionState, useRef } from 'react';
import { changePasswordAction } from '../actions';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

export function PasswordForm() {
  const [state, formAction] = useActionState(changePasswordAction, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  // Never leave the old and new passwords sitting in the DOM.
  useActionFeedback(state, { onSuccess: () => formRef.current?.reset() });

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-xl border border-border bg-card shadow-card"
    >
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-navy-800">Change password</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Changing your password signs you out everywhere else.
        </p>
      </div>

      <div className="space-y-5 p-6">
        {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

        <Field
          label="Current password"
          required
          error={state.fieldErrors?.currentPassword?.[0]}
        >
          <Input name="currentPassword" type="password" autoComplete="current-password" required />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field
            label="New password"
            required
            description="8+ characters, with upper and lower case and a number."
            error={state.fieldErrors?.password?.[0]}
          >
            <Input name="password" type="password" autoComplete="new-password" required />
          </Field>

          <Field
            label="Confirm new password"
            required
            error={state.fieldErrors?.confirmPassword?.[0]}
          >
            <Input name="confirmPassword" type="password" autoComplete="new-password" required />
          </Field>
        </div>
      </div>

      <div className="flex justify-end border-t border-border px-6 py-4">
        <SubmitButton variant="outline" pendingLabel="Updating…">
          Update password
        </SubmitButton>
      </div>
    </form>
  );
}
