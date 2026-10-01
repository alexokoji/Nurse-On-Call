import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Home,
  Video,
  XCircle,
} from 'lucide-react';
import { SummaryTile } from '@/components/admin/stat-card';
import { FilterBar } from '@/components/admin/filter-bar';
import { AppointmentRowActions } from './row-actions';
import { ExportButton } from '@/components/admin/export-button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { EmptyState, TableSkeleton, CardSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminBookings, getAdminServices, getAdminStaff } from '@/lib/queries/admin';
import { getAppointmentCounts } from '@/lib/queries/analytics';
import { formatNaira, formatTimeLabel, initials } from '@/lib/utils';
import { BOOKING_STATUSES, LABELS } from '@/types';

export const metadata: Metadata = { title: 'Appointments' };

interface SearchParams {
  q?: string;
  status?: string;
  serviceId?: string;
  staffId?: string;
  from?: string;
  to?: string;
  page?: string;
}

const LOCATION_ICON = { clinic: Building2, home: Home, virtual: Video };

export default async function AdminAppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAdmin('appointments.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      <Suspense fallback={<CardSkeleton count={5} />}>
        <SummaryCards />
      </Suspense>

      <Suspense fallback={<div className="h-20 rounded-xl border border-border bg-card" />}>
        <Toolbar canCreate={userCan(user, 'appointments.create')} canExport={userCan(user, 'appointments.export')} />
      </Suspense>

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={10} columns={7} />
          </div>
        }
      >
        <AppointmentsTable params={params} />
      </Suspense>
    </div>
  );
}

async function SummaryCards() {
  const counts = await getAppointmentCounts();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryTile
        label="Total Appointments"
        value={counts.total}
        icon={CalendarDays}
        accent="bg-brand-50 text-brand-600"
      />
      <SummaryTile
        label="Confirmed"
        value={counts.confirmed}
        icon={CheckCircle2}
        accent="bg-emerald-50 text-emerald-600"
      />
      <SummaryTile
        label="Pending"
        value={counts.pending}
        icon={Clock}
        accent="bg-amber-50 text-amber-600"
      />
      <SummaryTile
        label="Cancelled"
        value={counts.cancelled}
        icon={XCircle}
        accent="bg-red-50 text-red-600"
      />
      <SummaryTile
        label="Completed"
        value={counts.completed}
        icon={CalendarCheck}
        accent="bg-violet-50 text-violet-600"
      />
    </div>
  );
}

async function Toolbar({ canCreate, canExport }: { canCreate: boolean; canExport: boolean }) {
  const [services, staff] = await Promise.all([
    getAdminServices({ pageSize: 100 }),
    getAdminStaff({ pageSize: 100 }),
  ]);

  return (
    <FilterBar
      searchPlaceholder="Search by patient, reference or service…"
      showDateRange
      filters={[
        {
          name: 'status',
          label: 'All Status',
          options: BOOKING_STATUSES.map((status) => ({
            value: status,
            label: LABELS.bookingStatus[status],
          })),
        },
        {
          name: 'serviceId',
          label: 'All Services',
          options: services.data.map((service) => ({ value: service.id, label: service.name })),
        },
        {
          name: 'staffId',
          label: 'All Staff',
          options: staff.data.map((member) => ({ value: member.id, label: member.name })),
        },
      ]}
    >
      {canExport && <ExportButton resource="appointments" />}
      {canCreate && (
        <Button asChild>
          <Link href="/admin/appointments/new">
            <CalendarPlus className="size-4" />
            New Appointment
          </Link>
        </Button>
      )}
    </FilterBar>
  );
}

async function AppointmentsTable({ params }: { params: SearchParams }) {
  const user = await requireAdmin('appointments.view');

  const result = await getAdminBookings({
    q: params.q,
    status: params.status,
    serviceId: params.serviceId,
    staffId: params.staffId,
    from: params.from,
    to: params.to,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={CalendarDays}
          title="No appointments found"
          description="Nothing matches these filters. Try widening the date range or clearing the search."
          action={
            userCan(user, 'appointments.create')
              ? { label: 'New appointment', href: '/admin/appointments/new' }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>#</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Service</TableHead>
            <TableHead>Staff</TableHead>
            <TableHead>Date &amp; Time</TableHead>
            <TableHead>Location</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((booking) => {
            const LocationIcon = LOCATION_ICON[booking.locationType];

            return (
              <TableRow key={booking.id}>
                <TableCell>
                  <Link
                    href={`/admin/appointments/${booking.id}`}
                    className="whitespace-nowrap font-mono text-xs font-medium text-primary hover:underline"
                  >
                    {booking.reference}
                  </Link>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                      {initials(booking.patientName)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-navy-800">
                        {booking.patientName}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {booking.patientPhone}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell>
                  <p className="whitespace-nowrap text-sm font-medium text-navy-800">
                    {booking.serviceName}
                  </p>
                  {booking.serviceCategory && (
                    <p className="text-xs text-muted-foreground">{booking.serviceCategory}</p>
                  )}
                </TableCell>

                <TableCell>
                  {booking.staffName ? (
                    <>
                      <p className="whitespace-nowrap text-sm text-navy-800">{booking.staffName}</p>
                      {booking.staffTitle && (
                        <p className="text-xs text-muted-foreground">
                          {LABELS.staffRole[booking.staffTitle as keyof typeof LABELS.staffRole]}
                        </p>
                      )}
                    </>
                  ) : (
                    <span className="text-xs italic text-muted-foreground">Unassigned</span>
                  )}
                </TableCell>

                <TableCell>
                  <p className="whitespace-nowrap text-sm text-navy-800">
                    {format(new Date(booking.dateKey), 'd MMM yyyy')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatTimeLabel(booking.startTime)}
                  </p>
                </TableCell>

                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <LocationIcon className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <div className="min-w-0">
                      <p className="whitespace-nowrap text-sm text-navy-800">
                        {LABELS.locationType[booking.locationType]}
                      </p>
                      <p className="max-w-[10rem] truncate text-xs text-muted-foreground">
                        {booking.locationLabel}
                      </p>
                    </div>
                  </div>
                </TableCell>

                <TableCell className="text-right">
                  <p className="whitespace-nowrap text-sm font-medium text-navy-800">
                    {formatNaira(booking.totalKobo)}
                  </p>
                  {!booking.isPaid && (
                    <p className="text-xs text-amber-600">Unpaid</p>
                  )}
                </TableCell>

                <TableCell>
                  <StatusBadge kind="booking" status={booking.status} />
                </TableCell>

                <TableCell className="text-right">
                  <AppointmentRowActions
                    bookingId={booking.id}
                    patientId={booking.patientId}
                    status={booking.status}
                    isPaid={booking.isPaid}
                    permissions={user.permissions}
                    isSuperAdmin={user.role === 'super_admin'}
                  />
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="appointments"
      />
    </div>
  );
}
