'use client';

import { useActionState, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { saveStaffAction } from '../actions/people';
import { Field, FieldSet } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox, Switch } from '@/components/ui/misc';
import { Alert } from '@/components/ui/feedback';
import { LABELS, STAFF_DEPARTMENTS, STAFF_ROLES, WEEKDAYS, type Weekday } from '@/types';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { ImageUpload } from '@/components/forms/image-upload';

const INITIAL: ActionResult<{ id: string }> = { ok: false };

interface WorkingDay {
  day: Weekday;
  enabled: boolean;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface StaffDraft {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  title: string;
  department: string;
  bio: string;
  qualifications: string[];
  specialisations: string[];
  licenceNumber: string;
  yearsOfExperience: number;
  isActive: boolean;
  isPubliclyVisible: boolean;
  maxConcurrentAppointments: number;
  services: { id: string }[];
  workingHours: WorkingDay[];
}

const DEFAULT_HOURS: WorkingDay[] = WEEKDAYS.map((day) => ({
  day,
  // A sensible Mon–Fri default; Saturday and Sunday off.
  enabled: day !== 'sunday' && day !== 'saturday',
  start: '08:00',
  end: '17:00',
  breakStart: '13:00',
  breakEnd: '14:00',
}));

export function StaffForm({
  staff,
  services,
}: {
  staff: StaffDraft | null;
  services: { id: string; name: string; categoryName: string }[];
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(saveStaffAction, INITIAL);

  const [hours, setHours] = useState<WorkingDay[]>(() => {
    if (!staff?.workingHours?.length) return DEFAULT_HOURS;
    // Fill any weekday the stored profile is missing.
    return WEEKDAYS.map(
      (day) =>
        staff.workingHours.find((entry) => entry.day === day) ?? {
          day,
          enabled: false,
          start: '08:00',
          end: '17:00',
        },
    );
  });

  useActionFeedback(state, {
    onSuccess: (result) =>
      router.push(result.data ? `/admin/staff/${result.data.id}` : '/admin/staff'),
  });

  const setDay = (index: number, patch: Partial<WorkingDay>) => {
    const next = [...hours];
    next[index] = { ...next[index], ...patch };
    setHours(next);
  };

  const selectedServices = new Set(staff?.services.map((service) => service.id) ?? []);

  return (
    <form action={formAction} className="space-y-5">
      {staff && <input type="hidden" name="staffId" value={staff.id} />}
      {/* The schedule table is submitted as one JSON field. */}
      <input type="hidden" name="workingHours" value={JSON.stringify(hours)} />

      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <div className="grid gap-5 lg:grid-cols-[1.7fr_1fr] lg:items-start">
        <div className="space-y-5">
          <Card title="Personal details">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Full name" required error={state.fieldErrors?.name?.[0]}>
                <Input name="name" defaultValue={staff?.name} required />
              </Field>

              <Field label="Phone" required error={state.fieldErrors?.phone?.[0]}>
                <Input name="phone" type="tel" defaultValue={staff?.phone} required />
              </Field>
            </div>

            <Field
              label="Email"
              required
              description="This is also their sign-in address."
              error={state.fieldErrors?.email?.[0]}
            >
              <Input name="email" type="email" defaultValue={staff?.email} required />
            </Field>

            <Field
              label={staff ? 'New password' : 'Initial password'}
              required={!staff}
              description={
                staff
                  ? 'Leave blank to keep the current password. Changing it signs them out everywhere.'
                  : 'Share this with the staff member so they can sign in and change it.'
              }
              error={state.fieldErrors?.password?.[0]}
            >
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
                required={!staff}
              />
            </Field>

            <ImageUpload
              name="avatar"
              folder="staff"
              label="Photograph"
              aspect="square"
              defaultValue={staff?.avatar}
              description="Shown on the public team page when the profile is visible."
            />
            {state.fieldErrors?.avatar?.[0] && (
              <p role="alert" className="text-xs font-medium text-destructive">
                {state.fieldErrors.avatar[0]}
              </p>
            )}
          </Card>

          <Card title="Professional profile">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Role" required error={state.fieldErrors?.title?.[0]}>
                <Select name="title" defaultValue={staff?.title ?? 'nurse'} required>
                  {STAFF_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {LABELS.staffRole[role]}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Department" required error={state.fieldErrors?.department?.[0]}>
                <Select name="department" defaultValue={staff?.department ?? 'nursing'} required>
                  {STAFF_DEPARTMENTS.map((department) => (
                    <option key={department} value={department}>
                      {LABELS.department[department]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field
              label="Biography"
              description="Shown on the public team page when the profile is visible."
              error={state.fieldErrors?.bio?.[0]}
            >
              <Textarea name="bio" defaultValue={staff?.bio} rows={4} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Licence number" error={state.fieldErrors?.licenceNumber?.[0]}>
                <Input name="licenceNumber" defaultValue={staff?.licenceNumber} />
              </Field>

              <Field label="Years of experience" error={state.fieldErrors?.yearsOfExperience?.[0]}>
                <Input
                  name="yearsOfExperience"
                  type="number"
                  min={0}
                  max={70}
                  defaultValue={staff?.yearsOfExperience || ''}
                />
              </Field>
            </div>

            <Field label="Qualifications" description="Separate with commas.">
              <Input
                name="qualifications"
                defaultValue={staff?.qualifications.join(', ')}
                placeholder="RN, BNSc Nursing Science, Wound Care Certification"
              />
            </Field>

            <Field label="Specialisations" description="Separate with commas.">
              <Input
                name="specialisations"
                defaultValue={staff?.specialisations.join(', ')}
                placeholder="Home nursing, Wound management"
              />
            </Field>
          </Card>

          <Card title="Working hours">
            <p className="text-xs text-muted-foreground">
              These hours drive the availability patients see. A day that is switched off offers no
              slots at all.
            </p>

            <div className="space-y-2">
              {hours.map((day, index) => (
                <div
                  key={day.day}
                  className="grid grid-cols-2 items-center gap-3 rounded-lg border border-border p-3 sm:grid-cols-[8rem_1fr_1fr_1fr_1fr]"
                >
                  <label className="flex items-center gap-2">
                    <Checkbox
                      checked={day.enabled}
                      onCheckedChange={(checked) => setDay(index, { enabled: checked === true })}
                      aria-label={`Working on ${day.day}`}
                    />
                    <span className="text-sm font-medium capitalize text-navy-800">{day.day}</span>
                  </label>

                  <TimeInput
                    label="Start"
                    value={day.start}
                    disabled={!day.enabled}
                    onChange={(value) => setDay(index, { start: value })}
                  />
                  <TimeInput
                    label="End"
                    value={day.end}
                    disabled={!day.enabled}
                    onChange={(value) => setDay(index, { end: value })}
                  />
                  <TimeInput
                    label="Break from"
                    value={day.breakStart ?? ''}
                    disabled={!day.enabled}
                    onChange={(value) => setDay(index, { breakStart: value })}
                  />
                  <TimeInput
                    label="Break to"
                    value={day.breakEnd ?? ''}
                    disabled={!day.enabled}
                    onChange={(value) => setDay(index, { breakEnd: value })}
                  />
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Services they can deliver">
            <p className="text-xs text-muted-foreground">
              A staff member only appears in availability for the services ticked here.
            </p>

            {services.length === 0 ? (
              <Alert variant="warning">
                No services exist yet. Create one before assigning staff.
              </Alert>
            ) : (
              <FieldSet legend="Assigned services" className="max-h-96 overflow-y-auto scrollbar-thin">
                <div className="space-y-1.5">
                  {services.map((service) => (
                    <label
                      key={service.id}
                      className="flex cursor-pointer items-start gap-2.5 rounded-lg p-2 hover:bg-secondary/60"
                    >
                      <Checkbox
                        name="serviceIds"
                        value={service.id}
                        defaultChecked={selectedServices.has(service.id)}
                        className="mt-0.5"
                      />
                      <span className="min-w-0">
                        <span className="block text-sm text-navy-800">{service.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {service.categoryName}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </FieldSet>
            )}
          </Card>

          <Card title="Availability settings">
            <Field
              label="Concurrent appointments"
              description="How many patients this person can hold in the same slot. Usually 1."
              error={state.fieldErrors?.maxConcurrentAppointments?.[0]}
            >
              <Input
                name="maxConcurrentAppointments"
                type="number"
                min={1}
                max={10}
                defaultValue={staff?.maxConcurrentAppointments ?? 1}
              />
            </Field>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span>
                <span className="block text-sm font-medium text-navy-800">Account active</span>
                <span className="block text-xs text-muted-foreground">
                  Inactive staff cannot sign in and take no bookings.
                </span>
              </span>
              <Switch name="isActive" defaultChecked={staff?.isActive ?? true} />
            </label>

            <label className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <span>
                <span className="block text-sm font-medium text-navy-800">Show on team page</span>
                <span className="block text-xs text-muted-foreground">
                  Lists them publicly at /team.
                </span>
              </span>
              <Switch name="isPubliclyVisible" defaultChecked={staff?.isPubliclyVisible ?? true} />
            </label>
          </Card>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border pt-5">
        <Button asChild variant="ghost">
          <Link href="/admin/staff">Cancel</Link>
        </Button>
        <SubmitButton size="lg" pendingLabel="Saving…">
          {staff ? 'Save changes' : 'Create staff member'}
        </SubmitButton>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h2 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
        {title}
      </h2>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}

function Select({
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { children: React.ReactNode }) {
  return (
    <select
      {...props}
      className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {children}
    </select>
  );
}

function TimeInput({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] text-muted-foreground">{label}</span>
      <Input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9"
      />
    </label>
  );
}
