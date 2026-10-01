import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  CalendarDays,
  Clock,
  CreditCard,
  MapPin,
  Receipt,
  User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientBooking } from '@/lib/queries/patient';
import { getSettings } from '@/lib/settings';
import { formatNaira, formatTimeLabel } from '@/lib/utils';
import { LABELS, type LocationType } from '@/types';
import { AppointmentActions } from './appointment-actions';

export const metadata: Metadata = { title: 'Appointment' };

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePatient();
  const { id } = await params;

  const booking = await getPatientBooking(user.id, id);
  if (!booking) notFound();

  const bookingSettings = await getSettings('booking');

  const canCancel = ['pending_payment', 'confirmed'].includes(booking.status);
  const canReschedule = ['pending_payment', 'confirmed'].includes(booking.status);
  const canPay = booking.status === 'pending_payment' && !booking.isPaid;
  const canReview = booking.status === 'completed' && !booking.review;

  return (
    <div className="space-y-6">
      <Link
        href="/patient/appointments"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All appointments
      </Link>

      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">
              {booking.serviceName}
            </h1>
            <p className="mt-1 font-mono text-sm text-muted-foreground">{booking.reference}</p>
          </div>
          <StatusBadge kind="booking" status={booking.status} dot />
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
            value={LABELS.locationType[booking.locationType as LocationType]}
          />
          <Detail
            icon={User}
            label="Care professional"
            value={booking.staffName ?? 'To be assigned'}
          />
        </dl>

        {booking.address && (
          <p className="mt-5 rounded-lg bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-navy-800">Visit address:</span> {booking.address}
          </p>
        )}

        {booking.notes && (
          <p className="mt-3 rounded-lg bg-secondary/60 px-4 py-3 text-sm text-muted-foreground">
            <span className="font-medium text-navy-800">Your notes:</span> {booking.notes}
          </p>
        )}

        {booking.status === 'cancelled' && booking.cancellationReason && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
            <span className="font-medium">Cancelled:</span> {booking.cancellationReason}
          </p>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          <AppointmentActions
            bookingId={booking.id}
            serviceName={booking.serviceName}
            canCancel={canCancel}
            canReschedule={canReschedule}
            canPay={canPay}
            canReview={canReview}
            amountDueKobo={booking.totalKobo}
            cancellationPolicy={bookingSettings.cancellationPolicy}
            existingReview={booking.review}
          />

          {/* Payments */}
          <section className="rounded-xl border border-border bg-card shadow-card">
            <h2 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
              Payment history
            </h2>
            <div className="p-5">
              {booking.payments.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No payment attempts recorded yet.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {booking.payments.map((payment) => (
                    <li key={payment.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="font-mono text-sm text-navy-800">{payment.reference}</p>
                        <p className="text-xs capitalize text-muted-foreground">
                          {payment.provider}
                          {payment.channel && ` · ${payment.channel.replace(/_/g, ' ')}`} ·{' '}
                          {format(new Date(payment.createdAt), 'd MMM yyyy, h:mm a')}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-navy-800">
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
        </div>

        {/* Cost breakdown */}
        <aside className="rounded-xl border border-border bg-card p-6 shadow-card">
          <h2 className="text-sm font-semibold text-navy-800">Cost breakdown</h2>

          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">{booking.serviceName}</dt>
              <dd className="font-medium text-navy-800">
                {formatNaira(booking.servicePriceKobo)}
              </dd>
            </div>
            {booking.surchargeKobo > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Home visit surcharge</dt>
                <dd className="font-medium text-navy-800">{formatNaira(booking.surchargeKobo)}</dd>
              </div>
            )}
            {booking.discountKobo > 0 && (
              <div className="flex justify-between text-emerald-700">
                <dt>Discount</dt>
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

          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <CreditCard className="size-3.5" aria-hidden />
            {booking.isPaid ? 'Paid in full' : 'Payment outstanding'}
          </p>

          {booking.invoiceNumber && (
            <Button asChild variant="outline" className="mt-5 w-full">
              <Link href="/patient/receipts">
                <Receipt className="size-4" />
                Receipt {booking.invoiceNumber}
              </Link>
            </Button>
          )}
        </aside>
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
