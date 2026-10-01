import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';
import { renderEmailHtml } from './email-html';

/**
 * Notification transports.
 *
 * Every channel implements the same tiny interface, so adding a provider means
 * writing one adapter and registering it — no caller changes.
 *
 * Email providers available:
 *   console  development default; prints to the server log, sends nothing
 *   resend   HTTP API, no SMTP needed, good on serverless
 *   smtp     any mailbox you already own (Google Workspace, Zoho, cPanel…)
 *
 * SMS providers:
 *   console  development default
 *   termii   Nigerian SMS gateway
 */

export interface TransportMessage {
  to: string;
  subject: string;
  body: string;
  /** Rendered as a button in HTML email; appended as a URL in plain text. */
  action?: { label: string; url: string };
}

export interface TransportResult {
  ok: boolean;
  providerId?: string;
  error?: string;
}

export interface Transport {
  name: string;
  send(message: TransportMessage): Promise<TransportResult>;
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown transport error';
}

/** `NurseOnCall <care@…>` or a bare address, as configured. */
function fromAddress(): string {
  return process.env.EMAIL_FROM?.trim() || 'NurseOnCall <no-reply@nurseoncall.ng>';
}

/** Plain-text alternative, with the action URL appended so it is never lost. */
function plainTextFor(message: TransportMessage): string {
  if (!message.action) return message.body;
  return `${message.body}\n\n${message.action.label}: ${message.action.url}`;
}

/* ── Console (development default) ────────────────────────────────── */

const consoleTransport: Transport = {
  name: 'console',
  async send(message) {
    console.info(
      [
        '',
        '──── notification ────',
        `To:      ${message.to}`,
        `Subject: ${message.subject}`,
        '',
        plainTextFor(message),
        '──────────────────────',
        '',
      ].join('\n'),
    );
    return { ok: true, providerId: `console_${Date.now()}` };
  },
};

/* ── Resend ───────────────────────────────────────────────────────── */

/**
 * Resend's REST API over plain fetch — no SDK, so nothing extra to keep
 * patched, and it works anywhere fetch does.
 */
const resendTransport: Transport = {
  name: 'resend',
  async send(message) {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return { ok: false, error: 'RESEND_API_KEY is not set' };

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress(),
          to: [message.to],
          subject: message.subject,
          text: plainTextFor(message),
          html: renderEmailHtml({
            subject: message.subject,
            body: message.body,
            action: message.action,
          }),
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        id?: string;
        message?: string;
        name?: string;
      };

      if (!response.ok) {
        return {
          ok: false,
          error: payload.message ?? `Resend responded ${response.status}`,
        };
      }

      return { ok: true, providerId: payload.id };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  },
};

/* ── SMTP ─────────────────────────────────────────────────────────── */

/**
 * Nodemailer re-uses one pooled connection across requests. In development
 * Next hot-reloads modules, so the transporter is cached on the global object
 * to avoid opening a new pool on every reload until the server refuses them.
 */
declare global {
  var _smtpTransporter: Transporter | undefined;
}

function smtpTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASSWORD;

  if (!host || !user || !pass) return null;

  if (global._smtpTransporter) return global._smtpTransporter;

  const port = Number(process.env.SMTP_PORT ?? 587);

  const transporter = nodemailer.createTransport({
    host,
    port,
    // 465 is implicit TLS; 587 and 25 start plain and upgrade with STARTTLS.
    secure: port === 465,
    auth: { user, pass },
    pool: true,
    maxConnections: 3,
  });

  global._smtpTransporter = transporter;
  return transporter;
}

const smtpTransport: Transport = {
  name: 'smtp',
  async send(message) {
    const transporter = smtpTransporter();
    if (!transporter) {
      return { ok: false, error: 'SMTP_HOST, SMTP_USER and SMTP_PASSWORD must all be set' };
    }

    try {
      const info = await transporter.sendMail({
        from: fromAddress(),
        to: message.to,
        subject: message.subject,
        text: plainTextFor(message),
        html: renderEmailHtml({
          subject: message.subject,
          body: message.body,
          action: message.action,
        }),
      });

      return { ok: true, providerId: info.messageId };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  },
};

/* ── SMS (Termii) ─────────────────────────────────────────────────── */

const termiiTransport: Transport = {
  name: 'termii',
  async send(message) {
    const apiKey = process.env.TERMII_API_KEY;
    if (!apiKey) return { ok: false, error: 'TERMII_API_KEY is not set' };

    try {
      const response = await fetch('https://api.ng.termii.com/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: message.to,
          from: process.env.SMS_SENDER_ID ?? 'NurseOnCall',
          sms: plainTextFor(message),
          type: 'plain',
          channel: 'generic',
          api_key: apiKey,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        message_id?: string;
        message?: string;
      };

      if (!response.ok) {
        return { ok: false, error: payload.message ?? `Termii responded ${response.status}` };
      }

      return { ok: true, providerId: payload.message_id };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  },
};

/* ── Registry ─────────────────────────────────────────────────────── */

export function emailTransport(): Transport {
  switch (process.env.EMAIL_PROVIDER) {
    case 'resend':
      return resendTransport;
    case 'smtp':
      return smtpTransport;
    case 'console':
    default:
      return consoleTransport;
  }
}

export function smsTransport(): Transport {
  switch (process.env.SMS_PROVIDER) {
    case 'termii':
      return termiiTransport;
    case 'console':
    default:
      return consoleTransport;
  }
}

/**
 * Reports whether the configured email provider actually has credentials.
 * Used by the admin settings screen and the health check, so an operator can
 * see that email is misconfigured before a patient discovers it.
 */
export function emailTransportStatus(): {
  provider: string;
  configured: boolean;
  reason?: string;
} {
  const provider = process.env.EMAIL_PROVIDER ?? 'console';

  switch (provider) {
    case 'resend':
      return process.env.RESEND_API_KEY
        ? { provider, configured: true }
        : { provider, configured: false, reason: 'RESEND_API_KEY is not set' };

    case 'smtp': {
      const missing = (['SMTP_HOST', 'SMTP_USER', 'SMTP_PASSWORD'] as const).filter(
        (key) => !process.env[key],
      );
      return missing.length === 0
        ? { provider, configured: true }
        : { provider, configured: false, reason: `${missing.join(', ')} not set` };
    }

    default:
      return {
        provider: 'console',
        configured: false,
        reason: 'Email is printed to the server log and never delivered',
      };
  }
}

/** Verifies the SMTP connection, so Settings can test it without sending. */
export async function verifyEmailTransport(): Promise<{ ok: boolean; error?: string }> {
  const status = emailTransportStatus();
  if (!status.configured) return { ok: false, error: status.reason };

  if (status.provider === 'smtp') {
    const transporter = smtpTransporter();
    if (!transporter) return { ok: false, error: 'SMTP is not fully configured' };
    try {
      await transporter.verify();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  }

  // Resend has no cheap verify endpoint; the key's presence is all we check.
  return { ok: true };
}
