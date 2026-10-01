import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/db/connect';
import { emailTransportStatus } from '@/lib/notifications/transports';
import { isStorageConfigured } from '@/lib/storage/cloudinary';

export const dynamic = 'force-dynamic';

/**
 * Health check for uptime monitors and load balancers.
 *
 * Deliberately shallow: it reports *whether* each dependency is reachable and
 * configured, never versions, hostnames, credentials or error details. A
 * monitor only needs the status code, and anything richer would hand a
 * stranger a map of the infrastructure.
 *
 * 200 when the database is reachable, 503 when it is not — email and storage
 * being unconfigured degrades features but does not make the site unhealthy.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  /* Database — the only hard dependency. */
  try {
    await connectDB();
    const admin = mongoose.connection.db?.admin();
    if (!admin) throw new Error('no connection');
    await admin.ping();
    checks.database = { ok: true };
  } catch {
    checks.database = { ok: false, detail: 'unreachable' };
  }

  /* Email — unconfigured means password resets never arrive, which an
     operator wants to see on a dashboard rather than discover from a
     complaint. */
  const email = emailTransportStatus();
  checks.email = email.configured
    ? { ok: true, detail: email.provider }
    : { ok: false, detail: `${email.provider}: not delivering` };

  checks.storage = isStorageConfigured()
    ? { ok: true, detail: 'cloudinary' }
    : { ok: false, detail: 'image upload disabled' };

  checks.scheduler = process.env.CRON_SECRET
    ? { ok: true }
    : { ok: false, detail: 'CRON_SECRET not set' };

  const healthy = checks.database.ok;

  return NextResponse.json(
    {
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    },
    {
      status: healthy ? 200 : 503,
      headers: { 'Cache-Control': 'no-store' },
    },
  );
}
