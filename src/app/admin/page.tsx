import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import {
  ArrowRight,
  BarChart3,
  Bell,
  CalendarDays,
  CalendarPlus,
  Settings,
  Stethoscope,
  UserPlus,
  UsersRound,
  Wallet,
  Clock,
} from 'lucide-react';
import { StatCard } from '@/components/admin/stat-card';
import { AppointmentChart, RevenueDonut } from '@/components/admin/charts';
import { ServiceIcon } from '@/components/public/service-icon';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState, CardSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import {
  getDashboardKpis,
  getAppointmentChart,
  getRevenueOverview,
  getTopServices,
  type ChartRange,
} from '@/lib/queries/analytics';
import { getAdminBookings } from '@/lib/queries/admin';
import { formatNaira, formatNumber, formatPercent, formatTimeLabel, initials } from '@/lib/utils';
import type { Permission } from '@/lib/permissions/catalogue';

export const metadata: Metadata = { title: 'Dashboard' };

const KPI_ICONS = [CalendarDays, UsersRound, Wallet, Clock, Stethoscope];
const KPI_ACCENTS = [
  'bg-brand-50 text-brand-600',
  'bg-crimson-50 text-crimson-600',
  'bg-violet-50 text-violet-600',
  'bg-amber-50 text-amber-600',
  'bg-emerald-50 text-emerald-600',
];

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await requireAdmin('dashboard.view');
  const { range } = await searchParams;

  const chartRange = (['today', 'week', 'month', 'year'].includes(range ?? '')
    ? range
    : 'week') as ChartRange;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Welcome back, {user.name.split(' ')[0]}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {format(new Date(), "EEEE, d MMMM yyyy")} — here&apos;s what&apos;s happening today.
        </p>
      </div>

      <Suspense fallback={<CardSkeleton count={5} />}>
        <Kpis />
      </Suspense>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr] xl:items-start">
        <Panel title="Appointments Overview">
          <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-secondary" />}>
            <AppointmentsOverview range={chartRange} />
          </Suspense>
        </Panel>

        <Panel
          title="Recent Appointments"
          action={
            userCan(user, 'appointments.view')
              ? { label: 'View all', href: '/admin/appointments' }
              : undefined
          }
        >
          <Suspense fallback={<div className="h-72 animate-pulse rounded-lg bg-secondary" />}>
            <RecentAppointments />
          </Suspense>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-3 xl:items-start">
        {userCan(user, 'payments.view') && (
          <Panel title="Revenue Overview" className="xl:col-span-1">
            <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-secondary" />}>
              <RevenueOverview />
            </Suspense>
          </Panel>
        )}

        <Panel
          title="Top Services"
          action={
            userCan(user, 'services.view')
              ? { label: 'Manage', href: '/admin/services' }
              : undefined
          }
        >
          <Suspense fallback={<div className="h-56 animate-pulse rounded-lg bg-secondary" />}>
            <TopServices />
          </Suspense>
        </Panel>

        <Panel title="Quick Actions">
          <QuickActions permissions={user.permissions} isSuperAdmin={user.role === 'super_admin'} />
        </Panel>
      </div>
    </div>
  );
}

/* ── Sections ─────────────────────────────────────────────────────── */

async function Kpis() {
  const kpis = await getDashboardKpis();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {kpis.map((kpi, index) => (
        <StatCard
          key={kpi.label}
          {...kpi}
          icon={KPI_ICONS[index]}
          accent={KPI_ACCENTS[index]}
        />
      ))}
    </div>
  );
}

async function AppointmentsOverview({ range }: { range: ChartRange }) {
  const data = await getAppointmentChart(range);
  return <AppointmentChart data={data} range={range} />;
}

