import 'server-only';
import { connectDB } from '@/lib/db/connect';
import { Booking, Payment, nextReference } from '@/models';
import { getSettings } from '@/lib/settings';
import { onBookingConfirmed } from '@/lib/bookings/service';
import { notify } from '@/lib/notifications/service';
import { formatNaira } from '@/lib/utils';
import { PaymentError } from './service';
import type { IBooking } from '@/models/Booking';
import type { IPayment } from '@/models/Payment';

/**
 * Bank transfer.
 *
 * The one payment method with no gateway to ask: the money arrives in a bank
 * account and a person confirms it. That shapes the whole design.
 *
 *   - A transfer takes minutes or hours, not seconds, so the slot is held for
 *     a configurable number of hours instead of the usual payment window.
 *     Otherwise the slot is released while the patient is still at the bank.
 *   - The payment sits at `pending` until an administrator confirms it. Only
 *     that confirmation marks the booking paid, so nobody can confirm their
 *     own appointment by claiming to have paid.
 *   - The booking reference is the narration the patient is asked to quote,
 *     which is what makes an arriving transfer matchable to an appointment.
 */

export interface BankTransferOffer {
  /** Switched on in Settings → Payments *and* fully filled in. */
  available: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  instructions: string;
  holdHours: number;
}

/**
 * What the checkout should show. Returns `available: false` when the method is
 * off or incompletely configured, so a half-filled account is never offered.
 */
export async function getBankTransferOffer(): Promise<BankTransferOffer> {
  const { bankTransfer } = await getSettings('payments');

  const complete =
    bankTransfer.bankName.trim().length > 0 &&
    bankTransfer.accountName.trim().length > 0 &&
    /^\d{10}$/.test(bankTransfer.accountNumber.trim());

  return {
    available: bankTransfer.enabled && complete,
    bankName: bankTransfer.bankName,
    accountName: bankTransfer.accountName,
    accountNumber: bankTransfer.accountNumber,
    instructions: bankTransfer.instructions,
    holdHours: bankTransfer.holdHours,
  };
}

export interface StartedBankTransfer {
  payment: IPayment;
  offer: BankTransferOffer;
  /** The narration the patient must quote. */
  narration: string;
  holdExpiresAt: Date;
}

/**
 * Records a patient's intent to pay by transfer and extends the hold.
 *
 * Idempotent: a patient who reloads the page, or taps the button twice, gets
 * the pending payment that already exists rather than a second one. Without
 * that, the payments screen would fill with duplicates for one booking and an
 * administrator could not tell which to confirm.
 */
export async function startBankTransfer(bookingId: string): Promise<StartedBankTransfer> {
  await connectDB();

  const offer = await getBankTransferOffer();
  if (!offer.available) {
    throw new PaymentError('Bank transfer is not available right now.', 'VALIDATION');
  }

  const booking = await Booking.findById(bookingId);
  if (!booking) throw new PaymentError('Booking not found.', 'NOT_FOUND');
  if (booking.isPaid) throw new PaymentError('This booking is already paid.', 'CONFLICT');
  if (!['pending_payment', 'confirmed'].includes(booking.status)) {
    throw new PaymentError('This booking is no longer awaiting payment.', 'CONFLICT');
  }

  const holdExpiresAt = new Date(Date.now() + offer.holdHours * 60 * 60 * 1000);

  const existing = await Payment.findOne({
    booking: booking._id,
    provider: 'bank_transfer',
    status: 'pending',
  });

  if (existing) {
    /* Re-extend the hold: the patient is evidently still trying to pay. */
    booking.holdExpiresAt = holdExpiresAt;
    await booking.save();
    return { payment: existing, offer, narration: booking.reference, holdExpiresAt };
  }

  const payment = await Payment.create({
    reference: await nextReference('payment'),
    booking: booking._id,
    patient: booking.patient,
    provider: 'bank_transfer',
    amountKobo: booking.totalKobo,
    amountPaidKobo: 0,
    currency: 'NGN',
    status: 'pending',
    channel: 'bank_transfer',
    metadata: {
      narration: booking.reference,
      accountNumber: offer.accountNumber,
      bankName: offer.bankName,
    },
  });

  booking.holdExpiresAt = holdExpiresAt;
  await booking.save();

  await notify({
    recipientId: String(booking.patient),
    template: 'custom',
    channels: ['email', 'in_app'],
    data: {
      subject: `Complete your transfer for ${booking.reference}`,
      body:
        `Transfer ${formatNaira(booking.totalKobo)} to:\n\n` +
        `Bank:            ${offer.bankName}\n` +
        `Account name:    ${offer.accountName}\n` +
        `Account number:  ${offer.accountNumber}\n` +
        `Narration:       ${booking.reference}\n\n` +
        `We hold your appointment for ${offer.holdHours} hour(s) and confirm it as soon as the ` +
        `transfer lands. Quote the narration exactly so we can match your payment.`,
    },
    link: `/patient/appointments/${booking._id}`,
    relatedBooking: String(booking._id),
  });

  return { payment, offer, narration: booking.reference, holdExpiresAt };
}

