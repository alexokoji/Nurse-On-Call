import 'server-only';
import { connectDB } from '@/lib/db/connect';
import { Booking, Payment, Invoice, Refund, nextReference, type IPayment } from '@/models';
import { getSettings } from '@/lib/settings';
import { notify } from '@/lib/notifications/service';
import { recordAudit } from '@/lib/audit';
import { onBookingConfirmed } from '@/lib/bookings/service';
import { formatNaira } from '@/lib/utils';
import type { PaymentProvider } from '@/types';
import type { PaymentGateway } from './types';
import { PaystackProvider } from './providers/paystack';
import { FlutterwaveProvider } from './providers/flutterwave';
import { KorapayProvider } from './providers/korapay';
import type { CurrentUser } from '@/lib/auth/current-user';

/**
 * The single entry point the rest of the application uses for money.
 *
 * Two rules hold throughout:
 *   1. A payment becomes successful only after the *gateway* is asked. The
 *      browser's redirect is a hint, never evidence.
 *   2. The amount is compared against the booking total before confirming, so
 *      an under-payment cannot confirm an appointment.
 */

const gateways: Record<Exclude<PaymentProvider, 'manual'>, PaymentGateway> = {
  paystack: new PaystackProvider(),
  flutterwave: new FlutterwaveProvider(),
  korapay: new KorapayProvider(),
};

export function getGateway(provider: PaymentProvider): PaymentGateway {
  if (provider === 'manual') throw new PaymentError('Manual payments have no gateway.');
  const gateway = gateways[provider];
  if (!gateway) throw new PaymentError(`Unknown payment provider: ${provider}`);
  return gateway;
}

/** Providers that are both enabled in settings and hold API keys. */
export async function availableProviders(): Promise<PaymentProvider[]> {
  const settings = await getSettings('payments');
  return settings.enabledProviders.filter((provider) => gateways[provider]?.isConfigured());
}

export class PaymentError extends Error {
  constructor(
    message: string,
    public code: 'NOT_FOUND' | 'GATEWAY' | 'CONFLICT' | 'VALIDATION' = 'VALIDATION',
  ) {
    super(message);
    this.name = 'PaymentError';
  }
}

/* ── Initialisation ───────────────────────────────────────────────── */

export interface CreatePaymentResult {
  payment: IPayment;
  authorizationUrl: string;
}

export async function createPayment(params: {
  bookingId: string;
  provider?: PaymentProvider;
  /** Absolute URL the gateway returns the patient to. */
  callbackUrl: string;
}): Promise<CreatePaymentResult> {
  await connectDB();

  const booking = await Booking.findById(params.bookingId);
  if (!booking) throw new PaymentError('Booking not found.', 'NOT_FOUND');
  if (booking.isPaid) throw new PaymentError('This booking has already been paid.', 'CONFLICT');
  if (booking.status === 'cancelled' || booking.status === 'expired') {
    throw new PaymentError('This booking is no longer active.', 'CONFLICT');
  }
  if (booking.totalKobo <= 0) {
    throw new PaymentError('This booking has nothing to pay.', 'VALIDATION');
  }

  const settings = await getSettings('payments');
  const provider = params.provider ?? settings.defaultProvider;
  const gateway = getGateway(provider);

  if (!gateway.isConfigured()) {
    throw new PaymentError(
      'Online payment is not available right now. Please contact us to complete your booking.',
      'GATEWAY',
    );
  }

  /* Reuse a still-pending attempt rather than orphaning transactions. */
  const existing = await Payment.findOne({
    booking: booking._id,
    status: 'pending',
    provider,
  });
  if (existing?.authorizationUrl) {
    return { payment: existing, authorizationUrl: existing.authorizationUrl };
  }

  const reference = await nextReference('payment');

  const payment = await Payment.create({
    reference,
    booking: booking._id,
    patient: booking.patient,
    provider,
    amountKobo: booking.totalKobo,
    currency: settings.currency,
    status: 'pending',
    metadata: { bookingReference: booking.reference },
  });

  const result = await gateway.initialize({
    reference,
    amountKobo: booking.totalKobo,
    currency: settings.currency,
    email: booking.contact.email,
    name: booking.contact.name,
    phone: booking.contact.phone,
    callbackUrl: params.callbackUrl,
    metadata: { bookingId: String(booking._id), bookingReference: booking.reference },
  });

  if (!result.ok || !result.authorizationUrl) {
    payment.status = 'failed';
    payment.failureReason = result.error;
    await payment.save();
    throw new PaymentError(result.error ?? 'Unable to start the payment.', 'GATEWAY');
  }

  payment.authorizationUrl = result.authorizationUrl;
  payment.providerReference = result.providerReference ?? null;
  await payment.save();

  return { payment, authorizationUrl: result.authorizationUrl };
}

/* ── Verification ─────────────────────────────────────────────────── */

