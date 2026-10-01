import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { RotateCcw } from 'lucide-react';
import { FilterBar } from '@/components/admin/filter-bar';
import { RefundDecision } from './refund-decision';
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
import { EmptyState, TableSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminRefunds } from '@/lib/queries/admin';
import { formatNaira } from '@/lib/utils';
import { REFUND_STATUSES, LABELS } from '@/types';

export const metadata: Metadata = { title: 'Refunds' };

export default async function AdminRefundsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdmin('refunds.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      <FilterBar
        searchPlaceholder="Search refunds…"
        filters={[
          {
            name: 'status',
            label: 'All Status',
            options: REFUND_STATUSES.map((status) => ({
              value: status,
              label: LABELS.refundStatus[status],
            })),
          },
        ]}
      />

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={8} columns={6} />
          </div>
        }
      >
        <RefundsTable params={params} />
      </Suspense>
    </div>
  );
}

async function RefundsTable({ params }: { params: { status?: string; page?: string } }) {
  const user = await requireAdmin('refunds.view');
  const canApprove = userCan(user, 'refunds.approve');

  const result = await getAdminRefunds({
    status: params.status,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={RotateCcw}
          title="No refund requests"
          description="Refunds raised from a payment or a cancellation appear here for approval."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Refund</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Booking</TableHead>
            <TableHead>Reason</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Requested</TableHead>
            <TableHead>Status</TableHead>
            {canApprove && (
              <TableHead className="text-right">
                <span className="sr-only">Decision</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((refund) => (
            <TableRow key={refund.id}>
              <TableCell>
                <p className="whitespace-nowrap font-mono text-xs font-medium text-navy-800">
                  {refund.reference}
                </p>
                <p className="whitespace-nowrap text-xs capitalize text-muted-foreground">
                  {refund.provider} · {refund.paymentReference}
                </p>
              </TableCell>

              <TableCell>
                <p className="whitespace-nowrap text-sm text-navy-800">{refund.patientName}</p>
                <p className="max-w-[11rem] truncate text-xs text-muted-foreground">
                  {refund.serviceName}
                </p>
              </TableCell>

              <TableCell>
                {refund.bookingId ? (
                  <Link
                    href={`/admin/appointments/${refund.bookingId}`}
                    className="whitespace-nowrap font-mono text-xs text-primary hover:underline"
                  >
                    {refund.bookingReference}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell>
                <p className="max-w-[16rem] text-sm text-muted-foreground">{refund.reason}</p>
                {refund.reviewNote && (
                  <p className="mt-1 max-w-[16rem] text-xs italic text-muted-foreground">
                    Note: {refund.reviewNote}
                  </p>
                )}
              </TableCell>

              <TableCell className="text-right">
                <p className="whitespace-nowrap text-sm font-medium text-navy-800">
                  {formatNaira(refund.amountKobo)}
                </p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">
                  of {formatNaira(refund.paidKobo)}
                </p>
              </TableCell>

              <TableCell>
                <p className="whitespace-nowrap text-sm text-muted-foreground">
                  {format(new Date(refund.createdAt), 'd MMM yyyy')}
                </p>
                <p className="whitespace-nowrap text-xs text-muted-foreground">
                  by {refund.requestedBy}
                </p>
              </TableCell>

              <TableCell>
                <StatusBadge kind="refund" status={refund.status} />
                {refund.reviewedBy && (
                  <p className="mt-1 whitespace-nowrap text-xs text-muted-foreground">
                    by {refund.reviewedBy}
                  </p>
                )}
              </TableCell>

              {canApprove && (
                <TableCell className="text-right">
                  {refund.status === 'requested' ? (
                    <RefundDecision
                      refundId={refund.id}
                      reference={refund.reference}
                      amountKobo={refund.amountKobo}
                      patientName={refund.patientName}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="refunds"
      />
    </div>
  );
}