/** The pending transfer for a booking, if the patient started one. */
export async function pendingBankTransfer(bookingId: string): Promise<IPayment | null> {
  await connectDB();
  return Payment.findOne({
    booking: bookingId,
    provider: 'bank_transfer',
    status: 'pending',
  }).lean<IPayment | null>();
}

export interface SettleResult {
  booking: IBooking;
  payment: IPayment;
}

/**
 * An administrator has seen the money arrive.
 *
 * `amountPaidKobo` is taken from the booking total rather than typed in,
 * because this is a confirmation that the expected amount arrived — a part
 * payment is a different conversation, and recording it here would mark the
 * appointment paid in full.
 */
export async function confirmBankTransfer(
  paymentId: string,
  actor: { id: string; name: string },
  note?: string,
): Promise<SettleResult> {
  await connectDB();

  const payment = await Payment.findById(paymentId);
  if (!payment) throw new PaymentError('Payment not found.', 'NOT_FOUND');
  if (payment.provider !== 'bank_transfer') {
    throw new PaymentError('That payment is not a bank transfer.', 'VALIDATION');
  }
  if (payment.status === 'successful') {
    throw new PaymentError('That transfer is already confirmed.', 'CONFLICT');
  }

  const booking = await Booking.findById(payment.booking);
  if (!booking) throw new PaymentError('Booking not found.', 'NOT_FOUND');

  const now = new Date();

  payment.status = 'successful';
  payment.amountPaidKobo = booking.totalKobo;
  payment.paidAt = now;
  payment.verifiedAt = now;
  payment.metadata = {
    ...(payment.metadata ?? {}),
    confirmedBy: actor.id,
    confirmedByName: actor.name,
    confirmationNote: note,
  };
  await payment.save();

  const wasPending = booking.status === 'pending_payment';
  booking.isPaid = true;
  booking.paidAt = now;
  booking.holdExpiresAt = null;
  if (wasPending) booking.status = 'confirmed';
  await booking.save();

  /* Only on the transition, or a patient whose appointment was already
     confirmed gets a second confirmation message. */
  if (wasPending) await onBookingConfirmed(booking);

  return { booking, payment };
}

/** The money never arrived, or arrived short. Releases the slot. */
export async function declineBankTransfer(
  paymentId: string,
  actor: { id: string; name: string },
  reason: string,
): Promise<SettleResult> {
  await connectDB();

  const payment = await Payment.findById(paymentId);
  if (!payment) throw new PaymentError('Payment not found.', 'NOT_FOUND');
  if (payment.provider !== 'bank_transfer') {
    throw new PaymentError('That payment is not a bank transfer.', 'VALIDATION');
  }
  if (payment.status === 'successful') {
    throw new PaymentError(
      'That transfer is already confirmed. Raise a refund instead.',
      'CONFLICT',
    );
  }

  const booking = await Booking.findById(payment.booking);
  if (!booking) throw new PaymentError('Booking not found.', 'NOT_FOUND');

  payment.status = 'failed';
  payment.failureReason = reason;
  payment.metadata = {
    ...(payment.metadata ?? {}),
    declinedBy: actor.id,
    declinedByName: actor.name,
  };
  await payment.save();

  /* The booking is left pending rather than cancelled: the patient may still
     pay by card, and an administrator can cancel it deliberately. The long
     transfer hold is dropped so the slot is not held for nothing. */
  if (!booking.isPaid && booking.status === 'pending_payment') {
    booking.holdExpiresAt = new Date();
    await booking.save();
  }

  await notify({
    recipientId: String(booking.patient),
    template: 'custom',
    channels: ['email', 'in_app'],
    data: {
      subject: `We could not confirm your transfer for ${booking.reference}`,
      body:
        `We have not been able to match a transfer to ${booking.reference}.\n\n` +
        `${reason}\n\n` +
        `Your appointment is not confirmed yet. You can pay by card from your dashboard, or ` +
        `reply to this message with your transfer receipt and we will check again.`,
    },
    link: `/patient/appointments/${booking._id}`,
    relatedBooking: String(booking._id),
  });

  return { booking, payment };
}