export interface VerificationOutcome {
  status: 'successful' | 'failed' | 'pending';
  payment: IPayment;
  bookingReference: string;
  message: string;
}

/**
 * Ask the gateway what actually happened and settle our records accordingly.
 *
 * Safe to call repeatedly — the redirect handler and the webhook both call it,
 * and whichever arrives first does the work while the other becomes a no-op.
 */
export async function verifyPayment(params: {
  reference: string;
  /** Marks the payment as independently webhook-confirmed. */
  viaWebhook?: boolean;
}): Promise<VerificationOutcome> {
  await connectDB();

  const payment = await Payment.findOne({ reference: params.reference });
  if (!payment) throw new PaymentError('Payment record not found.', 'NOT_FOUND');

  const booking = await Booking.findById(payment.booking);
  if (!booking) throw new PaymentError('Related booking not found.', 'NOT_FOUND');

  /* Already settled — report the stored outcome. */
  if (payment.status === 'successful') {
    if (params.viaWebhook && !payment.webhookVerifiedAt) {
      payment.webhookVerifiedAt = new Date();
      await payment.save();
    }
    return {
      status: 'successful',
      payment,
      bookingReference: booking.reference,
      message: 'This payment has already been confirmed.',
    };
  }

  const gateway = getGateway(payment.provider);
  const result = await gateway.verify(payment.reference);

  if (!result.ok) {
    return {
      status: 'pending',
      payment,
      bookingReference: booking.reference,
      message: result.error ?? 'We could not confirm this payment yet.',
    };
  }

  if (!result.successful) {
    payment.status = 'failed';
    payment.failureReason = 'The gateway reported an unsuccessful charge.';
    payment.providerResponse = result.raw as Record<string, unknown>;
    payment.verifiedAt = new Date();
    await payment.save();

    return {
      status: 'failed',
      payment,
      bookingReference: booking.reference,
      message: 'The payment was not completed. Your slot is held briefly — you can try again.',
    };
  }

  /* Guard against an under-payment confirming a booking. */
  if (result.amountKobo < booking.totalKobo) {
    payment.status = 'failed';
    payment.amountPaidKobo = result.amountKobo;
    payment.failureReason = `Amount paid (${formatNaira(result.amountKobo)}) is less than the booking total (${formatNaira(booking.totalKobo)}).`;
    payment.providerResponse = result.raw as Record<string, unknown>;
    payment.verifiedAt = new Date();
    await payment.save();

    return {
      status: 'failed',
      payment,
      bookingReference: booking.reference,
      message: 'The amount received did not match the booking total. Please contact support.',
    };
  }

  /* Settle. */
  payment.status = 'successful';
  payment.amountPaidKobo = result.amountKobo;
  payment.providerReference = result.providerReference ?? payment.providerReference;
  payment.channel = result.channel;
  payment.fees = result.fees;
  payment.paidAt = result.paidAt ?? new Date();
  payment.verifiedAt = new Date();
  if (params.viaWebhook) payment.webhookVerifiedAt = new Date();
  payment.providerResponse = result.raw as Record<string, unknown>;
  await payment.save();

  const wasPending = booking.status === 'pending_payment';
  booking.isPaid = true;
  booking.paidAt = payment.paidAt;
  booking.holdExpiresAt = null;
  if (wasPending) booking.status = 'confirmed';
  await booking.save();

  const invoice = await issueInvoice(String(booking._id), String(payment._id));

  await recordAudit({
    action: 'payment.verified',
    entity: 'Payment',
    entityId: String(payment._id),
    summary: `Payment ${payment.reference} confirmed for booking ${booking.reference} (${formatNaira(result.amountKobo)})`,
    after: { status: 'successful', amountKobo: result.amountKobo, invoice: invoice?.number },
  });

  await notify({
    recipientId: String(booking.patient),
    template: 'payment_confirmation',
    channels: ['email', 'in_app'],
    data: {
      reference: booking.reference,
      serviceName: booking.snapshot.serviceName,
      dateKey: booking.dateKey,
      startTime: booking.startTime,
      amountKobo: result.amountKobo,
    },
    link: `/patient/appointments/${booking._id}`,
    relatedBooking: String(booking._id),
  });

  if (wasPending) await onBookingConfirmed(booking);

  return {
    status: 'successful',
    payment,
    bookingReference: booking.reference,
    message: 'Payment confirmed. Your appointment is booked.',
  };
}

/* ── Receipts ─────────────────────────────────────────────────────── */

