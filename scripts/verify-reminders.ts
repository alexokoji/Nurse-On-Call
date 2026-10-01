/**
 * Integration check for appointment reminders.
 *
 * Creates a confirmed booking inside the reminder window, runs the dispatcher
 * twice, and asserts it sends exactly once — the idempotency that stops two
 * overlapping cron runs double-messaging a patient. Cleans up after itself.
 *
 *   npx tsx scripts/verify-reminders.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { Booking, Notification, Service, StaffProfile, User } from '../src/models';
import { sendDueReminders } from '../src/lib/bookings/reminders';
import { toDateKey, minutesToTime } from '../src/lib/utils';

const REFERENCE = 'APT-REMINDER-TEST';

let failures = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label.padEnd(50)} ${actual}`);
  if (!ok) {
    console.log(`      expected ${expected}`);
    failures += 1;
  }
}

async function cleanup() {
  const booking = await Booking.findOne({ reference: REFERENCE }).lean();
  if (booking) await Notification.deleteMany({ relatedBooking: booking._id });
  await Booking.deleteMany({ reference: REFERENCE });
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('\n⏰ Appointment reminders\n');

  await cleanup();

  const [patient, service, staff] = await Promise.all([
    User.findOne({ role: 'patient', status: 'active' }).lean(),
    Service.findOne({ status: 'published' }).lean(),
    StaffProfile.findOne({ isActive: true }).lean(),
  ]);

  if (!patient || !service || !staff) {
    throw new Error('Seed the database first: npm run seed -- --fresh');
  }

  /* Three hours out — comfortably inside the default 24-hour window. */
  const startAt = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60 * 1000);
  const startMinutes = startAt.getHours() * 60 + startAt.getMinutes();

  await Booking.create({
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
    endAt,
    locationType: 'clinic',
    contact: { name: patient.name, phone: patient.phone ?? '+2348030000000', email: patient.email },
    status: 'confirmed',
    servicePriceKobo: service.priceKobo,
    surchargeKobo: 0,
    discountKobo: 0,
    totalKobo: service.priceKobo,
    isPaid: true,
    paidAt: new Date(),
    reminderSentAt: null,
  });

  console.log(`  created a confirmed booking for ${startAt.toLocaleString('en-NG')}\n`);

  /* ── First run: should send ────────────────────────────────────── */

  const first = await sendDueReminders();
  expect('first run sends the reminder', first.sent >= 1, true);

  const booking = await Booking.findOne({ reference: REFERENCE }).lean();
  expect('reminderSentAt is stamped', Boolean(booking?.reminderSentAt), true);

  const notifications = await Notification.countDocuments({
    relatedBooking: booking!._id,
    template: 'appointment_reminder',
  });
  expect('a reminder notification was recorded', notifications > 0, true);

  /* ── Second run: must not send again ───────────────────────────── */

  const second = await sendDueReminders();
  const sentAgain = second.sent;
  expect('a second run sends nothing for it', sentAgain, 0);

  const afterSecond = await Notification.countDocuments({
    relatedBooking: booking!._id,
    template: 'appointment_reminder',
  });
  expect('notification count is unchanged', afterSecond, notifications);

  /* ── Outside the window: must be ignored ───────────────────────── */

  const farOut = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000);
  await Booking.updateOne(
    { reference: REFERENCE },
    { $set: { reminderSentAt: null, startAt: farOut, dateKey: toDateKey(farOut) } },
  );

  const third = await sendDueReminders();
  const stillUnsent = await Booking.findOne({ reference: REFERENCE }).lean();
  expect('an appointment 20 days out is not reminded', third.sent, 0);
  expect('…and keeps reminderSentAt null', stillUnsent?.reminderSentAt ?? null, null);

  /* ── The scheduler gap ─────────────────────────────────────────────
     A 24-hour lead time and a once-daily cron cannot both be satisfied
     exactly: an appointment 30 hours out is too far away for a run that
     only looks 24 hours ahead, and by the next daily run it is 6 hours
     away — past the lead time. Widening the window by one interval is
     what stops it falling through. */

  const thirtyHours = new Date(Date.now() + 30 * 60 * 60 * 1000);
  const resetToGap = () =>
    Booking.updateOne(
      { reference: REFERENCE },
      { $set: { reminderSentAt: null, startAt: thirtyHours, dateKey: toDateKey(thirtyHours) } },
    );

  await resetToGap();
  process.env.CRON_INTERVAL_HOURS = '1';
  const hourly = await sendDueReminders();
  expect('on a 15-minute schedule, 30 hours out is not yet due', hourly.sent, 0);

  await resetToGap();
  process.env.CRON_INTERVAL_HOURS = '24';
  const daily = await sendDueReminders();
  expect('on a daily schedule, the same booking is reminded', daily.sent >= 1, true);

  await resetToGap();
  process.env.CRON_INTERVAL_HOURS = 'nonsense';
  const defaulted = await sendDueReminders();
  expect('an unparseable interval falls back to daily', defaulted.sent >= 1, true);

  delete process.env.CRON_INTERVAL_HOURS;

  await cleanup();
  await mongoose.disconnect();

  console.log(
    failures === 0
      ? '\n\x1b[32m✓ Reminders send once and only once\x1b[0m\n'
      : `\n\x1b[31m✗ ${failures} check(s) failed\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await cleanup();
    await mongoose.disconnect();
  } catch {
    /* already disconnected */
  }
  process.exit(1);
});
