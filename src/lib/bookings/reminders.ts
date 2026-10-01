import 'server-only';
import { connectDB } from '@/lib/db/connect';
import { Booking } from '@/models';
import { getSettings } from '@/lib/settings';
import { notify } from '@/lib/notifications/service';

/**
 * Appointment reminders.
 *
 * Driven by a scheduled call to /api/cron rather than a timer in the web
 * process: a serverless deployment has no long-lived process to hold one, and
 * a timer per instance would send duplicates on a multi-instance host.
 *
 * Idempotency comes from `reminderSentAt` on the booking. The field is
 * claimed with a conditional update *before* the message is sent, so two
 * overlapping cron runs cannot both send the same reminder.
 */

export interface ReminderRun {
  considered: number;
  sent: number;
  skipped: number;
  failed: number;
}

/**
 * How often /api/cron is actually called, in hours. Clamped: a nonsense value
 * must not silently widen the window to the point where every future booking
 * is "due", nor narrow it to zero and strand reminders.
 */
function cronIntervalHours(): number {
  const parsed = Number(process.env.CRON_INTERVAL_HOURS);
  if (!Number.isFinite(parsed) || parsed <= 0) return 24;
  return Math.min(parsed, 24);
}

export async function sendDueReminders(): Promise<ReminderRun> {
  await connectDB();

  const settings = await getSettings('notifications');
  const now = new Date();

  /**
   * The window: appointments starting between now and the configured lead
   * time. Anything already past is excluded — a reminder for an appointment
   * that has started is noise, not a service.
   *
   * The lead time is widened by one scheduler interval, because a reminder can
   * only go out on a run. With a daily cron and a 24-hour lead time, a 07:00
   * appointment falls between two 06:00 runs: the first is an hour too early
   * to match it, the second is an hour too late to be a reminder. Adding the
   * interval closes that gap — a reminder may arrive earlier than the lead
   * time, but never after the appointment it is reminding about.
   *
   * Set CRON_INTERVAL_HOURS to match your schedule. It defaults to 24, which
   * is the most forgiving value and what Vercel's Hobby plan allows.
   */
  const intervalHours = cronIntervalHours();
  const leadHours = settings.reminderHoursBefore + intervalHours;
  const windowEnd = new Date(now.getTime() + leadHours * 60 * 60 * 1000);

  const due = await Booking.find({
    status: 'confirmed',
    reminderSentAt: null,
    startAt: { $gt: now, $lte: windowEnd },
  })
    .populate({ path: 'staff', select: 'user', populate: { path: 'user', select: 'name' } })
    .limit(200)
    .lean();

  const run: ReminderRun = { considered: due.length, sent: 0, skipped: 0, failed: 0 };

  for (const booking of due) {
    /* Claim this reminder atomically. If another run got here first the
       filter matches nothing and we move on without sending. */
    const claim = await Booking.updateOne(
      { _id: booking._id, reminderSentAt: null },
      { $set: { reminderSentAt: new Date() } },
    );

    if ((claim.modifiedCount ?? 0) === 0) {
      run.skipped += 1;
      continue;
    }

    const staffName =
      (booking.staff as unknown as { user?: { name?: string } } | null)?.user?.name ?? undefined;

    try {
      await notify({
        recipientId: String(booking.patient),
        template: 'appointment_reminder',
        channels: ['email', 'sms', 'in_app'],
        data: {
          reference: booking.reference,
          serviceName: booking.snapshot.serviceName,
          dateKey: booking.dateKey,
          startTime: booking.startTime,
          staffName,
        },
        link: `/patient/appointments/${booking._id}`,
        relatedBooking: String(booking._id),
      });

      run.sent += 1;
    } catch (error) {
      // Release the claim so the next run retries this one.
      await Booking.updateOne({ _id: booking._id }, { $set: { reminderSentAt: null } });
      run.failed += 1;
      console.error('[reminders] failed to send', { booking: booking.reference, error });
    }
  }

  return run;
}
