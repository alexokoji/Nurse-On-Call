import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { CalendarDays, CalendarPlus, MapPin, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/feedback';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientBookings } from '@/lib/queries/patient';
import { formatNaira, formatTimeLabel, cn } from '@/lib/utils';
import { LABELS, type LocationType } from '@/types';

export const metadata: Metadata = { title: 'My Appointments' };

const FILTERS = [
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'past', label: 'Past' },
  { key: 'all', label: 'All' },
] as const;

export default async function PatientAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const user = await requirePatient();
  const { filter } = await searchParams;

  const active = (FILTERS.find((f) => f.key === filter)?.key ?? 'upcoming') as
    | 'upcoming'
    | 'past'
    | 'all';

  const bookings = await getPatientBookings(user.id, { status: active });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">
            My appointments
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Everything you have booked, past and upcoming.
          </p>
        </div>
        <Button asChild>
          <Link href="/book">
            <CalendarPlus className="size-4" />
            Book a service
          </Link>
        </Button>
      </div>

      {/* Filter tabs — real links, so the view is shareable. */}
      <nav className="flex gap-1 overflow-x-auto rounded-lg bg-secondary p-1 scrollbar-thin" aria-label="Filter appointments">
        {FILTERS.map((item) => (
          <Link
            key={item.key}
            href={`/patient/appointments?filter=${item.key}`}
            aria-current={active === item.key ? 'page' : undefined}
            className={cn(
              'whitespace-nowrap rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              active === item.key
                ? 'bg-background text-navy-800 shadow-sm'
                : 'text-muted-foreground hover:text-navy-800',
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {bookings.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={
            active === 'upcoming'
              ? 'No upcoming appointments'
              : active === 'past'
                ? 'No past appointments'
                : 'No appointments yet'
          }
          description="When you book a service it will appear here with everything you need."
          action={{ label: 'Book a service', href: '/book' }}
        />
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <Link
                href={`/patient/appointments/${booking.id}`}
                className="block rounded-xl border border-border bg-card p-5 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-navy-800">
                      {booking.serviceName}
                    </h2>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {booking.reference}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge kind="booking" status={booking.status} dot />
                    <span className="text-sm font-semibold text-navy-800">
                      {formatNaira(booking.totalKobo)}
                    </span>
                  </div>
                </div>

                <dl className="mt-4 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-4 shrink-0" aria-hidden />
                    <dt className="sr-only">When</dt>
                    <dd>
                      {format(new Date(booking.dateKey), 'd MMM yyyy')} ·{' '}
                      {formatTimeLabel(booking.startTime)}
                    </dd>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="size-4 shrink-0" aria-hidden />
                    <dt className="sr-only">Where</dt>
                    <dd className="truncate">
                      {LABELS.locationType[booking.locationType as LocationType]}
                    </dd>
                  </div>
                  {booking.staffName && (
                    <div className="flex items-center gap-2">
                      <User className="size-4 shrink-0" aria-hidden />
                      <dt className="sr-only">With</dt>
                      <dd className="truncate">{booking.staffName}</dd>
                    </div>
                  )}
                </dl>

                {booking.status === 'pending_payment' && (
                  <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                    Awaiting payment — open this appointment to complete it.
                  </p>
                )}

                {booking.status === 'completed' && !booking.hasReview && (
                  <p className="mt-4 rounded-lg bg-brand-50 px-3 py-2 text-xs font-medium text-brand-800">
                    How did it go? Leave a review to help other patients.
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
