import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  LifeBuoy,
  MapPin,
  Receipt,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/feedback';
import { requirePatient } from '@/lib/auth/guards';
import {
  getPatientBookings,
  getPatientNotifications,
  getPatientPayments,
  getPatientProfile,
  getPatientSummary,
  profileCompletion,
} from '@/lib/queries/patient';
import { formatNaira, formatTimeLabel } from '@/lib/utils';
import { LABELS, type LocationType } from '@/types';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function PatientDashboardPage() {
  const user = await requirePatient();

  const [summary, upcoming, recent, payments, notifications, profile] = await Promise.all([
    getPatientSummary(user.id),
    getPatientBookings(user.id, { status: 'upcoming', limit: 3 }),
    getPatientBookings(user.id, { status: 'past', limit: 5 }),
    getPatientPayments(user.id),
    getPatientNotifications(user.id),
    getPatientProfile(user.id),
  ]);

  const completion = profileCompletion(profile);
  const nextAppointment = upcoming[0] ?? null;
  const unread = notifications.filter((n) => !n.readAt).slice(0, 4);

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">
            {greeting()}, {user.name.split(' ')[0]}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {nextAppointment
              ? `Your next appointment is ${format(new Date(nextAppointment.startAt), "EEEE 'at' h:mm a")}.`
              : 'You have no upcoming appointments.'}
          </p>
        </div>
        <Button asChild>
          <Link href="/book">
            <CalendarPlus className="size-4" />
            Book a service
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={CalendarDays}
          label="Upcoming"
          value={String(summary.upcoming)}
          accent="bg-brand-50 text-brand-600"
        />
        <Stat
          icon={CheckCircle2}
          label="Completed"
          value={String(summary.completed)}
          accent="bg-emerald-50 text-emerald-600"
        />
        <Stat
          icon={Clock}
          label="Awaiting payment"
          value={String(summary.pendingPayment)}
          accent="bg-amber-50 text-amber-600"
        />
        <Stat
          icon={Wallet}
          label="Total spent"
          value={formatNaira(summary.totalSpentKobo)}
          accent="bg-violet-50 text-violet-600"
        />
      </div>

      {/* Profile completion prompt — only when it would actually help. */}
      {completion < 100 && (
        <div className="rounded-xl border border-border bg-card p-5 shadow-card">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-navy-800">
                Your profile is {completion}% complete
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Filling in your address and emergency contact means less typing every time you
                book.
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-crimson-500 transition-all"
                  style={{ width: `${completion}%` }}
                />
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/patient/profile">Complete profile</Link>
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-6">
          {/* Next appointment */}
          <Panel
            title="Upcoming appointments"
            action={{ label: 'View all', href: '/patient/appointments' }}
          >
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No upcoming appointments"
                description="Book a service and it will appear here with everything you need."
                action={{ label: 'Book a service', href: '/book' }}
              />
            ) : (
              <div className="space-y-3">
                {upcoming.map((booking) => (
                  <Link
                    key={booking.id}
                    href={`/patient/appointments/${booking.id}`}
                    className="block rounded-xl border border-border p-4 transition-colors hover:border-brand-300 hover:bg-secondary/40"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-navy-800">
                          {booking.serviceName}
                        </p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                          {booking.reference}
                        </p>
                      </div>
                      <StatusBadge kind="booking" status={booking.status} dot />
                    </div>

                    <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <CalendarDays className="size-3.5" aria-hidden />
                        <dd>
                          {format(new Date(booking.dateKey), 'EEE, d MMM yyyy')} ·{' '}
                          {formatTimeLabel(booking.startTime)}
                        </dd>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPin className="size-3.5" aria-hidden />
                        <dd>{LABELS.locationType[booking.locationType as LocationType]}</dd>
                      </div>
                      {booking.staffName && (
                        <div className="flex items-center gap-1.5">
                          <dd>With {booking.staffName}</dd>
                        </div>
                      )}
                    </dl>

                    {!booking.isPaid && booking.status === 'pending_payment' && (
                      <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                        Payment of {formatNaira(booking.totalKobo)} is still outstanding — this
                        slot is held only briefly.
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </Panel>

          {/* Recent history */}
          <Panel
            title="Recent appointments"
            action={{ label: 'View all', href: '/patient/appointments?filter=past' }}
          >
            {recent.length === 0 ? (
              <EmptyState
                icon={Clock}
                title="No past appointments yet"
                description="Your history will build up here after your first visit."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((booking) => (
                  <li key={booking.id}>
                    <Link
                      href={`/patient/appointments/${booking.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-secondary/40"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-navy-800">
                          {booking.serviceName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(booking.dateKey), 'd MMM yyyy')} ·{' '}
                          {formatTimeLabel(booking.startTime)}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-navy-800">
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
        </div>

        <div className="space-y-6">
          {/* Quick actions */}
          <Panel title="Quick actions">
            <div className="grid grid-cols-2 gap-3">
              <QuickAction
                href="/book"
                icon={CalendarPlus}
                label="Book a service"
                accent="bg-brand-50 text-brand-600"
              />
              <QuickAction
                href="/patient/appointments"
                icon={CalendarDays}
                label="My appointments"
                accent="bg-crimson-50 text-crimson-600"
              />
              <QuickAction
                href="/patient/receipts"
                icon={Receipt}
                label="Receipts"
                accent="bg-violet-50 text-violet-600"
              />
              <QuickAction
                href="/patient/support"
                icon={LifeBuoy}
                label="Get help"
                accent="bg-amber-50 text-amber-600"
              />
            </div>
          </Panel>

          {/* Notifications */}
          <Panel
            title="Notifications"
            action={{ label: 'View all', href: '/patient/notifications' }}
          >
            {unread.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                You&apos;re all caught up.
              </p>
            ) : (
              <ul className="space-y-3">
                {unread.map((notification) => (
                  <li key={notification.id}>
                    <Link
                      href={notification.link ?? '/patient/notifications'}
                      className="flex gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/60"
                    >
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                        <Bell className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-navy-800">
                          {notification.subject}
                        </span>
                        <span className="mt-0.5 block text-xs text-muted-foreground">
                          {format(new Date(notification.createdAt), 'd MMM, h:mm a')}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {/* Recent payments */}
          <Panel title="Recent payments" action={{ label: 'View all', href: '/patient/payments' }}>
            {payments.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No payments yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {payments.slice(0, 4).map((payment) => (
                  <li key={payment.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-800">
                        {payment.serviceName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">{payment.reference}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-navy-800">
                        {formatNaira(payment.amountKobo)}
                      </p>
                      <StatusBadge kind="payment" status={payment.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}

/* ── Building blocks ──────────────────────────────────────────────── */

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function Stat({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <span className={`inline-flex size-10 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-display text-2xl font-bold text-navy-800">{value}</p>
    </div>
  );
}

function Panel({
  title,
  action,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold text-navy-800">{title}</h2>
        {action && (
          <Link
            href={action.href}
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {action.label}
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        )}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  accent,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  accent: string;
}) {
  return (
    <Link
      href={href}
      className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-soft"
    >
      <span className={`flex size-10 items-center justify-center rounded-lg ${accent}`}>
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="text-xs font-medium text-navy-800">{label}</span>
    </Link>
  );
}
