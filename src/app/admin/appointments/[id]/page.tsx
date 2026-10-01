import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  Mail,
  MapPin,
  Phone,
  Receipt,
  User,
} from 'lucide-react';
import { AppointmentAdminActions } from './admin-actions';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminBooking, getStaffForService } from '@/lib/queries/admin';
import { formatNaira, formatTimeLabel } from '@/lib/utils';
import { LABELS } from '@/types';

export const metadata: Metadata = { title: 'Appointment' };

export default async function AdminAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireAdmin('appointments.view');
  const { id } = await params;

  const booking = await getAdminBooking(id);
  if (!booking) notFound();

  const eligibleStaff = await getStaffForService(booking.serviceId);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/appointments"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All appointments
        </Link>

        {userCan(user, 'patients.view') && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/patients/${booking.patientId}`}>
              <User className="size-4" />
              View patient
            </Link>
          </Button>
        )}
      </div>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
                {booking.serviceName}
              </h2>
              <StatusBadge kind="booking" status={booking.status} dot />
              {!booking.isPaid && booking.status !== 'cancelled' && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                  Unpaid
                </span>
              )}
            </div>
            <p className="mt-1 font-mono text-sm text-muted-foreground">
              {booking.reference} · created {format(new Date(booking.createdAt), 'd MMM yyyy')}
            </p>
          </div>

          <div className="text-right">
            <p className="font-display text-2xl font-bold text-navy-800">
              {formatNaira(booking.totalKobo)}
            </p>
            {booking.invoiceNumber && (
              <p className="mt-0.5 flex items-center justify-end gap-1 font-mono text-xs text-muted-foreground">
                <Receipt className="size-3" aria-hidden />
                {booking.invoiceNumber}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Detail
            icon={CalendarDays}
            label="Date"
            value={format(new Date(booking.dateKey), 'EEEE, d MMM yyyy')}
          />
          <Detail
            icon={Clock}
            label="Time"
            value={`${formatTimeLabel(booking.startTime)} – ${formatTimeLabel(booking.endTime)}`}
          />
          <Detail
            icon={MapPin}
            label="Location"
            value={LABELS.locationType[booking.locationType]}
          />
          <Detail
            icon={User}
            label="Assigned to"
            value={booking.staffName ?? 'Unassigned'}
          />
        </dl>

        {booking.address && (
          <p className="mt-5 rounded-lg bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-navy-800">Visit address:</span> {booking.address}
            {booking.landmark && (
              <span className="mt-1 block text-xs">Landmark: {booking.landmark}</span>
            )}
          </p>
        )}

        {booking.notes && (
          <p className="mt-3 rounded-lg bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-navy-800">Patient notes:</span> {booking.notes}
          </p>
        )}

        {booking.cancellationReason && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="font-medium">Cancellation reason:</span> {booking.cancellationReason}
          </p>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-5">
          <AppointmentAdminActions
            bookingId={booking.id}
            status={booking.status}
            isPaid={booking.isPaid}
            currentStaffId={booking.staffId}
            eligibleStaff={eligibleStaff}
            serviceId={booking.serviceId}
            locationType={booking.locationType}
            amountKobo={booking.totalKobo}
            payments={booking.payments.map((payment) => ({
              id: payment.id,
              reference: payment.reference,
              status: payment.status,
              amountPaidKobo: payment.amountPaidKobo,
              refundedKobo: payment.refundedKobo,
            }))}
            permissions={user.permissions}
            isSuperAdmin={user.role === 'super_admin'}
          />

          {/* Payments */}
          <section id="payments" className="rounded-xl border border-border bg-card shadow-card">
            <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
              Payments
            </h3>
            <div className="p-5">
              {booking.payments.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No payment attempts recorded.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {booking.payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="flex flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-navy-800">{payment.reference}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {payment.provider}
                          {payment.channel && ` · ${payment.channel.replace(/_/g, ' ')}`} ·{' '}
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
            </div>
          </section>

          {booking.review && (
            <section className="rounded-xl border border-border bg-card shadow-card">
              <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
                Patient review
              </h3>
              <div className="p-5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-navy-800">
                    {booking.review.rating} / 5
                  </span>
                  <StatusBadge kind="review" status={booking.review.status} />
                </div>
                <blockquote className="mt-2 text-sm text-muted-foreground">
                  “{booking.review.comment}”
                </blockquote>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-5">
          {/* Patient */}
          <section className="rounded-xl border border-border bg-card shadow-card">
            <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
              Patient
            </h3>
            <dl className="space-y-3 p-5 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Name</dt>
                <dd className="mt-0.5 font-medium text-navy-800">{booking.contact.name}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Patient number</dt>
                <dd className="mt-0.5 font-mono text-xs text-navy-800">{booking.patientNumber}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <dt className="sr-only">Phone</dt>
                <dd className="text-navy-800">{booking.contact.phone}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <dt className="sr-only">Email</dt>
                <dd className="min-w-0 break-words text-navy-800">{booking.contact.email}</dd>
              </div>

              {booking.emergencyContact?.name && (
                <div className="border-t border-border pt-3">
                  <dt className="text-xs text-muted-foreground">Emergency contact</dt>
                  <dd className="mt-0.5 text-navy-800">
                    {booking.emergencyContact.name}
                    {booking.emergencyContact.relationship &&
                      ` (${booking.emergencyContact.relationship})`}
                    {booking.emergencyContact.phone && (
                      <span className="block text-xs text-muted-foreground">
                        {booking.emergencyContact.phone}
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </section>

          {/* Money */}
          <section className="rounded-xl border border-border bg-card shadow-card">
            <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
              Cost breakdown
            </h3>
            <dl className="space-y-2.5 p-5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Service</dt>
                <dd className="font-medium text-navy-800">
                  {formatNaira(booking.servicePriceKobo)}
                </dd>
              </div>
              {booking.surchargeKobo > 0 && (
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Home visit surcharge</dt>
                  <dd className="font-medium text-navy-800">
                    {formatNaira(booking.surchargeKobo)}
                  </dd>
                </div>
              )}
              {booking.discountKobo > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <dt>
                    Discount{booking.promotionCode && ` (${booking.promotionCode})`}
                  </dt>
                  <dd className="font-medium">−{formatNaira(booking.discountKobo)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2.5">
                <dt className="font-semibold text-navy-800">Total</dt>
                <dd className="font-display text-lg font-bold text-navy-800">
                  {formatNaira(booking.totalKobo)}
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 text-sm font-medium text-navy-800">{value}</dd>
      </div>
    </div>
  );
}
