'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  Clock,
  CreditCard,
  Home,
  Video,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { Alert } from '@/components/ui/feedback';
import { ServiceIcon } from '@/components/public/service-icon';
import { BookingDatePicker } from '@/components/booking/date-picker';
import { SlotPicker } from '@/components/booking/slot-picker';
import { cn, formatNaira, formatTimeLabel } from '@/lib/utils';
import { LABELS, type LocationType, type ServiceType, type TimeSlot } from '@/types';
import type { PublicService } from '@/lib/queries/public';
import type { BookingPrefill } from './page';

/**
 * Eight-step booking flow.
 *
 * The wizard holds *selections*, not truths: every price shown is recomputed
 * server-side at creation, and the slot grid is fetched from the availability
 * API rather than generated here. If the server disagrees with what the
 * patient sees, the server wins and the patient is told why.
 */

type Step = 'service' | 'location' | 'date' | 'time' | 'details' | 'summary' | 'payment' | 'done';

const STEP_ORDER: Step[] = [
  'service',
  'location',
  'date',
  'time',
  'details',
  'summary',
  'payment',
];

const STEP_LABELS: Record<Step, string> = {
  service: 'Service',
  location: 'Location',
  date: 'Date',
  time: 'Time',
  details: 'Your details',
  summary: 'Summary',
  payment: 'Payment',
  done: 'Confirmed',
};

const LOCATION_META: Record<LocationType, { icon: typeof Home; blurb: string }> = {
  clinic: { icon: Building2, blurb: 'Visit us at 14 Aba Road, GRA Phase 2, Port Harcourt.' },
  home: { icon: Home, blurb: 'We come to your address anywhere in Port Harcourt.' },
  virtual: { icon: Video, blurb: 'Join by video link — no travel needed.' },
};

interface ContactState {
  name: string;
  phone: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  street: string;
  area: string;
  city: string;
  state: string;
  landmark: string;
  emergencyName: string;
  emergencyPhone: string;
  emergencyRelationship: string;
  notes: string;
}

const EMPTY_CONTACT: ContactState = {
  name: '',
  phone: '',
  email: '',
  dateOfBirth: '',
  gender: '',
  street: '',
  area: '',
  city: 'Port Harcourt',
  state: 'Rivers',
  landmark: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelationship: '',
  notes: '',
};

