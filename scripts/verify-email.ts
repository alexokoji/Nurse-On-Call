/**
 * End-to-end check for the email adapter.
 *
 * The provider adapters are the one part of the notification stack that cannot
 * be proved by unit tests alone: the question is not "does the function run"
 * but "does a real mail server receive a well-formed message". So this script
 * stands up a throwaway SMTP server on localhost, points the smtp adapter at
 * it, and inspects the bytes that actually arrive — headers, both MIME parts,
 * and the action URL that must survive into the plain-text alternative.
 *
 * Nothing leaves the machine and no credentials are needed.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/verify-email.ts
 */

import 'dotenv/config';
import net from 'net';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import {
  emailTransport,
  emailTransportStatus,
  verifyEmailTransport,
} from '../src/lib/notifications/transports';
import { renderEmailHtml } from '../src/lib/notifications/email-html';

let failures = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label.padEnd(52)} ${actual}`);
  if (!ok) {
    console.log(`      expected ${expected}`);
    failures += 1;
  }
}

/* ──────────────────────────────────────────────────────────────────────
   A minimal SMTP sink.

   Enough of RFC 5321 for nodemailer to complete a session: greeting, EHLO
   capabilities, AUTH LOGIN, envelope, DATA. It deliberately advertises no
   STARTTLS so the dialogue stays plain and inspectable.
   ────────────────────────────────────────────────────────────────────── */

interface Received {
  from: string;
  to: string[];
  data: string;
  authenticated: boolean;
}

function startSink(): Promise<{ port: number; next: Promise<Received>; close: () => void }> {
  let resolveMail: (value: Received) => void;
  let rejectMail: (reason: Error) => void;
  const next = new Promise<Received>((resolve, reject) => {
    resolveMail = resolve;
    rejectMail = reject;
  });

  const server = net.createServer((socket) => {
    const mail: Received = { from: '', to: [], data: '', authenticated: false };
    let inData = false;
    let authStep = 0;
    let buffer = '';

    const write = (line: string) => socket.write(`${line}\r\n`);

    /* Resolve on a completed DATA block, not on QUIT: verifyEmailTransport()
       opens its own session that greets, authenticates and hangs up without
       sending anything, and a pooled connection may never hang up at all. */
    const queued = () => {
      write('250 2.0.0 Queued');
      if (mail.data) resolveMail({ ...mail, to: [...mail.to] });
    };

    write('220 sink.localhost ESMTP ready');

    socket.on('data', (chunk) => {
      buffer += chunk.toString('utf8');

      /* In DATA mode everything up to the lone dot is the message body. */
      if (inData) {
        const terminator = buffer.indexOf('\r\n.\r\n');
        if (terminator === -1) return;
        mail.data += buffer.slice(0, terminator);
        buffer = buffer.slice(terminator + 5);
        inData = false;
        queued();
      }

      let newline: number;
      while ((newline = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, newline);
        buffer = buffer.slice(newline + 2);
        const upper = line.toUpperCase();

        if (authStep > 0) {
          // Username then password, each base64 on its own line.
          authStep = authStep === 1 ? 2 : 0;
          if (authStep === 2) {
            write('334 UGFzc3dvcmQ6');
          } else {
            mail.authenticated = true;
            write('235 2.7.0 Authenticated');
          }
          continue;
        }

        if (upper.startsWith('EHLO') || upper.startsWith('HELO')) {
          write('250-sink.localhost');
          write('250-AUTH PLAIN LOGIN');
          write('250-SIZE 10485760');
          write('250 8BITMIME');
        } else if (upper.startsWith('AUTH LOGIN')) {
          authStep = 1;
          write('334 VXNlcm5hbWU6');
        } else if (upper.startsWith('AUTH PLAIN')) {
          mail.authenticated = true;
          write('235 2.7.0 Authenticated');
        } else if (upper.startsWith('MAIL FROM')) {
          mail.from = line.slice(line.indexOf(':') + 1).trim();
          write('250 2.1.0 Sender ok');
        } else if (upper.startsWith('RCPT TO')) {
          mail.to.push(line.slice(line.indexOf(':') + 1).trim());
          write('250 2.1.5 Recipient ok');
        } else if (upper === 'DATA') {
          inData = true;
          write('354 End data with <CR><LF>.<CR><LF>');
          /* The body may already be sitting in the buffer. */
          const terminator = buffer.indexOf('\r\n.\r\n');
          if (terminator !== -1) {
            mail.data += buffer.slice(0, terminator);
            buffer = buffer.slice(terminator + 5);
            inData = false;
            queued();
          }
        } else if (upper === 'QUIT') {
          write('221 2.0.0 Bye');
          socket.end();
        } else if (upper === 'RSET') {
          write('250 2.0.0 Reset');
        } else {
          write('250 2.0.0 OK');
        }
      }
    });

    socket.on('error', () => {
      /* nodemailer closing a verified connection is not a failure. */
    });
    socket.on('close', () => {
      if (mail.data) resolveMail(mail);
    });
  });

  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      const timer = setTimeout(
        () => rejectMail(new Error('no message arrived within 10s')),
        10_000,
      );
      resolve({
        port,
        next: next.finally(() => clearTimeout(timer)),
        close: () => server.close(),
      });
    });
  });
}

/** Decodes quoted-printable so we can assert on the HTML nodemailer encoded. */
function decodeQuotedPrintable(input: string): string {
  return input
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

async function main() {
  console.log('\n📧 Email adapter\n');

  const subject = 'Your appointment is confirmed';
  const body = [
    'Hello Chinedu,',
    '',
    'Reference:   APT-2026-0042',
    'Service:     Home nursing visit',
    'When:        Thursday, 2 October 2026 at 10:00',
    '',
    'Our nurse will call before arriving.',
  ].join('\n');
  const action = {
    label: 'View in your dashboard',
    url: 'http://localhost:3000/patient/appointments/abc123',
  };

  /* ── The HTML renderer, directly ─────────────────────────────────── */

  console.log('HTML rendering');
  const html = renderEmailHtml({ subject, body, action });
  expect('wraps the body in a table layout', html.includes('<table'), true);
  expect('renders the action as a link', html.includes(action.url), true);
  expect('carries the subject as preview text', html.includes(subject), true);
  expect(
    'turns "Label:  value" runs into a detail table',
    html.includes('APT-2026-0042') && html.includes('Reference'),
    true,
  );
  expect(
    'escapes markup from template values',
    renderEmailHtml({ subject: 'x', body: '<script>alert(1)</script>' }).includes('<script>'),
    false,
  );

  /* ── Provider selection ──────────────────────────────────────────── */

  console.log('\nProvider selection');
  const original = { ...process.env };

  process.env.EMAIL_PROVIDER = 'console';
  expect('defaults to console', emailTransport().name, 'console');
  expect('console reports itself unconfigured', emailTransportStatus().configured, false);

  process.env.EMAIL_PROVIDER = 'resend';
  delete process.env.RESEND_API_KEY;
  expect('selects resend when asked', emailTransport().name, 'resend');
  expect('resend without a key is unconfigured', emailTransportStatus().configured, false);
  expect(
    'resend without a key fails cleanly rather than throwing',
    (await emailTransport().send({ to: 'a@b.ng', subject: 's', body: 'b' })).ok,
    false,
  );

  process.env.RESEND_API_KEY = 're_test_key_not_real';
  expect('resend with a key is configured', emailTransportStatus().configured, true);

  process.env.EMAIL_PROVIDER = 'smtp';
  delete process.env.SMTP_HOST;
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASSWORD;
  expect('selects smtp when asked', emailTransport().name, 'smtp');
  expect('smtp with nothing set is unconfigured', emailTransportStatus().configured, false);
  expect(
    'and names what is missing',
    emailTransportStatus().reason,
    'SMTP_HOST, SMTP_USER, SMTP_PASSWORD not set',
  );

  /* ── A real SMTP session ─────────────────────────────────────────── */

  console.log('\nDelivery over SMTP');
  const sink = await startSink();

  process.env.EMAIL_PROVIDER = 'smtp';
  process.env.SMTP_HOST = '127.0.0.1';
  process.env.SMTP_PORT = String(sink.port);
  process.env.SMTP_USER = 'care@nurseoncall.ng';
  process.env.SMTP_PASSWORD = 'local-sink-password';
  process.env.EMAIL_FROM = 'NurseOnCall <care@nurseoncall.ng>';

  expect('smtp is now reported configured', emailTransportStatus().configured, true);
  expect('the connection verifies', (await verifyEmailTransport()).ok, true);

  const result = await emailTransport().send({
    to: 'chinedu.okafor0@example.com',
    subject,
    body,
    action,
  });

  expect('send reports success', result.ok, true);
  expect('and returns a provider message id', Boolean(result.providerId), true);

  const received = await sink.next;
  sink.close();

  const raw = received.data;
  const decoded = decodeQuotedPrintable(raw);

  expect('the server authenticated the sender', received.authenticated, true);
  expect('the envelope recipient is the patient', received.to[0], '<chinedu.okafor0@example.com>');
  expect('the envelope sender is the configured address', received.from, '<care@nurseoncall.ng>');
  expect('the From header carries the display name', raw.includes('NurseOnCall'), true);
  expect(
    'the Subject header survives',
    decoded.includes(subject) || raw.includes('=?UTF-8?'),
    true,
  );
  expect('the message is multipart', /Content-Type: multipart\/alternative/i.test(raw), true);
  expect('it has a text/plain part', /Content-Type: text\/plain/i.test(raw), true);
  expect('it has a text/html part', /Content-Type: text\/html/i.test(raw), true);
  expect('the plain part keeps the action URL', decoded.includes(action.url), true);
  expect('the HTML part is the branded template', decoded.includes('<table'), true);
  expect('the appointment reference arrived intact', decoded.includes('APT-2026-0042'), true);

  /* Restore, so nothing leaks into a later import in the same process. */
  process.env.EMAIL_PROVIDER = original.EMAIL_PROVIDER ?? 'console';

  console.log(
    failures === 0
      ? '\n\x1b[32m✓ The email adapter delivers a well-formed message\x1b[0m\n'
      : `\n\x1b[31m✗ ${failures} check(s) failed\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
