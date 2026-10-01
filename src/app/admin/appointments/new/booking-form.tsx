'use client';

import { useActionState, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import { adminCreateBookingAction } from '../../actions/bookings';
import { BookingDatePicker } from '@/components/booking/date-picker';
import { SlotPicker } from '@/components/booking/slot-picker';
import { Field, FieldSet } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import { formatNaira, formatTimeLabel } from '@/lib/utils';
import { LABELS, type LocationType, type ServiceType, type TimeSlot } from '@/types';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useResetOnChange } from '@/hooks/use-synced-state';

const INITIAL: ActionResult<{ bookingId: string; reference: string }> = { ok: false };

interface ServiceOption {
  id: string;
  name: string;
  serviceType: string;
  priceKobo: number;
  homeVisitSurchargeKobo: number;
  durationMinutes: number;
}

export function AdminBookingForm({
  services,
  prefill,
}: {
  services: ServiceOption[];
  prefill: { name: string; email: string; phone: string } | null;
}) {
  const router = useRouter();
  const [state, formAction] = useActionState(adminCreateBookingAction, INITIAL);

  const [serviceId, setServiceId] = useState(services[0]?.id ?? '');
  const [locationType, setLocationType] = useState<LocationType | ''>('');
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);

  const service = services.find((item) => item.id === serviceId) ?? null;

  const locations = useMemo<LocationType[]>(() => {
    if (!service) return [];
    if (service.serviceType === 'hybrid') return ['clinic', 'home'];
    return [service.serviceType as LocationType];
  }, [service]);

  // Changing the service invalidates the location and time chosen under the
  // previous one. Reset during render so the form never shows a combination
  // the availability engine would reject.
  useResetOnChange(serviceId, () => {
    setLocationType(locations.length === 1 ? locations[0] : '');
    setSlot(null);
  });

  useActionFeedback(state, {
    onSuccess: (result) =>
      router.push(
        result.data ? `/admin/appointments/${result.data.bookingId}` : '/admin/appointments',
      ),
  });

  const total =
    service && locationType
      ? service.priceKobo + (locationType === 'home' ? service.homeVisitSurchargeKobo : 0)
      : 0;

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="dateKey" value={dateKey ?? ''} />
      <input type="hidden" name="startTime" value={slot?.start ?? ''} />

      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <Card title="Service and location">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Service" required error={state.fieldErrors?.serviceId?.[0]}>
            <select
              name="serviceId"
              value={serviceId}
              onChange={(event) => setServiceId(event.target.value)}
              required
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {services.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {formatNaira(option.priceKobo)}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Location" required error={state.fieldErrors?.locationType?.[0]}>
            <select
              name="locationType"
              value={locationType}
              onChange={(event) => {
                setLocationType(event.target.value as LocationType);
                setSlot(null);
              }}
              required
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Choose a location</option>
              {locations.map((location) => (
                <option key={location} value={location}>
                  {LABELS.locationType[location]}
                </option>
              ))}
            </select>
          </Field>
        </div>

        {service && (
          <p className="text-xs text-muted-foreground">
            {service.durationMinutes} minutes ·{' '}
            {LABELS.serviceType[service.serviceType as ServiceType]}
            {total > 0 && ` · total ${formatNaira(total)}`}
          </p>
        )}
      </Card>

      {serviceId && locationType && (
        <Card title="Date and time">
          <BookingDatePicker
            selected={dateKey}
            maximumAdvanceDays={365}
            onSelect={(chosen) => {
              setDateKey(chosen);
              setSlot(null);
            }}
          />

          {dateKey && (
            <div className="border-t border-border pt-4">
              <p className="mb-3 text-xs text-muted-foreground">
                {format(new Date(dateKey), 'EEEE, d MMMM yyyy')}
              </p>
              <SlotPicker
                serviceId={serviceId}
                dateKey={dateKey}
                locationType={locationType as LocationType}
                selected={slot?.start ?? null}
                onSelect={setSlot}
              />
            </div>
          )}
        </Card>
      )}

      <Card title="Patient details">
        <p className="text-xs text-muted-foreground">
          If no account exists for this email, one is created automatically so the patient still
          gets their dashboard, receipts and reminders.
        </p>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Full name" required error={state.fieldErrors?.name?.[0]}>
            <Input name="name" defaultValue={prefill?.name} required />
          </Field>
          <Field label="Phone number" required error={state.fieldErrors?.phone?.[0]}>
            <Input name="phone" type="tel" defaultValue={prefill?.phone} required />
          </Field>
        </div>

        <Field label="Email address" required error={state.fieldErrors?.email?.[0]}>
          <Input name="email" type="email" defaultValue={prefill?.email} required />
        </Field>

        {locationType === 'home' && (
          <FieldSet legend="Visit address" description="Required for home visits.">
            <Field label="Street address" required error={state.fieldErrors?.street?.[0]}>
              <Input name="street" required />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Area / district">
                <Input name="area" placeholder="GRA Phase 2" />
              </Field>
              <Field label="City" required>
                <Input name="city" defaultValue="Port Harcourt" required />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="State" required>
                <Input name="state" defaultValue="Rivers" required />
              </Field>
              <Field label="Landmark">
                <Input name="landmark" />
              </Field>
            </div>
          </FieldSet>
        )}

        <Field label="Notes" description="Access instructions, mobility needs, anything useful.">
          <Textarea name="notes" rows={3} />
        </Field>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <p className="text-sm text-muted-foreground">
          {slot && dateKey ? (
            <>
              Booking for{' '}
              <span className="font-medium text-navy-800">
                {format(new Date(dateKey), 'd MMM yyyy')} at {formatTimeLabel(slot.start)}
              </span>
              {total > 0 && <> · {formatNaira(total)}</>}
            </>
          ) : (
            'Choose a service, location, date and time to continue.'
          )}
        </p>

        <div className="flex gap-2">
          <Button asChild variant="ghost">
            <Link href="/admin/appointments">Cancel</Link>
          </Button>
          <SubmitButton disabled={!slot || !dateKey} size="lg" pendingLabel="Creating…">
            Create appointment
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
        {title}
      </h3>
      <div className="space-y-5 p-5">{children}</div>
    </section>
  );
}
