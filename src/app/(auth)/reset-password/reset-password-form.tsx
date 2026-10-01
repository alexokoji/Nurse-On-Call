'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { resetPasswordAction } from '../actions';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import type { ActionResult } from '@/types';

const INITIAL: ActionResult = { ok: false };

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, formAction] = useActionState(resetPasswordAction, INITIAL);

  if (state.ok) {
    return (
      <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-emerald-600" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-emerald-900">Password changed</p>
        <p className="mt-1.5 text-sm text-emerald-800">{state.message}</p>
        <Button asChild className="mt-5">
          <Link href="/login">Go to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      <input type="hidden" name="token" value={token} />

      {state.message && <Alert variant="error">{state.message}</Alert>}

      <Field
        label="New password"
        required
        description="At least 8 characters, with an uppercase letter, a lowercase letter and a number."
        error={state.fieldErrors?.password?.[0]}
      >
        <Input name="password" type="password" autoComplete="new-password" required />
      </Field>

      <Field label="Confirm new password" required error={state.fieldErrors?.confirmPassword?.[0]}>
        <Input name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>

      <SubmitButton className="w-full" size="lg" pendingLabel="Saving…">
        Change password
      </SubmitButton>
    </form>
  );
}
