'use client';

import { useActionState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { submitContactAction } from './actions';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';

const INITIAL: ActionResult = { ok: false };

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactAction, INITIAL);

  if (state.ok) {
    return (
      <div className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center">
        <CheckCircle2 className="mx-auto size-8 text-emerald-600" aria-hidden />
        <p className="mt-3 text-sm font-semibold text-emerald-900">Message sent</p>
        <p className="mt-1.5 text-sm text-emerald-800">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6 space-y-5" noValidate>
      {state.message && <Alert variant="error">{state.message}</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" required error={state.fieldErrors?.name?.[0]}>
          <Input name="name" autoComplete="name" placeholder="Chinedu Okafor" required />
        </Field>

        <Field label="Phone number" error={state.fieldErrors?.phone?.[0]}>
          <Input name="phone" type="tel" autoComplete="tel" placeholder="0803 123 4567" />
        </Field>
      </div>

      <Field label="Email address" required error={state.fieldErrors?.email?.[0]}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </Field>

      <Field label="Subject" required error={state.fieldErrors?.subject?.[0]}>
        <Input name="subject" placeholder="What is this about?" required />
      </Field>

      <Field
        label="Message"
        required
        description="Please don't include sensitive clinical details here — we'll ask for those securely."
        error={state.fieldErrors?.message?.[0]}
      >
        <Textarea name="message" rows={5} placeholder="How can we help?" required />
      </Field>

      <SubmitButton size="lg" className="w-full sm:w-auto" pendingLabel="Sending…">
        Send message
      </SubmitButton>
    </form>
  );
}
