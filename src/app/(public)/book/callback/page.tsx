import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { verifyPayment } from '@/lib/payments/service';
import { getCurrentUser } from '@/lib/auth/current-user';
import { formatNaira } from '@/lib/utils';

export const metadata: Metadata = {
  title: 'Confirming your payment',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/**
 * Where the gateway returns the patient after checkout.
 *
 * The redirect's query string is treated as a *hint only*: the reference is
 * used to look the payment up, and the outcome comes from asking the gateway
 * directly. A crafted `?status=success` in the URL changes nothing.
 */
export default async function PaymentCallbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();

  if (!user) redirect('/login');

  // Each gateway names the reference differently on the return URL.
  const reference = params.reference ?? params.tx_ref ?? params.trxref;

  if (!reference) {
    return (
      <Shell
        tone="error"
        icon={AlertCircle}
        title="We couldn't identify that payment"
        message="No payment reference was returned. If money left your account, contact us with the time of the transaction and we will trace it."
      >
        <Button asChild>
          <Link href="/patient/appointments">View my appointments</Link>
        </Button>
      </Shell>
    );
  }

  let outcome;
  try {
    outcome = await verifyPayment({ reference });
  } catch (error) {
    console.error('[payment-callback] verification failed', error);
    return (
      <Shell
        tone="warning"
        icon={Clock}
        title="We're still confirming your payment"
        message="Your bank has not confirmed this yet. It usually settles within a few minutes — your appointment will update automatically once it does."
      >
        <Button asChild>
          <Link href="/patient/appointments">View my appointments</Link>
        </Button>
      </Shell>
    );
  }

  if (String(outcome.payment.patient) !== user.id) {
    redirect('/patient/appointments');
  }

  const bookingId = String(outcome.payment.booking);

  if (outcome.status === 'successful') {
    return (
      <Shell
        tone="success"
        icon={CheckCircle2}
        title="Payment confirmed"
        message={`Your appointment ${outcome.bookingReference} is booked. We've emailed the details and your receipt.`}
        amount={outcome.payment.amountPaidKobo}
      >
        <Button asChild size="lg">
          <Link href={`/patient/appointments/${bookingId}`}>View appointment</Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/patient/dashboard">Go to dashboard</Link>
        </Button>
      </Shell>
    );
  }

  if (outcome.status === 'pending') {
    return (
      <Shell
        tone="warning"
        icon={Clock}
        title="Payment is still processing"
        message={outcome.message}
      >
        <Button asChild>
          <Link href={`/patient/appointments/${bookingId}`}>View appointment</Link>
        </Button>
      </Shell>
    );
  }

  return (
    <Shell
      tone="error"
      icon={XCircle}
      title="That payment didn't go through"
      message={outcome.message}
    >
      <Button asChild size="lg">
        <Link href={`/patient/appointments/${bookingId}`}>Try paying again</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/contact">Contact support</Link>
      </Button>
    </Shell>
  );
}

function Shell({
  tone,
  icon: Icon,
  title,
  message,
  amount,
  children,
}: {
  tone: 'success' | 'warning' | 'error';
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  amount?: number;
  children: React.ReactNode;
}) {
  const tones = {
    success: 'bg-emerald-50 text-emerald-600',
    warning: 'bg-amber-50 text-amber-600',
    error: 'bg-red-50 text-red-600',
  }[tone];

  return (
    <div className="container flex min-h-[70vh] items-center justify-center py-16">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-8 text-center shadow-lift">
        <span className={`mx-auto flex size-14 items-center justify-center rounded-full ${tones}`}>
          <Icon className="size-7" aria-hidden />
        </span>

        <h1 className="mt-5 font-display text-2xl font-bold tracking-tight text-navy-800">
          {title}
        </h1>

        {amount !== undefined && amount > 0 && (
          <p className="mt-2 font-display text-xl font-bold text-navy-800">{formatNaira(amount)}</p>
        )}

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{message}</p>

        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">{children}</div>
      </div>
    </div>
  );
}
