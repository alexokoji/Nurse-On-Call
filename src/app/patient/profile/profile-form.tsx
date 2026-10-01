'use client';

import { useActionState } from 'react';
import { updateProfileAction } from '../actions';
import { Field, FieldSet } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';
import type { getPatientProfile } from '@/lib/queries/patient';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

type Profile = NonNullable<Awaited<ReturnType<typeof getPatientProfile>>>;

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateProfileAction, INITIAL);

  useActionFeedback(state);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-card shadow-card">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-sm font-semibold text-navy-800">Personal details</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Used to identify you and to reach you about appointments.
        </p>
      </div>

      <div className="space-y-6 p-6">
        {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" required error={state.fieldErrors?.name?.[0]}>
            <Input name="name" defaultValue={profile.name} autoComplete="name" required />
          </Field>

          <Field label="Phone number" required error={state.fieldErrors?.phone?.[0]}>
            <Input
              name="phone"
              defaultValue={profile.phone}
              type="tel"
              autoComplete="tel"
              required
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-3">
          <Field label="Date of birth" error={state.fieldErrors?.dateOfBirth?.[0]}>
            <Input name="dateOfBirth" defaultValue={profile.dateOfBirth} type="date" />
          </Field>

          <Field label="Gender">
            <select
              name="gender"
              defaultValue={profile.gender}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>

          <Field label="Blood group">
            <Input name="bloodGroup" defaultValue={profile.bloodGroup} placeholder="O+" />
          </Field>
        </div>

        <FieldSet
          legend="Clinical background"
          description="Optional, but it helps our clinicians attend you safely."
        >
          <Field
            label="Allergies"
            description="Separate multiple entries with commas."
          >
            <Input
              name="allergies"
              defaultValue={profile.allergies.join(', ')}
              placeholder="Penicillin, peanuts"
            />
          </Field>

          <Field label="Ongoing conditions" description="Separate multiple entries with commas.">
            <Input
              name="chronicConditions"
              defaultValue={profile.chronicConditions.join(', ')}
              placeholder="Hypertension, asthma"
            />
          </Field>
        </FieldSet>

        <FieldSet legend="Home address" description="Used as the default for home visits.">
          <Field label="Street address">
            <Input
              name="street"
              defaultValue={profile.address.street}
              autoComplete="street-address"
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Area / district">
              <Input name="area" defaultValue={profile.address.area} />
            </Field>
            <Field label="City">
              <Input name="city" defaultValue={profile.address.city} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="State">
              <Input name="state" defaultValue={profile.address.state} />
            </Field>
            <Field label="Landmark">
              <Input name="landmark" defaultValue={profile.address.landmark} />
            </Field>
          </div>
        </FieldSet>

        <FieldSet
          legend="Emergency contact"
          description="Who we should call if we cannot reach you."
        >
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Name">
              <Input name="emergencyName" defaultValue={profile.emergencyContact.name} />
            </Field>
            <Field label="Relationship">
              <Input
                name="emergencyRelationship"
                defaultValue={profile.emergencyContact.relationship}
              />
            </Field>
            <Field label="Phone">
              <Input
                name="emergencyPhone"
                defaultValue={profile.emergencyContact.phone}
                type="tel"
              />
            </Field>
          </div>
        </FieldSet>
      </div>

      <div className="flex justify-end border-t border-border px-6 py-4">
        <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
      </div>
    </form>
  );
}
