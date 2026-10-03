import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, Clock, CreditCard, RotateCcw, ShieldCheck, XCircle } from 'lucide-react';
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
import { EmptyState, TableSkeleton, CardSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { TransferDecision } from './transfer-decision';
import { getAdminPayments, getPaymentStats } from '@/lib/queries/admin';
import { formatNaira } from '@/lib/utils';
import { PAYMENT_STATUSES, LABELS } from '@/types';

export const metadata: Metadata = { title: 'Payments' };

interface SearchParams {
  q?: string;
  status?: string;
  provider?: string;
  from?: string;
  to?: string;
  page?: string;
}

export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await requireAdmin('payments.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      <Suspense fallback={<CardSkeleton count={5} />}>
        <Stats />
      </Suspense>

      <FilterBar
        searchPlaceholder="Search by transaction or gateway reference…"
        showDateRange
        filters={[
          {
            name: 'status',
            label: 'All Status',
            options: PAYMENT_STATUSES.map((status) => ({
              value: status,
              label: LABELS.paymentStatus[status],
            })),
          },
          {
            name: 'provider',
            label: 'All Gateways',
            options: [
              { value: 'paystack', label: 'Paystack' },
              { value: 'flutterwave', label: 'Flutterwave' },
              { value: 'korapay', label: 'Korapay' },
              { value: 'bank_transfer', label: 'Bank transfer' },
              { value: 'manual', label: 'Manual / offline' },
            ],
          },
        ]}
      >
        {userCan(user, 'payments.export') && <ExportButton resource="payments" />}
      </FilterBar>

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={10} columns={7} />
          </div>
        }
      >
        <PaymentsTable params={params} />
      </Suspense>
    </div>
  );
}

async function Stats() {
  const stats = await getPaymentStats();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      <SummaryTile
        label="Total Revenue"
        value={formatNaira(stats.revenueKobo)}
        icon={CreditCard}
        accent="bg-brand-50 text-brand-600"
      />
      <SummaryTile
        label="Successful"
        value={stats.successful}
        icon={CheckCircle2}
        accent="bg-emerald-50 text-emerald-600"
      />
      <SummaryTile
        label="Pending"
        value={stats.pending}
        icon={Clock}
        accent="bg-amber-50 text-amber-600"
      />
      <SummaryTile
        label="Failed"
        value={stats.failed}
        icon={XCircle}
        accent="bg-red-50 text-red-600"
      />
      <SummaryTile
        label="Refunded"
        value={formatNaira(stats.refundedKobo)}
        icon={RotateCcw}
        accent="bg-violet-50 text-violet-600"
      />
    </div>
  );
}

async function PaymentsTable({ params }: { params: SearchParams }) {
  /* Resolved here rather than passed down: this component is rendered inside
     its own Suspense boundary, so it cannot take the page's user as a prop
     without blocking the shell on this query. */
  const user = await requireAdmin();
  const canSettle = userCan(user, 'payments.refund');

  const result = await getAdminPayments({
    q: params.q,
    status: params.status,
    provider: params.provider,
    from: params.from,
    to: params.to,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={CreditCard}
          title="No payment records"
          description="Nothing matches these filters. Payments appear here as patients pay for bookings."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Transaction ID</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Booking</TableHead>
            <TableHead>Gateway</TableHead>
            <TableHead>Method</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Action</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((payment) => (
            <TableRow key={payment.id}>
              <TableCell>
                <span className="whitespace-nowrap font-mono text-xs font-medium text-navy-800">
                  {payment.reference}
                </span>
                {payment.webhookVerified && (
                  <span
                    className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-600"
                    title="Independently confirmed by a signed gateway webhook"
                  >
                    <ShieldCheck className="size-3" aria-hidden />
                    Webhook verified
                  </span>
                )}
              </TableCell>

              <TableCell>
                <p className="whitespace-nowrap text-sm text-navy-800">{payment.patientName}</p>
                <p className="max-w-[12rem] truncate text-xs text-muted-foreground">
                  {payment.serviceName}
                </p>
              </TableCell>

              <TableCell>
                {payment.bookingId ? (
                  <Link
                    href={`/admin/appointments/${payment.bookingId}`}
                    className="whitespace-nowrap font-mono text-xs text-primary hover:underline"
                  >
                    {payment.bookingReference}
                  </Link>
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
              </TableCell>

              <TableCell>
                <span className="text-sm capitalize text-navy-800">{payment.provider}</span>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm capitalize text-muted-foreground">
                  {payment.channel?.replace(/_/g, ' ') ?? '—'}
                </span>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {format(new Date(payment.paidAt ?? payment.createdAt), 'd MMM yyyy')}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <span className="whitespace-nowrap text-sm font-medium text-navy-800">
                  {formatNaira(payment.amountKobo)}
                </span>
                {payment.refundedKobo > 0 && (
                  <span className="mt-0.5 block whitespace-nowrap text-xs text-violet-600">
                    −{formatNaira(payment.refundedKobo)}
                  </span>
                )}
              </TableCell>

              <TableCell>
                <StatusBadge kind="payment" status={payment.status} />
              </TableCell>

              <TableCell className="text-right">
                {/* Only a transfer still waiting on a human decision gets
                    buttons. Everything else has already been settled by a
                    gateway or by hand. */}
                {payment.provider === 'bank_transfer' &&
                payment.status === 'pending' &&
                canSettle ? (
                  <TransferDecision
                    paymentId={payment.id}
                    amountKobo={payment.amountKobo}
                    patientName={payment.patientName}
                    bookingReference={payment.bookingReference}
                    narration={payment.narration ?? undefined}
                  />
                ) : (
                  <span className="text-xs text-muted-foreground">—</span>
                )}
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
        label="payments"
      />
    </div>
  );
}
