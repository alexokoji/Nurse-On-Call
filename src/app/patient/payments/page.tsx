import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { CreditCard } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { StatusBadge } from '@/components/ui/status-badge';
import { EmptyState } from '@/components/ui/feedback';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientPayments } from '@/lib/queries/patient';
import { formatNaira } from '@/lib/utils';

export const metadata: Metadata = { title: 'Payments' };

export default async function PatientPaymentsPage() {
  const user = await requirePatient();
  const payments = await getPatientPayments(user.id);

  const totalPaid = payments
    .filter((payment) => payment.status === 'successful')
    .reduce((sum, payment) => sum + payment.amountPaidKobo, 0);

  const totalRefunded = payments.reduce((sum, payment) => sum + payment.refundedKobo, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">Payments</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every transaction on your account, including attempts that did not go through.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Summary label="Total paid" value={formatNaira(totalPaid)} />
        <Summary label="Transactions" value={String(payments.length)} />
        <Summary label="Refunded" value={formatNaira(totalRefunded)} />
      </div>

      {payments.length === 0 ? (
        <EmptyState
          icon={CreditCard}
          title="No payment records"
          description="Payments appear here once you book and pay for a service."
          action={{ label: 'Book a service', href: '/book' }}
        />
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <span className="font-mono text-xs text-navy-800">{payment.reference}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {payment.bookingReference}
                    </span>
                  </TableCell>
                  <TableCell>
                    {payment.bookingId ? (
                      <Link
                        href={`/patient/appointments/${payment.bookingId}`}
                        className="text-sm text-primary hover:underline"
                      >
                        {payment.serviceName}
                      </Link>
                    ) : (
                      <span className="text-sm text-navy-800">{payment.serviceName}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm capitalize text-muted-foreground">
                      {payment.provider}
                      {payment.channel && ` · ${payment.channel.replace(/_/g, ' ')}`}
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
                        −{formatNaira(payment.refundedKobo)} refunded
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <StatusBadge kind="payment" status={payment.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold text-navy-800">{value}</p>
    </div>
  );
}
