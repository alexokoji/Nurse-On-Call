'use client';

import { useActionState } from 'react';
import { MailCheck } from 'lucide-react';
import { forgotPasswordAction } from '../actions';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';

const INITIAL: ActionResult = { ok: false };

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(forgotPasswordAction, INITIAL);

  /* The success reply is intentionally identical whether or not the account
     exists, so this screen must not hint either way. */
  if (state.ok && state.message) {
    return (
      <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <MailCheck className="mx-auto size-8 text-emerald-600" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-emerald-900">Check your email</p>
        <p className="mt-1.5 text-sm text-emerald-800">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <Field label="Email address" required error={state.fieldErrors?.email?.[0]}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Sending…">
        Send reset link
      </SubmitButton>
    </form>
  );
}
