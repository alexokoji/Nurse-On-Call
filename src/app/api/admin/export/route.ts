import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { format } from 'date-fns';
import { apiRequirePermission } from '@/lib/auth/guards';
import { getAdminBookings, getAdminPatients, getAdminPayments } from '@/lib/queries/admin';
import { getReportData } from '@/lib/queries/analytics';
import { recordAudit } from '@/lib/audit';
import { handleApiError, apiError } from '@/lib/api';
import { formatTimeLabel } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/**
 * CSV export for the admin tables.
 *
 * Exports respect the caller's permissions and the same filters as the
 * on-screen table, and are capped so a stray request cannot stream the entire
 * database. Every export is written to the audit log — exported patient data
 * leaves the system, which is exactly the kind of action an auditor asks about.
 */

const MAX_ROWS = 5000;

export async function GET(request: NextRequest) {
  const resource = request.nextUrl.searchParams.get('resource');
  const params = request.nextUrl.searchParams;

  try {
    switch (resource) {
      case 'appointments': {
        const user = await apiRequirePermission('appointments.export');
        const result = await getAdminBookings({
          q: params.get('q') ?? undefined,
          status: params.get('status') ?? undefined,
          serviceId: params.get('serviceId') ?? undefined,
          staffId: params.get('staffId') ?? undefined,
          from: params.get('from') ?? undefined,
          to: params.get('to') ?? undefined,
          page: 1,
          pageSize: MAX_ROWS,
        });

        await recordAudit({
          actor: user,
          action: 'appointments.export',
          entity: 'Booking',
          summary: `Exported ${result.data.length} appointments to CSV`,
        });

        return csv(
          'appointments',
          [
            'Reference',
            'Patient',
            'Phone',
            'Service',
            'Staff',
            'Date',
            'Time',
            'Location',
            'Amount (NGN)',
            'Paid',
            'Status',
          ],
          result.data.map((row) => [
            row.reference,
            row.patientName,
            row.patientPhone,
            row.serviceName,
            row.staffName ?? 'Unassigned',
            row.dateKey,
            formatTimeLabel(row.startTime),
            row.locationLabel,
            (row.totalKobo / 100).toFixed(2),
            row.isPaid ? 'Yes' : 'No',
            row.status,
          ]),
        );
      }

      case 'payments': {
        const user = await apiRequirePermission('payments.export');
        const result = await getAdminPayments({
          q: params.get('q') ?? undefined,
          status: params.get('status') ?? undefined,
          provider: params.get('provider') ?? undefined,
          from: params.get('from') ?? undefined,
          to: params.get('to') ?? undefined,
          page: 1,
          pageSize: MAX_ROWS,
        });

        await recordAudit({
          actor: user,
          action: 'payments.export',
          entity: 'Payment',
          summary: `Exported ${result.data.length} payment records to CSV`,
        });

        return csv(
          'payments',
          [
            'Transaction',
            'Booking',
            'Patient',
            'Service',
            'Gateway',
            'Method',
            'Amount (NGN)',
            'Paid (NGN)',
            'Refunded (NGN)',
            'Status',
            'Date',
          ],
          result.data.map((row) => [
            row.reference,
            row.bookingReference,
            row.patientName,
            row.serviceName,
            row.provider,
            row.channel ?? '',
            (row.amountKobo / 100).toFixed(2),
            (row.amountPaidKobo / 100).toFixed(2),
            (row.refundedKobo / 100).toFixed(2),
            row.status,
            row.paidAt ?? row.createdAt,
          ]),
        );
      }

      case 'patients': {
        const user = await apiRequirePermission('patients.view');
        const result = await getAdminPatients({
          q: params.get('q') ?? undefined,
          status: params.get('status') ?? undefined,
          page: 1,
          pageSize: MAX_ROWS,
        });

        await recordAudit({
          actor: user,
          action: 'patients.export',
          entity: 'User',
          summary: `Exported ${result.data.length} patient records to CSV`,
        });

        return csv(
          'patients',
          [
            'Patient No.',
            'Name',
            'Email',
            'Phone',
            'Status',
            'Appointments',
            'Total spent (NGN)',
            'Last appointment',
            'Registered',
          ],
          result.data.map((row) => [
            row.patientNumber,
            row.name,
            row.email,
            row.phone,
            row.status,
            String(row.totalAppointments),
            (row.totalSpentKobo / 100).toFixed(2),
            row.lastAppointmentAt ? row.lastAppointmentAt.slice(0, 10) : '',
            row.createdAt.slice(0, 10),
          ]),
        );
      }

      case 'report': {
        const user = await apiRequirePermission('reports.export');
        const from = params.get('from')
          ? new Date(params.get('from')!)
          : new Date(Date.now() - 30 * 86_400_000);
        const to = params.get('to') ? new Date(`${params.get('to')}T23:59:59`) : new Date();

        const report = await getReportData(from, to);

        await recordAudit({
          actor: user,
          action: 'reports.export',
          entity: 'Report',
          summary: `Exported report for ${format(from, 'd MMM yyyy')} – ${format(to, 'd MMM yyyy')}`,
        });

        const rows: string[][] = [
          ['Period', `${format(from, 'yyyy-MM-dd')} to ${format(to, 'yyyy-MM-dd')}`],
          ['Total appointments', String(report.totalBookings)],
          ['Completed', String(report.completed)],
          ['Cancelled / no-show', String(report.cancelled)],
          ['Cancellation rate (%)', report.cancellationRate.toFixed(1)],
          ['New patients', String(report.newPatients)],
          ['Revenue (NGN)', (report.revenueKobo / 100).toFixed(2)],
          ['Refunded (NGN)', (report.refundedKobo / 100).toFixed(2)],
          [],
          ['Service', 'Appointments', 'Revenue (NGN)'],
          ...report.byService.map((row) => [
            row.name,
            String(row.appointments),
            (row.revenueKobo / 100).toFixed(2),
          ]),
          [],
          ['Staff', 'Appointments', 'Completed', 'Cancelled', 'Completion rate (%)', 'Revenue (NGN)'],
          ...report.byStaff.map((row) => [
            row.name,
            String(row.appointments),
            String(row.completed),
            String(row.cancelled),
            row.completionRate.toFixed(1),
            (row.revenueKobo / 100).toFixed(2),
          ]),
        ];

        return csv('report', ['Metric', 'Value'], rows.slice(1), rows[0]);
      }

      default:
        return apiError('Unknown export resource.', 400);
    }
  } catch (error) {
    return handleApiError(error, 'admin.export');
  }
}

/** RFC-4180 escaping: quote everything, double any embedded quote. */
function escapeCell(value: string): string {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

function csv(name: string, headers: string[], rows: string[][], leadingRow?: string[]) {
  const lines: string[] = [];

  if (leadingRow) lines.push(leadingRow.map(escapeCell).join(','));
  lines.push(headers.map(escapeCell).join(','));
  for (const row of rows) lines.push(row.map(escapeCell).join(','));

  // BOM so Excel opens UTF-8 (and the ₦ sign) correctly.
  const body = `﻿${lines.join('\r\n')}`;
  const filename = `nurseoncall-${name}-${format(new Date(), 'yyyy-MM-dd')}.csv`;

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}
