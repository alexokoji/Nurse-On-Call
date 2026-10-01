/**
 * End-to-end smoke test against a running dev server.
 *
 * Signs in as a real seeded user, then walks the authenticated pages and the
 * booking APIs, reporting the HTTP status of each. This exercises the actual
 * middleware, guards and queries rather than mocking them.
 *
 *   npx tsx scripts/smoke.ts [baseUrl]
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { User } from '../src/models';
import { signSession, SESSION_COOKIE } from '../src/lib/auth/session';
import { verifyPassword } from '../src/lib/auth/password';

const BASE = process.argv[2] ?? 'http://localhost:3000';

const ADMIN_EMAIL = 'admin@nurseoncall.ng';
const PATIENT_EMAIL = 'chinedu.okafor0@example.com';
const DEV_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

let failures = 0;

function report(label: string, ok: boolean, detail: string) {
  const mark = ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m';
  console.log(`  ${mark} ${label.padEnd(46)} ${detail}`);
  if (!ok) failures += 1;
}

/**
 * Issues a session cookie for a seeded account.
 *
 * This deliberately reuses the application's own `signSession` rather than
 * driving the login form: the point of the walk-through below is to exercise
 * the route guards, permission checks and queries on every authenticated
 * page. The credentials are still verified against the stored bcrypt hash
 * first, so a broken password path would fail here too.
 */
async function sessionFor(email: string): Promise<string | null> {
  const user = await User.findOne({ email }).select('+password name email role sessionVersion');
  if (!user) return null;

  const passwordValid = await verifyPassword(DEV_PASSWORD, user.password);
  if (!passwordValid) {
    report(`password check for ${email}`, false, 'stored hash did not verify');
    return null;
  }

  const token = await signSession({
    sub: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    v: user.sessionVersion ?? 1,
  });

  return `${SESSION_COOKIE}=${token}`;
}

async function check(label: string, path: string, cookie?: string, expect = 200) {
  try {
    const response = await fetch(`${BASE}${path}`, {
      headers: cookie ? { cookie } : {},
      redirect: 'manual',
    });
    const ok = response.status === expect;
    report(label, ok, `${response.status} ${path}`);
    return response;
  } catch (error) {
    report(label, false, `error: ${(error as Error).message}`);
    return null;
  }
}

async function main() {
  console.log(`\n🔍 Smoke test — ${BASE}\n`);

  await mongoose.connect(process.env.MONGODB_URI!);

  console.log('Public pages');
  for (const path of [
    '/',
    '/services',
    '/services/home-nursing',
    '/about',
    '/team',
    '/contact',
    '/faq',
    '/health-resources',
    '/book',
    '/login',
    '/register',
    '/sitemap.xml',
    '/robots.txt',
  ]) {
    await check(path, path);
  }

  console.log('\nAvailability API');
  const serviceRes = await fetch(`${BASE}/api/availability?serviceId=x&dateKey=bad&locationType=home`);
  report('rejects invalid query', serviceRes.status === 422, `${serviceRes.status} (expected 422)`);

  console.log('\nUnauthenticated access is refused');
  await check('/admin redirects to login', '/admin', undefined, 307);
  await check('/patient/dashboard redirects', '/patient/dashboard', undefined, 307);
  const unauth = await fetch(`${BASE}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  report('POST /api/bookings needs auth', unauth.status === 401, `${unauth.status} (expected 401)`);

  console.log('\nPatient session');
  const patientCookie = await sessionFor(PATIENT_EMAIL);
  report('patient session issued', Boolean(patientCookie), patientCookie ? 'ok' : 'FAILED');

  if (patientCookie) {
    for (const path of [
      '/patient/dashboard',
      '/patient/appointments',
      '/patient/payments',
      '/patient/receipts',
      '/patient/reviews',
      '/patient/notifications',
      '/patient/support',
      '/patient/profile',
    ]) {
      await check(path, path, patientCookie);
    }
    await check('patient blocked from /admin', '/admin', patientCookie, 307);
  }

  console.log('\nAdmin session');
  const adminCookie = await sessionFor(ADMIN_EMAIL);
  report('admin session issued', Boolean(adminCookie), adminCookie ? 'ok' : 'FAILED');

  if (adminCookie) {
    for (const path of [
      '/admin',
      '/admin/appointments',
      '/admin/patients',
      '/admin/services',
      '/admin/staff',
      '/admin/schedule',
      '/admin/payments',
      '/admin/refunds',
      '/admin/reviews',
      '/admin/messages',
      '/admin/notifications',
      '/admin/content',
      '/admin/reports',
      '/admin/settings',
      '/admin/users',
      '/admin/roles',
      '/admin/audit-logs',
    ]) {
      await check(path, path, adminCookie);
    }

    await check('CSV export', '/api/admin/export?resource=appointments', adminCookie);
    await check('admin blocked from /patient', '/patient/dashboard', adminCookie, 307);
  }

  await mongoose.disconnect();

  console.log(
    failures === 0
      ? '\n\x1b[32m✓ All smoke checks passed\x1b[0m\n'
      : `\n\x1b[31m✗ ${failures} check(s) failed\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