async function RecentAppointments() {
  const { data } = await getAdminBookings({ page: 1, pageSize: 6 });

  if (data.length === 0) {
    return (
      <EmptyState
        icon={CalendarDays}
        title="No appointments yet"
        description="Bookings will appear here as patients make them."
        action={{ label: 'Create appointment', href: '/admin/appointments/new' }}
      />
    );
  }

  return (
    <ul className="divide-y divide-border">
      {data.map((booking) => (
        <li key={booking.id}>
          <Link
            href={`/admin/appointments/${booking.id}`}
            className="flex items-center gap-3 py-3 transition-colors hover:bg-secondary/40"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
              {initials(booking.patientName)}
            </span>

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-navy-800">{booking.patientName}</p>
              <p className="truncate text-xs text-muted-foreground">{booking.serviceName}</p>
            </div>

            <div className="hidden shrink-0 text-right sm:block">
              <p className="whitespace-nowrap text-xs text-muted-foreground">
                {format(new Date(booking.dateKey), 'd MMM yyyy')}
              </p>
              <p className="whitespace-nowrap text-xs text-muted-foreground">
                {formatTimeLabel(booking.startTime)}
              </p>
            </div>

            <StatusBadge kind="booking" status={booking.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function RevenueOverview() {
  const revenue = await getRevenueOverview();

  return (
    <div>
      <p className="text-xs text-muted-foreground">Total revenue</p>
      <p className="mt-1 font-display text-2xl font-bold text-navy-800">
        {formatNaira(revenue.totalKobo)}
      </p>
      <p className="mt-1 text-xs">
        <span
          className={
            revenue.change >= 0 ? 'font-semibold text-emerald-600' : 'font-semibold text-red-600'
          }
        >
          {formatPercent(revenue.change)}
        </span>{' '}
        <span className="text-muted-foreground">from last month</span>
      </p>

      <div className="mt-5 border-t border-border pt-5">
        <p className="mb-4 text-xs font-medium text-muted-foreground">Revenue by service</p>
        <RevenueDonut data={revenue.breakdown} />
      </div>
    </div>
  );
}

async function TopServices() {
  const services = await getTopServices(5);

  if (services.length === 0) {
    return (
      <EmptyState
        icon={Stethoscope}
        title="No bookings yet"
        description="Once services are booked, the most popular appear here."
      />
    );
  }

  return (
    <ul className="space-y-1">
      {services.map((service) => (
        <li
          key={service.id}
          className="flex items-center gap-3 rounded-lg px-1 py-2.5 transition-colors hover:bg-secondary/40"
        >
          <ServiceIcon icon={service.icon} accent={service.accent} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-navy-800">{service.name}</p>
            <p className="text-xs text-muted-foreground">
              {formatNaira(service.revenueKobo, { compact: true })} revenue
            </p>
          </div>
          <span className="shrink-0 text-sm font-semibold text-navy-800">
            {formatNumber(service.appointments)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function QuickActions({
  permissions,
  isSuperAdmin,
}: {
  permissions: string[];
  isSuperAdmin: boolean;
}) {
  const can = (permission: Permission) => isSuperAdmin || permissions.includes(permission);

  const actions = [
    {
      label: 'Add Appointment',
      href: '/admin/appointments/new',
      icon: CalendarPlus,
      accent: 'bg-brand-50 text-brand-600',
      allowed: can('appointments.create'),
    },
    {
      label: 'Add Patient',
      href: '/admin/patients/new',
      icon: UserPlus,
      accent: 'bg-crimson-50 text-crimson-600',
      allowed: can('patients.create'),
    },
    {
      label: 'Add Service',
      href: '/admin/services/new',
      icon: Stethoscope,
      accent: 'bg-violet-50 text-violet-600',
      allowed: can('services.create'),
    },
    {
      label: 'Add Staff',
      href: '/admin/staff/new',
      icon: UsersRound,
      accent: 'bg-cyan-50 text-cyan-600',
      allowed: can('staff.manage'),
    },
    {
      label: 'Send Notification',
      href: '/admin/notifications',
      icon: Bell,
      accent: 'bg-amber-50 text-amber-600',
      allowed: can('notifications.send'),
    },
    {
      label: 'View Reports',
      href: '/admin/reports',
      icon: BarChart3,
      accent: 'bg-blue-50 text-blue-600',
      allowed: can('reports.view'),
    },
    {
      label: 'Site Settings',
      href: '/admin/settings',
      icon: Settings,
      accent: 'bg-slate-100 text-slate-600',
      allowed: can('settings.view'),
    },
  ].filter((action) => action.allowed);

  if (actions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No quick actions are available for your role.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {actions.map((action) => (
        <Link
          key={action.href}
          href={action.href}
          className="flex flex-col items-center gap-2 rounded-xl border border-border p-4 text-center transition-all hover:-translate-y-0.5 hover:shadow-soft"
        >
          <span className={`flex size-10 items-center justify-center rounded-lg ${action.accent}`}>
            <action.icon className="size-5" aria-hidden />
          </span>
          <span className="text-xs font-medium text-navy-800">{action.label}</span>
        </Link>
      ))}
    </div>
  );
}

/* ── Shared ───────────────────────────────────────────────────────── */

function Panel({
  title,
  action,
  className,
  children,
}: {
  title: string;
  action?: { label: string; href: string };
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`rounded-xl border border-border bg-card shadow-card ${className ?? ''}`}>
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
