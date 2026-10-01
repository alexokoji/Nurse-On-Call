import { formatNaira, formatTimeLabel } from '@/lib/utils';
import { format } from 'date-fns';
import { fromDateKey } from '@/lib/utils';
import type { NotificationTemplate } from '@/types';

/**
 * Message templates. Each returns a subject and a plain-text body; the email
 * transport wraps the body in HTML. Keeping them plain keeps SMS and in-app
 * rendering identical to email without a second set of templates to maintain.
 */

export interface TemplateData {
  patientName?: string;
  reference?: string;
  serviceName?: string;
  dateKey?: string;
  startTime?: string;
  totalKobo?: number;
  refundKobo?: number;
  amountKobo?: number;
  reason?: string;
  staffName?: string;
  organisationName?: string;
  subject?: string;
  body?: string;
  [key: string]: unknown;
}

export interface RenderedMessage {
  subject: string;
  body: string;
}

function when(data: TemplateData): string {
  if (!data.dateKey) return '';
  const date = format(fromDateKey(data.dateKey), 'EEEE, d MMMM yyyy');
  return data.startTime ? `${date} at ${formatTimeLabel(data.startTime)}` : date;
}

function greeting(data: TemplateData): string {
  const first = data.patientName?.split(' ')[0];
  return first ? `Hi ${first},` : 'Hello,';
}

export function renderTemplate(
  template: NotificationTemplate,
  data: TemplateData,
): RenderedMessage {
  const org = data.organisationName ?? 'NurseOnCall';

  switch (template) {
    case 'booking_confirmation':
      return {
        subject: `Your ${data.serviceName} appointment is confirmed — ${data.reference}`,
        body: [
          greeting(data),
          '',
          `Your appointment is confirmed.`,
          '',
          `Reference: ${data.reference}`,
          `Service:   ${data.serviceName}`,
          `When:      ${when(data)}`,
          data.totalKobo !== undefined ? `Total:     ${formatNaira(data.totalKobo)}` : '',
          '',
          'You can view or reschedule this appointment from your dashboard.',
          '',
          `— The ${org} team`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

    case 'appointment_reminder':
      return {
        subject: `Reminder: ${data.serviceName} — ${when(data)}`,
        body: [
          greeting(data),
          '',
          `This is a reminder of your upcoming appointment.`,
          '',
          `Reference: ${data.reference}`,
          `Service:   ${data.serviceName}`,
          `When:      ${when(data)}`,
          data.staffName ? `With:      ${data.staffName}` : '',
          '',
          'If you need to change this appointment, please do so as early as you can.',
          '',
          `— The ${org} team`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

    case 'payment_confirmation':
      return {
        subject: `Payment received — ${data.reference}`,
        body: [
          greeting(data),
          '',
          `We have received your payment of ${formatNaira(data.amountKobo ?? 0)}.`,
          '',
          `Reference: ${data.reference}`,
          `Service:   ${data.serviceName}`,
          `When:      ${when(data)}`,
          '',
          'Your receipt is available in your dashboard under Receipts.',
          '',
          `— The ${org} team`,
        ].join('\n'),
      };

    case 'cancellation':
      return {
        subject: `Appointment cancelled — ${data.reference}`,
        body: [
          greeting(data),
          '',
          `Your ${data.serviceName} appointment on ${when(data)} has been cancelled.`,
          data.reason ? `\nReason: ${data.reason}` : '',
          data.refundKobo
            ? `\nA refund of ${formatNaira(data.refundKobo)} will be processed to your original payment method.`
            : '',
          '',
          'You are welcome to book again whenever you are ready.',
          '',
          `— The ${org} team`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

    case 'reschedule':
      return {
        subject: `Appointment rescheduled — ${data.reference}`,
        body: [
          greeting(data),
          '',
          `Your ${data.serviceName} appointment has been moved to ${when(data)}.`,
          data.reason ? `\nReason: ${data.reason}` : '',
          '',
          `Reference: ${data.reference}`,
          '',
          `— The ${org} team`,
        ]
          .filter(Boolean)
          .join('\n'),
      };

    case 'refund':
      return {
        subject: `Refund processed — ${data.reference}`,
        body: [
          greeting(data),
          '',
          `A refund of ${formatNaira(data.amountKobo ?? 0)} has been processed for booking ${data.reference}.`,
          '',
          'Depending on your bank, it may take 3–10 working days to appear.',
          '',
          `— The ${org} team`,
        ].join('\n'),
      };

    case 'staff_assigned':
      return {
        subject: `A care professional has been assigned — ${data.reference}`,
        body: [
          greeting(data),
          '',
          data.staffName
            ? `${data.staffName} will be attending your ${data.serviceName} appointment.`
            : `A care professional has been assigned to your ${data.serviceName} appointment.`,
          '',
          `Reference: ${data.reference}`,
          '',
          `— The ${org} team`,
        ].join('\n'),
      };

    case 'custom':
    default:
      return {
        subject: data.subject ?? `A message from ${org}`,
        body: data.body ?? '',
      };
  }
}
