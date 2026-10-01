import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { Receipt } from 'lucide-react';
import { EmptyState } from '@/components/ui/feedback';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientReceipts } from '@/lib/queries/patient';
import { getSettings } from '@/lib/settings';
import { formatNaira } from '@/lib/utils';
import { PrintButton } from './print-button';

export const metadata: Metadata = { title: 'Receipts' };

export default async function PatientReceiptsPage() {
  const user = await requirePatient();
  const [receipts, general] = await Promise.all([
    getPatientReceipts(user.id),
    getSettings('general'),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">Receipts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A receipt is issued automatically for every completed payment.
          </p>
        </div>
        {receipts.length > 0 && <PrintButton />}
      </div>

      {receipts.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No receipts yet"
          description="Once a payment completes, its receipt appears here ready to print or save."
          action={{ label: 'Book a service', href: '/book' }}
        />
      ) : (
        <div className="space-y-5">
          {receipts.map((receipt) => (
            <article
              key={receipt.id}
              className="rounded-xl border border-border bg-card p-6 shadow-card"
            >
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
                <div>
                  <p className="font-display text-lg font-bold text-navy-800">
                    {general.organisationName}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{general.address}</p>
                  <p className="text-xs text-muted-foreground">
                    {general.phone} · {general.supportEmail}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Receipt</p>
                  <p className="font-mono text-sm font-semibold text-navy-800">{receipt.number}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {format(new Date(receipt.issuedAt), 'd MMMM yyyy')}
                  </p>
                </div>
              </header>

              <div className="grid gap-4 py-5 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Billed to</p>
                  <p className="mt-1 text-sm font-medium text-navy-800">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
                <div className="sm:text-right">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Appointment
                  </p>
                  {receipt.bookingId ? (
                    <Link
                      href={`/patient/appointments/${receipt.bookingId}`}
                      className="mt-1 block font-mono text-sm text-primary hover:underline"
                    >
                      {receipt.bookingReference}
                    </Link>
                  ) : (
                    <p className="mt-1 font-mono text-sm text-navy-800">
                      {receipt.bookingReference}
                    </p>
                  )}
                  {receipt.dateKey && (
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(receipt.dateKey), 'd MMM yyyy')}
                    </p>
                  )}
                </div>
              </div>

              <table className="w-full border-t border-border text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2.5 font-medium">Description</th>
                    <th className="py-2.5 text-center font-medium">Qty</th>
                    <th className="py-2.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {receipt.lines.map((line, index) => (
                    <tr key={index}>
                      <td className="py-2.5 text-navy-800">{line.description}</td>
                      <td className="py-2.5 text-center text-muted-foreground">{line.quantity}</td>
                      <td className="py-2.5 text-right text-navy-800">
                        {formatNaira(line.totalKobo)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border">
                  <tr>
                    <td colSpan={2} className="py-2 text-right text-muted-foreground">
                      Subtotal
                    </td>
                    <td className="py-2 text-right text-navy-800">
                      {formatNaira(receipt.subtotalKobo)}
                    </td>
                  </tr>
                  {receipt.discountKobo > 0 && (
                    <tr className="text-emerald-700">
                      <td colSpan={2} className="py-1 text-right">
                        Discount
                      </td>
                      <td className="py-1 text-right">−{formatNaira(receipt.discountKobo)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={2} className="pt-2 text-right font-semibold text-navy-800">
                      Total paid
                    </td>
                    <td className="pt-2 text-right font-display text-base font-bold text-navy-800">
                      {formatNaira(receipt.totalKobo)}
                    </td>
                  </tr>
                </tfoot>
              </table>

              <p className="mt-5 border-t border-border pt-4 text-xs text-muted-foreground">
                Thank you for choosing {general.organisationName}. This receipt confirms payment
                received in full for the service listed above.
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
