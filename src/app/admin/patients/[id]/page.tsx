import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import { ArrowLeft, CalendarPlus, Mail, MapPin, Phone, Star } from 'lucide-react';
import { PatientStatusControl } from './status-control';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminPatient } from '@/lib/queries/admin';
import { calculateAge, cn, formatNaira, formatTimeLabel, initials } from '@/lib/utils';

export const metadata: Metadata = { title: 'Patient' };

export default async function AdminPatientPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin('patients.view');
  const { id } = await params;

  const patient = await getAdminPatient(id);
  if (!patient) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/patients"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All patients
        </Link>

        <div className="flex gap-2">
          {userCan(user, 'appointments.create') && (
            <Button asChild>
              <Link href={`/admin/appointments/new?patientId=${patient.id}`}>
                <CalendarPlus className="size-4" />
                Book for this patient
              </Link>
            </Button>
          )}
          {userCan(user, 'patients.delete') && (
            <PatientStatusControl patientId={patient.id} status={patient.status} />
          )}
        </div>
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-xl font-bold text-brand-700">
            {initials(patient.name)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
                {patient.name}
              </h2>
              <StatusBadge kind="user" status={patient.status} />
              {!patient.emailVerified && <Badge variant="warning">Email unverified</Badge>}
            </div>

            <p className="mt-1 font-mono text-sm text-muted-foreground">{patient.patientNumber}</p>

            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden />
                <dd>{patient.phone}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="size-3.5" aria-hidden />
                <dd className="break-all">{patient.email}</dd>
              </div>
              {patient.dateOfBirth && (
                <div className="flex items-center gap-1.5">
                  <dd>
                    {calculateAge(patient.dateOfBirth)} years old
                    {patient.gender && ` · ${patient.gender.replace(/_/g, ' ')}`}
                  </dd>
                </div>
              )}
              {patient.address?.city && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" aria-hidden />
                  <dd>
                    {[patient.address.area, patient.address.city].filter(Boolean).join(', ')}
                  </dd>
                </div>
              )}
            </dl>

            <div className="mt-4 flex flex-wrap gap-4 border-t border-border pt-4">
              <Figure label="Appointments" value={String(patient.totalAppointments)} />
              <Figure label="Total spent" value={formatNaira(patient.totalSpentKobo)} />
              <Figure
                label="Registered"
                value={format(new Date(patient.createdAt), 'd MMM yyyy')}
              />
              <Figure
                label="Last sign-in"
                value={
                  patient.lastLoginAt
                    ? format(new Date(patient.lastLoginAt), 'd MMM yyyy')
                    : 'Never'
                }
              />
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="clinical">
        <TabsList>
          <TabsTrigger value="clinical">Clinical</TabsTrigger>
          <TabsTrigger value="appointments">Appointments ({patient.bookings.length})</TabsTrigger>
          <TabsTrigger value="payments">Payments ({patient.payments.length})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({patient.reviews.length})</TabsTrigger>
          <TabsTrigger value="support">Support ({patient.tickets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="clinical">
          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Clinical background">
              <dl className="space-y-3 text-sm">
                <Row label="Blood group" value={patient.bloodGroup ?? '—'} />
                <Row
                  label="Allergies"
                  value={patient.allergies.length > 0 ? patient.allergies.join(', ') : 'None recorded'}
                  highlight={patient.allergies.length > 0}
                />
                <Row
                  label="Ongoing conditions"
                  value={
                    patient.chronicConditions.length > 0
                      ? patient.chronicConditions.join(', ')
                      : 'None recorded'
                  }
                />
                {patient.notes && <Row label="Internal notes" value={patient.notes} />}
              </dl>
            </Panel>

            <Panel title="Contact details">
              <dl className="space-y-3 text-sm">
                <Row
                  label="Address"
                  value={
                    patient.address
                      ? [
                          patient.address.street,
                          patient.address.area,
                          patient.address.city,
                          patient.address.state,
                        ]
                          .filter(Boolean)
                          .join(', ') || '—'
                      : '—'
                  }
                />
                {patient.address?.landmark && (
                  <Row label="Landmark" value={patient.address.landmark} />
                )}
                <Row
                  label="Emergency contact"
                  value={
                    patient.emergencyContact?.name
                      ? `${patient.emergencyContact.name}${
                          patient.emergencyContact.relationship
                            ? ` (${patient.emergencyContact.relationship})`
                            : ''
                        }${
                          patient.emergencyContact.phone
                            ? ` · ${patient.emergencyContact.phone}`
                            : ''
                        }`
                      : 'Not provided'
                  }
                />
              </dl>
            </Panel>
          </div>
        </TabsContent>

        <TabsContent value="appointments">
          <Panel title="Appointment history">
            {patient.bookings.length === 0 ? (
              <EmptyState title="No appointments" description="This patient has not booked yet." />
            ) : (
              <ul className="divide-y divide-border">
                {patient.bookings.map((booking) => (
                  <li key={booking.id}>
                    <Link
                      href={`/admin/appointments/${booking.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy-800">
                          {booking.serviceName}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          {booking.reference}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {format(new Date(booking.dateKey), 'd MMM yyyy')} ·{' '}
                          {formatTimeLabel(booking.startTime)}
                        </span>
                        <span className="whitespace-nowrap text-sm font-medium text-navy-800">
                          {formatNaira(booking.totalKobo)}
                        </span>
                        <StatusBadge kind="booking" status={booking.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="payments">
          <Panel title="Payment history">
            {patient.payments.length === 0 ? (
              <EmptyState title="No payments" description="No transactions on this account yet." />
            ) : (
              <ul className="divide-y divide-border">
                {patient.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="font-mono text-sm text-navy-800">{payment.reference}</p>
                      <p className="text-xs capitalize text-muted-foreground">
                        {payment.provider} ·{' '}
                        {format(new Date(payment.createdAt), 'd MMM yyyy, HH:mm')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="whitespace-nowrap text-sm font-medium text-navy-800">
                        {formatNaira(payment.amountKobo)}
                      </span>
                      <StatusBadge kind="payment" status={payment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="reviews">
          <Panel title="Reviews left by this patient">
            {patient.reviews.length === 0 ? (
              <EmptyState title="No reviews" description="This patient has not left a review." />
            ) : (
              <ul className="space-y-4">
                {patient.reviews.map((review) => (
                  <li key={review.id} className="rounded-lg border border-border p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="flex gap-0.5" aria-label={`${review.rating} out of 5`}>
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={cn(
                                'size-3.5',
                                i < review.rating
                                  ? 'fill-amber-400 text-amber-400'
                                  : 'text-slate-300',
                              )}
                              aria-hidden
                            />
                          ))}
                        </div>
                        <span className="text-sm font-medium text-navy-800">
                          {review.serviceName}
                        </span>
                      </div>
                      <StatusBadge kind="review" status={review.status} />
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">“{review.comment}”</p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="support">
          <Panel title="Support requests">
            {patient.tickets.length === 0 ? (
              <EmptyState
                title="No support requests"
                description="This patient has not contacted support."
              />
            ) : (
              <ul className="divide-y divide-border">
                {patient.tickets.map((ticket) => (
                  <li
                    key={ticket.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-800">
                        {ticket.subject}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{ticket.reference}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(ticket.updatedAt), 'd MMM yyyy')}
                      </span>
                      <Badge variant={ticket.status === 'resolved' ? 'success' : 'info'}>
                        {ticket.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
        {title}
      </h3>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Row({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-navy-800', highlight && 'font-semibold text-amber-700')}>
        {value}
      </dd>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-navy-800">{value}</p>
    </div>
  );
}
