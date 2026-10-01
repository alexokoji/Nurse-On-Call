'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { registerAction } from '../actions';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/misc';
import { Alert } from '@/components/ui/feedback';
import { checkPasswordStrength } from '@/lib/auth/password';
import { cn } from '@/lib/utils';
import type { ActionResult } from '@/types';

const INITIAL: ActionResult = { ok: false };

const RULES = [
  'At least 8 characters',
  'One uppercase letter',
  'One lowercase letter',
  'One number',
];

export function RegisterForm() {
  const [state, formAction] = useActionState(registerAction, INITIAL);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Live checklist mirrors the server's Zod rule, so the two cannot disagree.
  const strength = checkPasswordStrength(password);

  return (
    <form action={formAction} className="mt-8 space-y-5" noValidate>
      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <Field label="Full name" required error={state.fieldErrors?.name?.[0]}>
        <Input name="name" autoComplete="name" placeholder="Chinedu Okafor" required />
      </Field>

      <Field label="Email address" required error={state.fieldErrors?.email?.[0]}>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
        />
      </Field>

      <Field
        label="Phone number"
        required
        description="We use this to reach you about your appointments."
        error={state.fieldErrors?.phone?.[0]}
      >
        <Input
          name="phone"
          type="tel"
          autoComplete="tel"
          placeholder="0803 123 4567"
          required
        />
      </Field>

      <Field label="Password" required error={state.fieldErrors?.password?.[0]}>
        <div className="relative">
          <Input
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="pr-10"
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((shown) => !shown)}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:text-navy-800 focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </Field>

      {password.length > 0 && (
        <ul className="grid grid-cols-2 gap-1.5" aria-label="Password requirements">
          {RULES.map((rule) => {
            const met = !strength.issues.includes(rule);
            return (
              <li
                key={rule}
                className={cn(
                  'flex items-center gap-1.5 text-xs',
                  met ? 'text-emerald-600' : 'text-muted-foreground',
                )}
              >
                {met ? (
                  <Check className="size-3.5" aria-hidden />
                ) : (
                  <X className="size-3.5" aria-hidden />
                )}
                {rule}
              </li>
            );
          })}
        </ul>
      )}

      <Field label="Confirm password" required error={state.fieldErrors?.confirmPassword?.[0]}>
        <Input
          name="confirmPassword"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          required
        />
      </Field>

      <div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted-foreground">
          <Checkbox name="acceptTerms" className="mt-0.5" required />
          <span>
            I agree to the{' '}
            <Link href="/terms" className="font-medium text-primary hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="font-medium text-primary hover:underline">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        {state.fieldErrors?.acceptTerms?.[0] && (
          <p role="alert" className="mt-1 text-xs font-medium text-destructive">
            {state.fieldErrors.acceptTerms[0]}
          </p>
        )}
      </div>

      <SubmitButton className="w-full" size="lg" pendingLabel="Creating your account…">
        Create account
      </SubmitButton>
    </form>
  );
}
