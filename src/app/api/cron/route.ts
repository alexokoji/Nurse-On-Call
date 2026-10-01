import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { expireStaleHolds } from '@/lib/bookings/service';
import { sendDueReminders } from '@/lib/bookings/reminders';
import { pruneRateLimitStore } from '@/lib/auth/rate-limit';

export const dynamic = 'force-dynamic';
// Reminders fan out to email and SMS, so allow more than the default budget.
export const maxDuration = 60;

/**
 * Scheduled maintenance. Runs the work that has no user to trigger it:
 *
 *   1. Release slots held by abandoned checkouts, so they become bookable
 *      again even on a quiet day when nobody is browsing availability.
 *   2. Send appointment reminders that have come due.
 *   3. Drop expired rate-limit buckets so the in-memory map cannot grow
 *      without bound on a long-lived process.
 *
 * Authentication is a shared secret rather than a session: there is no user
 * here. Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; other
 * schedulers can use the `x-cron-secret` header instead.
 *
 * Point a scheduler at this every 15 minutes or so — see vercel.json.
 */
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    // Failing closed matters: without this the endpoint would be an open
    // trigger for anyone who finds the URL.
    console.error('[cron] CRON_SECRET is not set — refusing to run');
    return NextResponse.json(
      { error: 'Scheduled tasks are not configured.' },
      { status: 503 },
    );
  }

  if (!isAuthorised(request, secret)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const startedAt = Date.now();

  /* Each task is isolated: a failing reminder run must not stop slots being
     released, and neither should fail the whole scheduled call. */
  const [expired, reminders] = await Promise.all([
    expireStaleHolds().catch((error) => {
      console.error('[cron] expireStaleHolds failed', error);
      return null;
    }),
    sendDueReminders().catch((error) => {
      console.error('[cron] sendDueReminders failed', error);
      return null;
    }),
  ]);

  pruneRateLimitStore();

  const result = {
    ok: true,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    expiredHolds: expired,
    reminders,
  };

  console.info('[cron] completed', result);

  return NextResponse.json(result);
}

/** Vercel Cron sends a bearer token; other schedulers may send a header. */
function isAuthorised(request: NextRequest, secret: string): boolean {
  const bearer = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  const header = request.headers.get('x-cron-secret');

  return safeEquals(bearer, secret) || safeEquals(header, secret);
}

/** Constant-time comparison, so the secret cannot be guessed by timing. */
function safeEquals(candidate: string | null | undefined, secret: string): boolean {
  if (!candidate) return false;
  const a = Buffer.from(candidate);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
