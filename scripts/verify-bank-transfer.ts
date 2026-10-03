/**
 * Integration checks for bank transfer.
 *
 * The method has no gateway to ask, so the guarantees that matter are about
 * state rather than cryptography: a transfer must not confirm an appointment
 * on its own, starting one twice must not create two payments to reconcile,
 * and only an administrator's confirmation marks the money received.
 *
 * Cleans up after itself.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/verify-bank-transfer.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { Booking, Notification, Payment, Service, Setting, StaffProfile, User } from '../src/models';
import {
  getBankTransferOffer,
  startBankTransfer,
  confirmBankTransfer,
  declineBankTransfer,
  pendingBankTransfer,
} from '../src/lib/payments/bank-transfer';
import { toDateKey, minutesToTime } from '../src/lib/utils';

const REFERENCE = 'APT-TRANSFER-TEST';

let failures = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label.padEnd(54)} ${actual}`);
  if (!ok) {
    console.log(`      expected ${expected}`);
    failures += 1;
  }
}

let savedSettings: Record<string, unknown> | null = null;

async function cleanup() {
  const bookings = await Booking.find({ reference: REFERENCE }).select('_id').lean();
  const ids = bookings.map((b) => b._id);
  if (ids.length > 0) {
    await Payment.deleteMany({ booking: { $in: ids } });
    await Notification.deleteMany({ relatedBooking: { $in: ids } });
  }
  await Booking.deleteMany({ reference: REFERENCE });
}

async function makeBooking() {
  const [patient, service, staff] = await Promise.all([
    User.findOne({ role: 'patient', status: 'active' }).lean(),
    Service.findOne({ status: 'published' }).lean(),
    StaffProfile.findOne({ isActive: true }).lean(),
  ]);

  if (!patient || !service || !staff) {
    throw new Error('Seed the database first: npm run seed -- --fresh');
  }

  const startAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
  const startMinutes = startAt.getHours() * 60 + startAt.getMinutes();

  return Booking.create({
    reference: REFERENCE,
    patient: patient._id,
    service: service._id,
    staff: staff._id,
    snapshot: {
      serviceName: service.name,
      serviceSlug: service.slug,
      durationMinutes: service.durationMinutes,
      bufferMinutes: service.bufferMinutes,
    },
    dateKey: toDateKey(startAt),
    startTime: minutesToTime(startMinutes),
    endTime: minutesToTime(startMinutes + service.durationMinutes),
    startAt,
    endAt: new Date(startAt.getTime() + service.durationMinutes * 60 * 1000),
    locationType: 'clinic',
    contact: { name: patient.name, phone: patient.phone ?? '+2348030000000', email: patient.email },
    status: 'pending_payment',
    servicePriceKobo: service.priceKobo,
    surchargeKobo: 0,
    discountKobo: 0,
    totalKobo: service.priceKobo,
    isPaid: false,
    holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
  });
}

async function setBankTransfer(values: Record<string, unknown>) {
  const doc = await Setting.findOne({ group: 'payments' }).lean();
  await Setting.updateOne(
    { group: 'payments' },
    { $set: { 'values.bankTransfer': values } },
    { upsert: true },
  );
  if (savedSettings === null) savedSettings = (doc?.values ?? {}) as Record<string, unknown>;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('\n🏦 Bank transfer\n');

  await cleanup();

  const CONFIGURED = {
    enabled: true,
    bankName: 'Guaranty Trust Bank',
    accountName: 'NurseOnCall Limited',
    accountNumber: '0123456789',
    instructions: 'Quote your reference.',
    holdHours: 24,
  };

  /* ── Availability ────────────────────────────────────────────────── */

  console.log('Availability');

  await setBankTransfer({ ...CONFIGURED, enabled: false });
  expect('off when disabled', (await getBankTransferOffer()).available, false);

  await setBankTransfer({ ...CONFIGURED, accountNumber: '' });
  expect('off when the account number is missing', (await getBankTransferOffer()).available, false);

  await setBankTransfer({ ...CONFIGURED, accountNumber: '12345' });
  expect('off when the account number is too short', (await getBankTransferOffer()).available, false);

  await setBankTransfer({ ...CONFIGURED, bankName: '' });
  expect('off when the bank is missing', (await getBankTransferOffer()).available, false);

  await setBankTransfer(CONFIGURED);
  expect('on when fully configured', (await getBankTransferOffer()).available, true);

  /* ── Starting a transfer ─────────────────────────────────────────── */

  console.log('\nStarting a transfer');

  const booking = await makeBooking();
  const started = await startBankTransfer(String(booking._id));

  expect('the payment is pending, not successful', started.payment.status, 'pending');
  expect('nothing is recorded as paid yet', started.payment.amountPaidKobo, 0);
  expect('the narration is the booking reference', started.narration, REFERENCE);

  const afterStart = await Booking.findById(booking._id).lean();
  expect('the booking is still unpaid', afterStart?.isPaid, false);
  expect('and still awaiting payment', afterStart?.status, 'pending_payment');
  expect(
    'the hold is extended to the configured window',
    afterStart?.holdExpiresAt
      ? Math.round((afterStart.holdExpiresAt.getTime() - Date.now()) / 3_600_000)
      : 0,
    24,
  );

  /* Twice must not create two payments for one booking to reconcile. */
  const again = await startBankTransfer(String(booking._id));
  expect('starting again reuses the same payment', String(again.payment._id), String(started.payment._id));
  expect(
    'so only one pending payment exists',
    await Payment.countDocuments({ booking: booking._id, provider: 'bank_transfer' }),
    1,
  );

  /* ── Declining ───────────────────────────────────────────────────── */

  console.log('\nDeclining');

  const declined = await declineBankTransfer(
    String(started.payment._id),
    { id: 'tester', name: 'Tester' },
    'No transfer found with that reference.',
  );
  expect('the payment is failed', declined.payment.status, 'failed');
  expect('the booking is still unpaid', declined.booking.isPaid, false);
  expect(
    'the long hold is dropped',
    (declined.booking.holdExpiresAt?.getTime() ?? Infinity) <= Date.now() + 1000,
    true,
  );
  expect(
    'the patient is told',
    (await Notification.countDocuments({ relatedBooking: booking._id })) > 0,
    true,
  );

  /* Deliberately allowed: money declined on Monday sometimes lands on
     Tuesday, and the alternative is an administrator with no way to fix it.
     Only an already-successful payment is protected, below. */
  expect(
    'a declined transfer can still be confirmed if the money arrives',
    await confirmBankTransfer(String(started.payment._id), { id: 'tester', name: 'Tester' })
      .then(() => 'confirmed')
      .catch(() => 'refused'),
    'confirmed',
  );

  /* ── Confirming ──────────────────────────────────────────────────── */

  console.log('\nConfirming');

  const settled = await Booking.findById(booking._id).lean();
  expect('confirming marks the booking paid', settled?.isPaid, true);
  expect('and confirms the appointment', settled?.status, 'confirmed');
  expect('and clears the hold', settled?.holdExpiresAt ?? null, null);

  const settledPayment = await Payment.findById(started.payment._id).lean();
  expect('the payment records the full amount', settledPayment?.amountPaidKobo, settled?.totalKobo);
  expect('the actor is recorded', (settledPayment?.metadata as { confirmedByName?: string })?.confirmedByName, 'Tester');

  expect(
    'confirming twice is refused',
    await confirmBankTransfer(String(started.payment._id), { id: 'tester', name: 'Tester' })
      .then(() => 'confirmed again')
      .catch(() => 'refused'),
    'refused',
  );

  expect('no pending transfer remains', await pendingBankTransfer(String(booking._id)), null);

  /* ── Restore ─────────────────────────────────────────────────────── */

  await cleanup();
  if (savedSettings) {
    await Setting.updateOne({ group: 'payments' }, { $set: { values: savedSettings } });
  }
  await mongoose.disconnect();

  console.log(
    failures === 0
      ? '\n\x1b[32m✓ Bank transfer settles only when a person confirms it\x1b[0m\n'
      : `\n\x1b[31m✗ ${failures} check(s) failed\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await cleanup();
    if (savedSettings) {
      await Setting.updateOne({ group: 'payments' }, { $set: { values: savedSettings } });
    }
    await mongoose.disconnect();
  } catch {
    /* already disconnected */
  }
  process.exit(1);
});