async function issueInvoice(bookingId: string, paymentId: string) {
  const existing = await Invoice.findOne({ payment: paymentId });
  if (existing) return existing;

  const booking = await Booking.findById(bookingId).lean();
  if (!booking) return null;

  const lines = [
    {
      description: booking.snapshot.serviceName,
      quantity: 1,
      unitPriceKobo: booking.servicePriceKobo,
      totalKobo: booking.servicePriceKobo,
    },
  ];

  if (booking.surchargeKobo > 0) {
    lines.push({
      description: 'Home visit surcharge',
      quantity: 1,
      unitPriceKobo: booking.surchargeKobo,
      totalKobo: booking.surchargeKobo,
    });
  }

  return Invoice.create({
    number: await nextReference('invoice'),
    booking: booking._id,
    payment: paymentId,
    patient: booking.patient,
    lines,
    subtotalKobo: booking.servicePriceKobo + booking.surchargeKobo,
    discountKobo: booking.discountKobo,
    totalKobo: booking.totalKobo,
  });
}

/* ── Refunds ──────────────────────────────────────────────────────── */

export async function requestRefund(params: {
  paymentId: string;
  amountKobo: number;
  reason: string;
  actor: CurrentUser;
}) {
  await connectDB();

  const payment = await Payment.findById(params.paymentId);
  if (!payment) throw new PaymentError('Payment not found.', 'NOT_FOUND');
  if (payment.status !== 'successful' && payment.status !== 'partially_refunded') {
    throw new PaymentError('Only a successful payment can be refunded.', 'CONFLICT');
  }

  const remaining = payment.amountPaidKobo - payment.refundedKobo;
  if (params.amountKobo > remaining) {
    throw new PaymentError(
      `The most that can still be refunded on this payment is ${formatNaira(remaining)}.`,
      'VALIDATION',
    );
  }

  const refund = await Refund.create({
    reference: await nextReference('refund'),
    payment: payment._id,
    booking: payment.booking,
    patient: payment.patient,
    amountKobo: params.amountKobo,
    reason: params.reason,
    status: 'requested',
    requestedBy: params.actor.id,
  });

  await recordAudit({
    actor: params.actor,
    action: 'refund.request',
    entity: 'Refund',
    entityId: String(refund._id),
    summary: `Refund of ${formatNaira(params.amountKobo)} requested for payment ${payment.reference}`,
    after: { amountKobo: params.amountKobo, reason: params.reason },
  });

  return refund;
}

/**
 * Approve and execute a refund, or reject it.
 * Approval calls the gateway; our records only move to `completed` when the
 * gateway accepts, or `processing` when it settles asynchronously.
 */
export async function decideRefund(params: {
  refundId: string;
  decision: 'approve' | 'reject';
  note?: string;
  actor: CurrentUser;
}) {
  await connectDB();

  const refund = await Refund.findById(params.refundId);
  if (!refund) throw new PaymentError('Refund not found.', 'NOT_FOUND');
  if (refund.status !== 'requested') {
    throw new PaymentError(`This refund has already been ${refund.status}.`, 'CONFLICT');
  }

  refund.reviewedBy = params.actor.id as never;
  refund.reviewedAt = new Date();
  refund.reviewNote = params.note;

  if (params.decision === 'reject') {
    refund.status = 'rejected';
    await refund.save();

    await recordAudit({
      actor: params.actor,
      action: 'refund.reject',
      entity: 'Refund',
      entityId: String(refund._id),
      summary: `Refund ${refund.reference} rejected`,
      after: { status: 'rejected', note: params.note },
    });
    return refund;
  }

  const payment = await Payment.findById(refund.payment);
  if (!payment) throw new PaymentError('Related payment not found.', 'NOT_FOUND');

  refund.status = 'processing';
  await refund.save();

  const gateway = getGateway(payment.provider);
  const result = await gateway.refund({
    providerReference: payment.providerReference ?? '',
    reference: payment.reference,
    amountKobo: refund.amountKobo,
    reason: refund.reason,
  });

  if (!result.ok) {
    refund.status = 'failed';
    refund.failureReason = result.error;
    await refund.save();
    throw new PaymentError(result.error ?? 'The gateway rejected the refund.', 'GATEWAY');
  }

  refund.status = result.pending ? 'processing' : 'completed';
  refund.providerReference = result.providerReference ?? null;
  refund.providerResponse = result.raw as Record<string, unknown>;
  refund.processedAt = result.pending ? null : new Date();
  await refund.save();

  payment.refundedKobo += refund.amountKobo;
  payment.status =
    payment.refundedKobo >= payment.amountPaidKobo ? 'refunded' : 'partially_refunded';
  await payment.save();

  await recordAudit({
    actor: params.actor,
    action: 'refund.approve',
    entity: 'Refund',
    entityId: String(refund._id),
    summary: `Refund ${refund.reference} of ${formatNaira(refund.amountKobo)} approved`,
    after: { status: refund.status, amountKobo: refund.amountKobo },
  });

  await notify({
    recipientId: String(refund.patient),
    template: 'refund',
    channels: ['email', 'in_app'],
    data: { reference: refund.reference, amountKobo: refund.amountKobo },
    relatedBooking: String(refund.booking),
  });

  return refund;
}