export function BookingWizard({
  services,
  preselectedSlug,
  isSignedIn,
  prefill,
  cancellationPolicy,
  maximumAdvanceDays,
}: {
  services: PublicService[];
  preselectedSlug?: string;
  isSignedIn: boolean;
  prefill: BookingPrefill | null;
  cancellationPolicy: string;
  maximumAdvanceDays: number;
}) {
  const router = useRouter();

  const preselected = preselectedSlug
    ? (services.find((service) => service.slug === preselectedSlug) ?? null)
    : null;

  const [step, setStep] = useState<Step>(preselected ? 'location' : 'service');
  const [service, setService] = useState<PublicService | null>(preselected);
  const [locationType, setLocationType] = useState<LocationType | null>(null);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);
  /* Seeded from the signed-in patient's profile so they retype nothing.
     A lazy initialiser rather than an effect: the prefill arrives with the
     first render and never changes afterwards. */
  const [contact, setContact] = useState<ContactState>(() =>
    prefill
      ? {
          ...EMPTY_CONTACT,
          name: prefill.name ?? '',
          email: prefill.email ?? '',
          phone: prefill.phone ?? '',
          dateOfBirth: prefill.dateOfBirth ?? '',
          gender: prefill.gender ?? '',
          street: prefill.address?.street ?? '',
          area: prefill.address?.area ?? '',
          city: prefill.address?.city || 'Port Harcourt',
          state: prefill.address?.state || 'Rivers',
          landmark: prefill.address?.landmark ?? '',
          emergencyName: prefill.emergencyContact?.name ?? '',
          emergencyPhone: prefill.emergencyContact?.phone ?? '',
          emergencyRelationship: prefill.emergencyContact?.relationship ?? '',
        }
      : EMPTY_CONTACT,
  );
  const [promoCode, setPromoCode] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<{
    bookingId: string;
    reference: string;
    requiresPayment: boolean;
    amountDueKobo: number;
  } | null>(null);

  const locations = useMemo<LocationType[]>(() => {
    if (!service) return [];
    if (service.serviceType === 'hybrid') return ['clinic', 'home'];
    return [service.serviceType as LocationType];
  }, [service]);

  const totals = useMemo(() => {
    if (!service) return { base: 0, surcharge: 0, total: 0 };
    const surcharge = locationType === 'home' ? service.homeVisitSurchargeKobo : 0;
    return {
      base: service.priceKobo,
      surcharge,
      total: service.priceKobo + surcharge,
    };
  }, [service, locationType]);

  const goTo = (next: Step) => {
    setError(null);
    setStep(next);
    // Long forms scroll the user past the heading; bring them back up.
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const back = () => {
    const index = STEP_ORDER.indexOf(step);
    if (index > 0) goTo(STEP_ORDER[index - 1]);
  };

  /* ── Submit ─────────────────────────────────────────────────────── */

  const submit = async () => {
    if (!service || !locationType || !dateKey || !slot) return;

    if (!isSignedIn) {
      router.push(`/login?next=${encodeURIComponent(`/book?service=${service.slug}`)}`);
      return;
    }

    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: service.id,
          locationType,
          dateKey,
          startTime: slot.start,
          contact: {
            name: contact.name,
            phone: contact.phone,
            email: contact.email,
            dateOfBirth: contact.dateOfBirth || undefined,
            gender: contact.gender || undefined,
          },
          address:
            locationType === 'home'
              ? {
                  street: contact.street,
                  area: contact.area || undefined,
                  city: contact.city,
                  state: contact.state,
                  landmark: contact.landmark || undefined,
                }
              : undefined,
          emergencyContact: contact.emergencyName
            ? {
                name: contact.emergencyName,
                phone: contact.emergencyPhone || undefined,
                relationship: contact.emergencyRelationship || undefined,
              }
            : undefined,
          notes: contact.notes || undefined,
          promotionCode: promoCode.trim() || undefined,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        if (payload.fieldErrors) {
          const flattened: Record<string, string> = {};
          for (const [key, messages] of Object.entries(
            payload.fieldErrors as Record<string, string[]>,
          )) {
            flattened[key] = messages[0];
          }
          setFieldErrors(flattened);
          setError(payload.error ?? 'Please check your details and try again.');
          goTo('details');
          return;
        }

        setError(payload.error ?? 'We could not create your booking.');

        // The slot went while the patient was filling the form — send them
        // back to pick another rather than leaving them stuck.
        if (payload.code === 'SLOT_TAKEN') {
          setSlot(null);
          goTo('time');
        }
        return;
      }

      setResult(payload);

      if (payload.requiresPayment) {
        goTo('payment');
      } else {
        goTo('done');
      }
    } catch {
      setError('We could not reach the booking service. Please check your connection.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Payment hand-off ───────────────────────────────────────────── */

  const startPayment = async () => {
    if (!result) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/payments/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: result.bookingId }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setError(payload.error ?? 'We could not start the payment.');
        return;
      }

      // Hand off to the gateway's hosted page. We never handle card details.
      window.location.href = payload.authorizationUrl;
    } catch {
      setError('We could not reach the payment service. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="mx-auto max-w-4xl">
      {step !== 'done' && <Stepper current={step} />}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
          {error && (
            <Alert variant="error" className="mb-6">
              {error}
            </Alert>
          )}

          {step === 'service' && (
            <StepService
              services={services}
              selected={service}
              onSelect={(chosen) => {
                setService(chosen);
                setLocationType(null);
                setSlot(null);
                setDateKey(null);
                goTo('location');
              }}
            />
          )}

          {step === 'location' && service && (
            <StepLocation
              service={service}
              locations={locations}
              selected={locationType}
              onSelect={(chosen) => {
                setLocationType(chosen);
                setSlot(null);
                goTo('date');
              }}
              onBack={back}
            />
          )}

          {step === 'date' && (
            <StepDate
              selected={dateKey}
              maximumAdvanceDays={maximumAdvanceDays}
              onSelect={(chosen) => {
                setDateKey(chosen);
                setSlot(null);
                goTo('time');
              }}
              onBack={back}
            />
          )}

          {step === 'time' && dateKey && service && locationType && (
            <StepTime
              serviceId={service.id}
              locationType={locationType}
              dateKey={dateKey}
              selected={slot}
              onSelect={(chosen) => {
                setSlot(chosen);
                goTo('details');
              }}
              onChangeDate={() => goTo('date')}
              onBack={back}
            />
          )}

          {step === 'details' && (
            <StepDetails
              contact={contact}
              setContact={setContact}
              locationType={locationType}
              errors={fieldErrors}
              onContinue={() => goTo('summary')}
              onBack={back}
            />
          )}

          {step === 'summary' && service && locationType && dateKey && slot && (
            <StepSummary
              service={service}
              locationType={locationType}
              dateKey={dateKey}
              slot={slot}
              contact={contact}
              totals={totals}
              promoCode={promoCode}
              setPromoCode={setPromoCode}
              cancellationPolicy={cancellationPolicy}
              isSignedIn={isSignedIn}
              submitting={submitting}
              onSubmit={submit}
              onBack={back}
            />
          )}

          {step === 'payment' && result && (
            <StepPayment
              reference={result.reference}
              amountKobo={result.amountDueKobo}
              submitting={submitting}
              onPay={startPayment}
              bookingId={result.bookingId}
            />
          )}

          {step === 'done' && result && (
            <StepDone reference={result.reference} bookingId={result.bookingId} />
          )}
        </div>

        {step !== 'done' && (
          <SummaryPanel
            service={service}
            locationType={locationType}
            dateKey={dateKey}
            slot={slot}
            totals={totals}
          />
        )}
      </div>
    </div>
  );
}

