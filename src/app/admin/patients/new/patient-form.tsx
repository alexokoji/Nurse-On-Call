'use client';

import { useActionState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { savePatientAction } from '../../actions/people';
import { Field, FieldSet } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult<{ id: string }> = { ok: false };

export function PatientForm() {
  const router = useRouter();
  const [state, formAction] = useActionState(savePatientAction, INITIAL);

  useActionFeedback(state, {
    onSuccess: (result) =>
      router.push(result.data ? `/admin/patients/${result.data.id}` : '/admin/patients'),
  });

  return (
    <form action={formAction} className="space-y-5">
      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold text-navy-800">Personal details</h3>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" required error={state.fieldErrors?.name?.[0]}>
            <Input name="name" required />
          </Field>
          <Field label="Phone number" required error={state.fieldErrors?.phone?.[0]}>
            <Input name="phone" type="tel" placeholder="0803 123 4567" required />
          </Field>
        </div>

        <Field
          label="Email address"
          required
          description="Used for sign-in, confirmations and receipts."
          error={state.fieldErrors?.email?.[0]}
        >
          <Input name="email" type="email" required />
        </Field>

        <Field
          label="Password"
          description="Optional. Leave blank and the patient sets their own via “forgot password”."
          error={state.fieldErrors?.password?.[0]}
        >
          <Input name="password" type="password" autoComplete="new-password" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Date of birth" error={state.fieldErrors?.dateOfBirth?.[0]}>
            <Input name="dateOfBirth" type="date" />
          </Field>

          <Field label="Gender">
            <select
              name="gender"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Blood group">
            <Input name="bloodGroup" placeholder="O+" />
          </Field>
        </div>
      </section>

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <h3 className="text-sm font-semibold text-navy-800">Clinical background</h3>

        <Field label="Allergies" description="Separate with commas.">
          <Input name="allergies" placeholder="Penicillin, peanuts" />
        </Field>

        <Field label="Ongoing conditions" description="Separate with commas.">
          <Input name="chronicConditions" placeholder="Hypertension, asthma" />
        </Field>

        <Field
          label="Internal notes"
          description="Visible to staff only — never shown to the patient."
        >
          <Textarea name="notes" rows={3} />
        </Field>
      </section>

      <section className="space-y-5 rounded-xl border border-border bg-card p-6 shadow-card">
        <FieldSet legend="Home address" description="Used as the default for home visits.">
          <Field label="Street address">
            <Input name="street" />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Area / district">
              <Input name="area" placeholder="GRA Phase 2" />
            </Field>
            <Field label="City">
              <Input name="city" defaultValue="Port Harcourt" />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="State">
              <Input name="state" defaultValue="Rivers" />
            </Field>
            <Field label="Landmark">
              <Input name="landmark" />
            </Field>
          </div>
        </FieldSet>

        <FieldSet legend="Emergency contact">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Name">
              <Input name="emergencyName" />
            </Field>
            <Field label="Relationship">
              <Input name="emergencyRelationship" />
            </Field>
            <Field label="Phone">
              <Input name="emergencyPhone" type="tel" />
            </Field>
          </div>
        </FieldSet>
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <Button asChild variant="ghost">
          <Link href="/admin/patients">Cancel</Link>
        </Button>
        <SubmitButton size="lg" pendingLabel="Creating…">
          Create patient
        </SubmitButton>
      </div>
    </form>
  );
}
