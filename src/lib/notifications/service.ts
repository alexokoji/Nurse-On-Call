import 'server-only';
import { randomUUID } from 'crypto';
import { connectDB } from '@/lib/db/connect';
import { Notification, User } from '@/models';
import { getSettings } from '@/lib/settings';
import { renderTemplate, type TemplateData } from './templates';
import { emailTransport, smsTransport } from './transports';
import type { NotificationChannel, NotificationTemplate } from '@/types';

/**
 * Every notification is persisted before it is dispatched, so the admin
 * history reflects attempts as well as successes, and a transport outage
 * never loses the record of what should have been sent.
 *
 * Dispatch failures are recorded, not thrown: a booking must not be rolled
 * back because an SMS gateway was briefly unreachable.
 */

export interface NotifyParams {
  recipientId?: string | null;
  recipientEmail?: string;
  recipientPhone?: string;
  recipientName?: string;
  template: NotificationTemplate;
  channels: NotificationChannel[];
  data?: TemplateData;
  /** In-app deep link. Also becomes the email's button unless `action` overrides it. */
  link?: string;
  /** Explicit call to action for email, e.g. a password reset link. */
  action?: { label: string; url: string };
  relatedBooking?: string;
  sentBy?: string;
  batchId?: string;
}

/** Turns an in-app path into the absolute URL an email button needs. */
function absoluteUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
  return path.startsWith('http') ? path : `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function notify(params: NotifyParams): Promise<void> {
  try {
    await connectDB();

    const settings = await getSettings('notifications');
    const general = await getSettings('general');

    let email = params.recipientEmail;
    let phone = params.recipientPhone;
    let name = params.recipientName;

    if (params.recipientId && (!email || !phone || !name)) {
      const user = await User.findById(params.recipientId).select('name email phone').lean();
      if (user) {
        email ??= user.email;
        phone ??= user.phone ?? undefined;
        name ??= user.name;
      }
    }

    const message = renderTemplate(params.template, {
      patientName: name,
      organisationName: general.organisationName,
      ...params.data,
    });

    /* Respect the operator's channel switches. */
    const channels = params.channels.filter((channel) => {
      if (channel === 'email') return settings.emailEnabled && Boolean(email);
      if (channel === 'sms') return settings.smsEnabled && Boolean(phone);
      return true;
    });

    for (const channel of channels) {
      const record = await Notification.create({
        recipient: params.recipientId ?? null,
        recipientEmail: email,
        recipientPhone: phone,
        channel,
        template: params.template,
        subject: message.subject,
        body: message.body,
        status: 'queued',
        link: params.link,
        relatedBooking: params.relatedBooking ?? null,
        batchId: params.batchId ?? null,
        sentBy: params.sentBy ?? null,
      });

      // In-app notifications need no transport — persisting *is* delivery.
      if (channel === 'in_app') {
        record.status = 'sent';
        record.sentAt = new Date();
        await record.save();
        continue;
      }

      const transport = channel === 'email' ? emailTransport() : smsTransport();
      const destination = channel === 'email' ? email! : phone!;

      /* An explicit action wins; otherwise a deep link becomes the button. */
      const action =
        params.action ??
        (params.link
          ? { label: 'View in your dashboard', url: absoluteUrl(params.link) }
          : undefined);

      const result = await transport.send({
        to: destination,
        subject: message.subject,
        // SMS has no subject line, so prepend nothing and keep it terse.
        body: channel === 'sms' ? message.body.replace(/\n{2,}/g, '\n') : message.body,
        action,
      });

      record.status = result.ok ? 'sent' : 'failed';
      record.sentAt = result.ok ? new Date() : null;
      record.failureReason = result.error;
      await record.save();
    }
  } catch (error) {
    console.error('[notifications] dispatch failed', {
      template: params.template,
      recipient: params.recipientId,
      error,
    });
  }
}

export interface BulkNotifyParams {
  recipientIds: string[];
  channel: NotificationChannel;
  subject: string;
  body: string;
  sentBy?: string;
}

/** Sends one message to many recipients, grouped under a shared batch id. */
export async function notifyBulk(params: BulkNotifyParams): Promise<{ batchId: string; sent: number }> {
  const batchId = randomUUID();

  for (const recipientId of params.recipientIds) {
    await notify({
      recipientId,
      template: 'custom',
      channels: [params.channel],
      data: { subject: params.subject, body: params.body },
      sentBy: params.sentBy,
      batchId,
    });
  }

  return { batchId, sent: params.recipientIds.length };
}

export async function markNotificationRead(notificationId: string, userId: string) {
  await connectDB();
  await Notification.updateOne(
    { _id: notificationId, recipient: userId },
    { $set: { readAt: new Date(), status: 'read' } },
  );
}

export async function markAllNotificationsRead(userId: string) {
  await connectDB();
  await Notification.updateMany(
    { recipient: userId, readAt: null },
    { $set: { readAt: new Date(), status: 'read' } },
  );
}

export async function unreadCount(userId: string): Promise<number> {
  await connectDB();
  return Notification.countDocuments({ recipient: userId, channel: 'in_app', readAt: null });
}