/* ── Stepper ──────────────────────────────────────────────────────── */

function Stepper({ current }: { current: Step }) {
  const index = STEP_ORDER.indexOf(current);

  return (
    <nav aria-label="Booking progress">
      {/* Compact progress on small screens; full trail from sm up. */}
      <div className="sm:hidden">
        <p className="text-sm font-medium text-navy-800">
          Step {index + 1} of {STEP_ORDER.length} · {STEP_LABELS[current]}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${((index + 1) / STEP_ORDER.length) * 100}%` }}
          />
        </div>
      </div>

      <ol className="hidden items-center gap-1 sm:flex">
        {STEP_ORDER.map((step, i) => {
          const done = i < index;
          const active = i === index;

          return (
            <li key={step} className="flex flex-1 items-center gap-1">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    done && 'bg-crimson-600 text-white',
                    active && 'bg-primary text-primary-foreground',
                    !done && !active && 'bg-secondary text-muted-foreground',
                  )}
                  aria-current={active ? 'step' : undefined}
                >
                  {done ? <Check className="size-3.5" aria-hidden /> : i + 1}
                </span>
                <span
                  className={cn(
                    'hidden whitespace-nowrap text-xs font-medium lg:block',
                    active ? 'text-navy-800' : 'text-muted-foreground',
                  )}
                >
                  {STEP_LABELS[step]}
                </span>
              </div>
              {i < STEP_ORDER.length - 1 && (
                <span
                  className={cn('h-px flex-1 transition-colors', done ? 'bg-crimson-600' : 'bg-border')}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/* ── Step 1: service ──────────────────────────────────────────────── */

function StepService({
  services,
  selected,
  onSelect,
}: {
  services: PublicService[];
  selected: PublicService | null;
  onSelect: (service: PublicService) => void;
}) {
  const [query, setQuery] = useState('');

  const filtered = query
    ? services.filter(
        (service) =>
          service.name.toLowerCase().includes(query.toLowerCase()) ||
          service.category?.name.toLowerCase().includes(query.toLowerCase()),
      )
    : services;

  return (
    <div>
      <StepHeading title="Which service do you need?" description="Pick one to get started." />

      <Input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search services…"
        aria-label="Search services"
        className="mt-5"
      />

      <div className="mt-4 grid max-h-[28rem] gap-2 overflow-y-auto pr-1 scrollbar-thin">
        {filtered.map((service) => (
          <button
            key={service.id}
            type="button"
            onClick={() => onSelect(service)}
            className={cn(
              'flex items-start gap-4 rounded-xl border p-4 text-left transition-all',
              selected?.id === service.id
                ? 'border-primary bg-brand-50/60 ring-1 ring-primary'
                : 'border-border hover:border-brand-300 hover:bg-secondary/50',
            )}
          >
            <ServiceIcon icon={service.icon} accent={service.category?.accent ?? 'crimson'} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-navy-800">{service.name}</span>
              <span className="mt-0.5 block line-clamp-1 text-xs text-muted-foreground">
                {service.shortDescription}
              </span>
              <span className="mt-1.5 block text-xs text-muted-foreground">
                {service.durationMinutes} mins ·{' '}
                {LABELS.serviceType[service.serviceType as ServiceType]}
              </span>
            </span>
            <span className="shrink-0 text-sm font-bold text-navy-800">
              {formatNaira(service.priceKobo)}
            </span>
          </button>
        ))}

        {filtered.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No services match “{query}”.
          </p>
        )}
      </div>
    </div>
  );
}

/* ── Step 2: location ─────────────────────────────────────────────── */

function StepLocation({
  service,
  locations,
  selected,
  onSelect,
  onBack,
}: {
  service: PublicService;
  locations: LocationType[];
  selected: LocationType | null;
  onSelect: (location: LocationType) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="Where would you like this?"
        description={`${service.name} is available at the options below.`}
      />

      <div className="mt-6 grid gap-3">
        {locations.map((location) => {
          const meta = LOCATION_META[location];
          const surcharge = location === 'home' ? service.homeVisitSurchargeKobo : 0;

          return (
            <button
              key={location}
              type="button"
              onClick={() => onSelect(location)}
              className={cn(
                'flex items-start gap-4 rounded-xl border p-5 text-left transition-all',
                selected === location
                  ? 'border-primary bg-brand-50/60 ring-1 ring-primary'
                  : 'border-border hover:border-brand-300 hover:bg-secondary/50',
              )}
            >
              <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600">
                <meta.icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <span className="flex-1">
                <span className="block text-sm font-semibold text-navy-800">
                  {LABELS.locationType[location]}
                </span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{meta.blurb}</span>
              </span>
              {surcharge > 0 && (
                <span className="shrink-0 text-xs font-medium text-amber-700">
                  +{formatNaira(surcharge)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <StepNav onBack={onBack} />
    </div>
  );
}

/* ── Step 3: date ─────────────────────────────────────────────────── */

function StepDate({
  selected,
  maximumAdvanceDays,
  onSelect,
  onBack,
}: {
  selected: string | null;
  maximumAdvanceDays: number;
  onSelect: (dateKey: string) => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="Pick a date"
        description={`You can book up to ${maximumAdvanceDays} days ahead.`}
      />

      <div className="mt-6">
        <BookingDatePicker
          selected={selected}
          maximumAdvanceDays={maximumAdvanceDays}
          onSelect={onSelect}
        />
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Availability for the date you pick is checked live in the next step.
      </p>

      <StepNav onBack={onBack} />
    </div>
  );
}

/* ── Step 4: time ─────────────────────────────────────────────────── */

function StepTime({
  serviceId,
  locationType,
  dateKey,
  selected,
  onSelect,
  onChangeDate,
  onBack,
}: {
  serviceId: string;
  locationType: LocationType;
  dateKey: string;
  selected: TimeSlot | null;
  onSelect: (slot: TimeSlot) => void;
  onChangeDate: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="Choose a time"
        description={format(new Date(dateKey), 'EEEE, d MMMM yyyy')}
      />

      <div className="mt-6">
        <SlotPicker
          serviceId={serviceId}
          dateKey={dateKey}
          locationType={locationType}
          selected={selected?.start ?? null}
          onSelect={onSelect}
        />
      </div>

      <Button type="button" variant="outline" className="mt-5" onClick={onChangeDate}>
        <CalendarDays className="size-4" />
        Pick another date
      </Button>

      <StepNav onBack={onBack} />
    </div>
  );
}

/* ── Step 5: details ──────────────────────────────────────────────── */

function StepDetails({
  contact,
  setContact,
  locationType,
  errors,
  onContinue,
  onBack,
}: {
  contact: ContactState;
  setContact: React.Dispatch<React.SetStateAction<ContactState>>;
  locationType: LocationType | null;
  errors: Record<string, string>;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [localErrors, setLocalErrors] = useState<Record<string, string>>({});
  const set = (key: keyof ContactState) => (event: { target: { value: string } }) =>
    setContact((current) => ({ ...current, [key]: event.target.value }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (contact.name.trim().length < 2) next.name = 'Enter the patient name';
    if (!/^\S+@\S+\.\S+$/.test(contact.email)) next.email = 'Enter a valid email address';

    const digits = contact.phone.replace(/\D/g, '');
    if (!/^(0\d{10}|234\d{10})$/.test(digits)) {
      next.phone = 'Enter a valid Nigerian phone number';
    }
    if (locationType === 'home' && contact.street.trim().length < 3) {
      next.street = 'Enter the street address for the visit';
    }

    setLocalErrors(next);
    if (Object.keys(next).length === 0) onContinue();
  };

  const errorFor = (key: string) => localErrors[key] ?? errors[key] ?? errors[`contact.${key}`];

  return (
    <div>
      <StepHeading
        title="Who is this appointment for?"
        description="We only ask for what we need to deliver the service safely."
      />

      <div className="mt-6 space-y-5">
        <Field label="Full name" required error={errorFor('name')}>
          <Input value={contact.name} onChange={set('name')} autoComplete="name" />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Phone number" required error={errorFor('phone')}>
            <Input
              value={contact.phone}
              onChange={set('phone')}
              type="tel"
              autoComplete="tel"
              placeholder="0803 123 4567"
            />
          </Field>

          <Field label="Email address" required error={errorFor('email')}>
            <Input
              value={contact.email}
              onChange={set('email')}
              type="email"
              autoComplete="email"
            />
          </Field>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date of birth" error={errorFor('dateOfBirth')}>
            <Input value={contact.dateOfBirth} onChange={set('dateOfBirth')} type="date" />
          </Field>

          <Field label="Gender" error={errorFor('gender')}>
            <select
              value={contact.gender}
              onChange={set('gender')}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Prefer not to say</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </select>
          </Field>
        </div>

        {locationType === 'home' && (
          <fieldset className="space-y-5 rounded-xl border border-border p-5">
            <legend className="px-1 text-sm font-semibold text-navy-800">Visit address</legend>

            <Field label="Street address" required error={errorFor('street')}>
              <Input
                value={contact.street}
                onChange={set('street')}
                autoComplete="street-address"
                placeholder="24 Aba Road"
              />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Area / district">
                <Input value={contact.area} onChange={set('area')} placeholder="GRA Phase 2" />
              </Field>
              <Field label="City" required>
                <Input value={contact.city} onChange={set('city')} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="State" required>
                <Input value={contact.state} onChange={set('state')} />
              </Field>
              <Field label="Landmark" description="Helps our team find you quickly.">
                <Input
                  value={contact.landmark}
                  onChange={set('landmark')}
                  placeholder="Opposite the filling station"
                />
              </Field>
            </div>
          </fieldset>
        )}

        <fieldset className="space-y-5 rounded-xl border border-border p-5">
          <legend className="px-1 text-sm font-semibold text-navy-800">
            Emergency contact <span className="font-normal text-muted-foreground">(optional)</span>
          </legend>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Name">
              <Input value={contact.emergencyName} onChange={set('emergencyName')} />
            </Field>
            <Field label="Phone">
              <Input value={contact.emergencyPhone} onChange={set('emergencyPhone')} type="tel" />
            </Field>
          </div>

          <Field label="Relationship">
            <Input
              value={contact.emergencyRelationship}
              onChange={set('emergencyRelationship')}
              placeholder="Spouse, sibling, child…"
            />
          </Field>
        </fieldset>

        <Field
          label="Anything we should know?"
          description="Access instructions, mobility needs, or anything else useful."
        >
          <Textarea value={contact.notes} onChange={set('notes')} rows={3} />
        </Field>
      </div>

      <StepNav onBack={onBack}>
        <Button type="button" onClick={validate}>
          Review booking
          <ArrowRight className="size-4" />
        </Button>
      </StepNav>
    </div>
  );
}

/* ── Step 6: summary ──────────────────────────────────────────────── */

function StepSummary({
  service,
  locationType,
  dateKey,
  slot,
  contact,
  totals,
  promoCode,
  setPromoCode,
  cancellationPolicy,
  isSignedIn,
  submitting,
  onSubmit,
  onBack,
}: {
  service: PublicService;
  locationType: LocationType;
  dateKey: string;
  slot: TimeSlot;
  contact: ContactState;
  totals: { base: number; surcharge: number; total: number };
  promoCode: string;
  setPromoCode: (value: string) => void;
  cancellationPolicy: string;
  isSignedIn: boolean;
  submitting: boolean;
  onSubmit: () => void;
  onBack: () => void;
}) {
  return (
    <div>
      <StepHeading
        title="Check everything over"
        description="Nothing is charged until you confirm on the next step."
      />

      <dl className="mt-6 divide-y divide-border rounded-xl border border-border">
        <Row label="Service" value={service.name} />
        <Row label="Where" value={LABELS.locationType[locationType]} />
        <Row label="When" value={`${format(new Date(dateKey), 'EEEE, d MMMM yyyy')} at ${formatTimeLabel(slot.start)}`} />
        <Row label="Duration" value={`${service.durationMinutes} minutes`} />
        <Row label="Patient" value={contact.name} />
        <Row label="Contact" value={`${contact.phone} · ${contact.email}`} />
        {locationType === 'home' && (
          <Row
            label="Address"
            value={[contact.street, contact.area, contact.city, contact.state]
              .filter(Boolean)
              .join(', ')}
          />
        )}
        {contact.notes && <Row label="Notes" value={contact.notes} />}
      </dl>

      <div className="mt-6">
        <Field
          label="Promotion code"
          description="Applied and verified by our server when you confirm."
        >
          <Input
            value={promoCode}
            onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
            placeholder="e.g. WELCOME10"
            className="uppercase"
          />
        </Field>
      </div>

      <div className="mt-6 rounded-xl bg-secondary/60 p-5">
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">{service.name}</dt>
            <dd className="font-medium text-navy-800">{formatNaira(totals.base)}</dd>
          </div>
          {totals.surcharge > 0 && (
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Home visit surcharge</dt>
              <dd className="font-medium text-navy-800">{formatNaira(totals.surcharge)}</dd>
            </div>
          )}
          <div className="flex justify-between border-t border-border pt-2">
            <dt className="font-semibold text-navy-800">Total</dt>
            <dd className="font-display text-lg font-bold text-navy-800">
              {formatNaira(totals.total)}
            </dd>
          </div>
        </dl>
        {promoCode && (
          <p className="mt-3 text-xs text-muted-foreground">
            Any discount from <span className="font-semibold">{promoCode}</span> is applied and
            shown on your receipt once verified.
          </p>
        )}
      </div>

      <details className="mt-4 rounded-xl border border-border px-5 py-4">
        <summary className="cursor-pointer text-sm font-medium text-navy-800">
          Cancellation policy
        </summary>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{cancellationPolicy}</p>
      </details>

      {!isSignedIn && (
        <Alert variant="info" className="mt-4">
          You&apos;ll be asked to sign in before we can confirm this booking, so your appointment
          and receipts stay in one place.
        </Alert>
      )}

      <StepNav onBack={onBack}>
        <Button type="button" onClick={onSubmit} loading={submitting} size="lg">
          {isSignedIn ? 'Confirm and continue to payment' : 'Sign in to confirm'}
          {!submitting && <ArrowRight className="size-4" />}
        </Button>
      </StepNav>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-navy-800 sm:text-right">{value}</dd>
    </div>
  );
}

/* ── Step 7: payment ──────────────────────────────────────────────── */

function StepPayment({
  reference,
  amountKobo,
  submitting,
  onPay,
  bookingId,
}: {
  reference: string;
  amountKobo: number;
  submitting: boolean;
  onPay: () => void;
  bookingId: string;
}) {
  return (
    <div>
      <StepHeading
        title="Complete your payment"
        description={`Booking ${reference} is held for you while you pay.`}
      />

      <div className="mt-6 rounded-xl border border-border bg-secondary/50 p-6 text-center">
        <p className="text-sm text-muted-foreground">Amount due</p>
        <p className="mt-1 font-display text-3xl font-bold text-navy-800">
          {formatNaira(amountKobo)}
        </p>
      </div>

      <Button
        type="button"
        size="lg"
        className="mt-6 w-full"
        onClick={onPay}
        loading={submitting}
      >
        <CreditCard className="size-4" />
        Pay securely now
      </Button>

      <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
        <AlertCircle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        You&apos;ll be taken to our payment partner&apos;s secure page. We never see or store your
        card details.
      </p>

      <p className="mt-5 text-center text-sm text-muted-foreground">
        Prefer to pay later?{' '}
        <Link href={`/patient/appointments/${bookingId}`} className="font-medium text-primary hover:underline">
          View this booking in your dashboard
        </Link>
        .
      </p>
    </div>
  );
}

/* ── Step 8: confirmation ─────────────────────────────────────────── */

function StepDone({ reference, bookingId }: { reference: string; bookingId: string }) {
  return (
    <div className="py-6 text-center">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
        <Check className="size-7" strokeWidth={2.5} aria-hidden />
      </span>

      <h2 className="mt-5 font-display text-2xl font-bold tracking-tight text-navy-800">
        Your appointment is confirmed
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        We&apos;ve sent the details to your email. Reference{' '}
        <span className="font-semibold text-navy-800">{reference}</span>.
      </p>

      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href={`/patient/appointments/${bookingId}`}>View appointment</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/patient/dashboard">Go to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}

/* ── Shared ───────────────────────────────────────────────────────── */

function StepHeading({ title, description }: { title: string; description?: string }) {
  return (
    <div>
      <h2 className="font-display text-xl font-bold tracking-tight text-navy-800 sm:text-2xl">
        {title}
      </h2>
      {description && <p className="mt-1.5 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

function StepNav({ onBack, children }: { onBack: () => void; children?: React.ReactNode }) {
  return (
    <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
      <Button type="button" variant="ghost" onClick={onBack}>
        <ArrowLeft className="size-4" />
        Back
      </Button>
      {children}
    </div>
  );
}

/** Running summary, sticky beside the wizard on desktop. */
function SummaryPanel({
  service,
  locationType,
  dateKey,
  slot,
  totals,
}: {
  service: PublicService | null;
  locationType: LocationType | null;
  dateKey: string | null;
  slot: TimeSlot | null;
  totals: { base: number; surcharge: number; total: number };
}) {
  if (!service) {
    return (
      <aside className="hidden rounded-2xl border border-dashed border-border bg-secondary/40 p-6 lg:block">
        <p className="text-sm text-muted-foreground">
          Your booking summary will appear here as you go.
        </p>
      </aside>
    );
  }

  return (
    <aside className="rounded-2xl border border-border bg-card p-6 shadow-card lg:sticky lg:top-28">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your booking
      </p>

      <div className="mt-4 flex items-start gap-3">
        <ServiceIcon icon={service.icon} accent={service.category?.accent ?? 'crimson'} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-semibold text-navy-800">{service.name}</p>
          <p className="text-xs text-muted-foreground">{service.durationMinutes} minutes</p>
        </div>
      </div>

      <dl className="mt-5 space-y-3 border-t border-border pt-4 text-sm">
        {locationType && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Location</dt>
            <Building2 className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="text-navy-800">{LABELS.locationType[locationType]}</dd>
          </div>
        )}
        {dateKey && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Date</dt>
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="text-navy-800">{format(new Date(dateKey), 'EEE, d MMM yyyy')}</dd>
          </div>
        )}
        {slot && (
          <div className="flex items-center gap-2">
            <dt className="sr-only">Time</dt>
            <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <dd className="text-navy-800">{formatTimeLabel(slot.start)}</dd>
          </div>
        )}
      </dl>

      <div className="mt-5 space-y-1.5 border-t border-border pt-4 text-sm">
        <div className="flex justify-between text-muted-foreground">
          <span>Service</span>
          <span>{formatNaira(totals.base)}</span>
        </div>
        {totals.surcharge > 0 && (
          <div className="flex justify-between text-muted-foreground">
            <span>Home visit</span>
            <span>{formatNaira(totals.surcharge)}</span>
          </div>
        )}
        <div className="flex justify-between pt-1.5 font-semibold text-navy-800">
          <span>Total</span>
          <span className="font-display text-base">{formatNaira(totals.total)}</span>
        </div>
      </div>
    </aside>
  );
}
