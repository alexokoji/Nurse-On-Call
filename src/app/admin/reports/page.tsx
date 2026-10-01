import type { Metadata } from 'next';
import { Suspense } from 'react';
import { format, subDays } from 'date-fns';
import {
  BarChart3,
  CalendarCheck,
  CalendarX,
  Percent,
  TrendingUp,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { SummaryTile } from '@/components/admin/stat-card';
import { SimpleBarChart } from '@/components/admin/charts';
import { ExportButton } from '@/components/admin/export-button';
import { ReportRange } from './report-range';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState, CardSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getReportData } from '@/lib/queries/analytics';
import { formatNaira, formatNumber } from '@/lib/utils';

export const metadata: Metadata = { title: 'Reports' };

export default async function AdminReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const user = await requireAdmin('reports.view');
  const params = await searchParams;

  const to = params.to ? new Date(`${params.to}T23:59:59`) : new Date();
  const from = params.from ? new Date(params.from) : subDays(to, 29);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-navy-800">Reporting period</h2>
          <p className="text-xs text-muted-foreground">
            {format(from, 'd MMMM yyyy')} — {format(to, 'd MMMM yyyy')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ReportRange />
          {userCan(user, 'reports.export') && <ExportButton resource="report" label="Export CSV" />}
        </div>
      </div>

      <Suspense
        key={`${params.from}-${params.to}`}
        fallback={<CardSkeleton count={6} />}
      >
        <ReportBody from={from} to={to} />
      </Suspense>
    </div>
  );
}

async function ReportBody({ from, to }: { from: Date; to: Date }) {
  const report = await getReportData(from, to);

  if (report.totalBookings === 0) {
    return (
      <EmptyState
        icon={BarChart3}
        title="No activity in this period"
        description="Choose a wider date range, or check back once appointments have been booked."
      />
    );
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryTile
          label="Total appointments"
          value={report.totalBookings}
          icon={CalendarCheck}
        />
        <SummaryTile
          label="Completed"
          value={report.completed}
          icon={TrendingUp}
          accent="bg-emerald-50 text-emerald-600"
        />
        <SummaryTile
          label="Cancelled / no-show"
          value={report.cancelled}
          icon={CalendarX}
          accent="bg-red-50 text-red-600"
        />
        <SummaryTile
          label="Cancellation rate"
          value={`${report.cancellationRate.toFixed(1)}%`}
          icon={Percent}
          accent="bg-amber-50 text-amber-600"
        />
        <SummaryTile
          label="Revenue"
          value={formatNaira(report.revenueKobo)}
          icon={Wallet}
          accent="bg-violet-50 text-violet-600"
        />
        <SummaryTile
          label="New patients"
          value={report.newPatients}
          icon={UserPlus}
          accent="bg-crimson-50 text-crimson-600"
        />
      </div>

      <Panel title="Appointments per day">
        <SimpleBarChart data={report.daily} />
      </Panel>

      <div className="grid gap-5 xl:grid-cols-2 xl:items-start">
        <Panel title="Service performance">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Service</TableHead>
                <TableHead className="text-right">Appointments</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.byService.map((row) => (
                <TableRow key={row.name}>
                  <TableCell>
                    <span className="text-sm text-navy-800">{row.name}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-navy-800">{formatNumber(row.appointments)}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="whitespace-nowrap text-sm font-medium text-navy-800">
                      {formatNaira(row.revenueKobo)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>

        <Panel title="Staff performance">
          {report.byStaff.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No appointments were assigned to staff in this period.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Completed</TableHead>
                  <TableHead className="text-right">Rate</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {report.byStaff.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="whitespace-nowrap text-sm text-navy-800">{row.name}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm text-navy-800">{row.appointments}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm text-navy-800">{row.completed}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-sm text-muted-foreground">
                        {row.completionRate.toFixed(0)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="whitespace-nowrap text-sm font-medium text-navy-800">
                        {formatNaira(row.revenueKobo)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Panel>
      </div>

      <Panel title="Revenue and refunds">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Figure label="Gross revenue" value={formatNaira(report.revenueKobo)} />
          <Figure label="Refunded" value={formatNaira(report.refundedKobo)} tone="text-violet-600" />
          <Figure
            label="Net revenue"
            value={formatNaira(report.revenueKobo - report.refundedKobo)}
            tone="text-emerald-600"
          />
        </dl>
      </Panel>
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

function Figure({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border p-4">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-display text-xl font-bold ${tone ?? 'text-navy-800'}`}>{value}</dd>
    </div>
  );
}
