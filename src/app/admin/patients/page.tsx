import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { UserPlus, Users, UserCheck, UserRoundPlus } from 'lucide-react';
import { SummaryTile } from '@/components/admin/stat-card';
import { FilterBar } from '@/components/admin/filter-bar';
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
import { getAdminPatients, getPatientStats } from '@/lib/queries/admin';
import { formatNaira, initials } from '@/lib/utils';
import { USER_STATUSES } from '@/types';

export const metadata: Metadata = { title: 'Patients' };

export default async function AdminPatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const user = await requireAdmin('patients.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      <Suspense fallback={<CardSkeleton count={3} />}>
        <Stats />
      </Suspense>

      <FilterBar
        searchPlaceholder="Search by name, email or phone…"
        filters={[
          {
            name: 'status',
            label: 'All Status',
            options: USER_STATUSES.map((status) => ({
              value: status,
              label: status[0].toUpperCase() + status.slice(1),
            })),
          },
        ]}
      >
        <ExportButton resource="patients" />
        {userCan(user, 'patients.create') && (
          <Button asChild>
            <Link href="/admin/patients/new">
              <UserPlus className="size-4" />
              New Patient
            </Link>
          </Button>
        )}
      </FilterBar>

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={10} columns={7} />
          </div>
        }
      >
        <PatientsTable params={params} />
      </Suspense>
    </div>
  );
}

async function Stats() {
  const stats = await getPatientStats();

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <SummaryTile label="Total Patients" value={stats.total} icon={Users} />
      <SummaryTile
        label="Active"
        value={stats.active}
        icon={UserCheck}
        accent="bg-emerald-50 text-emerald-600"
      />
      <SummaryTile
        label="New (30 days)"
        value={stats.recent}
        icon={UserRoundPlus}
        accent="bg-crimson-50 text-crimson-600"
      />
    </div>
  );
}

async function PatientsTable({
  params,
}: {
  params: { q?: string; status?: string; page?: string };
}) {
  const user = await requireAdmin('patients.view');

  const result = await getAdminPatients({
    q: params.q,
    status: params.status,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={Users}
          title="No patients yet"
          description="Patients appear here when they register or when you book on their behalf."
          action={
            userCan(user, 'patients.create')
              ? { label: 'Add a patient', href: '/admin/patients/new' }
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
            <TableHead>Patient</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Appointments</TableHead>
            <TableHead className="text-right">Total spent</TableHead>
            <TableHead>Last appointment</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((patient) => (
            <TableRow key={patient.id}>
              <TableCell>
                <Link
                  href={`/admin/patients/${patient.id}`}
                  className="flex items-center gap-2.5 group"
                >
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                    {initials(patient.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy-800 group-hover:text-primary">
                      {patient.name}
                    </span>
                    <span className="block font-mono text-xs text-muted-foreground">
                      {patient.patientNumber}
                    </span>
                  </span>
                </Link>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {patient.phone}
                </span>
              </TableCell>

              <TableCell>
                <span className="block max-w-[14rem] truncate text-sm text-muted-foreground">
                  {patient.email}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <span className="text-sm font-medium text-navy-800">
                  {patient.totalAppointments}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <span className="whitespace-nowrap text-sm font-medium text-navy-800">
                  {formatNaira(patient.totalSpentKobo)}
                </span>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {patient.lastAppointmentAt
                    ? format(new Date(patient.lastAppointmentAt), 'd MMM yyyy')
                    : '—'}
                </span>
              </TableCell>

              <TableCell>
                <StatusBadge kind="user" status={patient.status} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="patients"
      />
    </div>
  );
}
