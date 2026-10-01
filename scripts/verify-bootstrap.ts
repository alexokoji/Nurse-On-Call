/**
 * Checks that `npm run bootstrap` produces an account the login action accepts.
 *
 * Bootstrapping a live deployment is the one path where a mistake is expensive
 * and hard to undo by hand, so it is worth asserting rather than assuming. This
 * replays every condition `loginAction` applies, in the same order and against
 * the same helpers, on whichever database MONGODB_URI points at.
 *
 *   MONGODB_URI=... ADMIN_PASSWORD=... npx tsx --tsconfig scripts/tsconfig.json \
 *     scripts/verify-bootstrap.ts founder@clinic.ng
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: false });

import { Role, Setting, User } from '../src/models';
import { verifyPassword } from '../src/lib/auth/password';
import { DEFAULT_ROLE_PERMISSIONS } from '../src/lib/permissions/catalogue';
import { DEFAULT_SETTINGS } from '../src/lib/settings/defaults';
import { ADMIN_ROLES } from '../src/types';

let failures = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label.padEnd(52)} ${actual}`);
  if (!ok) {
    console.log(`      expected ${expected}`);
    failures += 1;
  }
}

async function main() {
  const email = (process.argv[2] ?? '').trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? '';

  if (!email || !password) {
    throw new Error('Usage: ADMIN_PASSWORD=... verify-bootstrap.ts <email>');
  }

  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(`\n🏁 Bootstrapped sign-in — database "${mongoose.connection.name}"\n`);

  console.log('Supporting data');
  expect(
    'every role exists',
    await Role.countDocuments(),
    Object.keys(DEFAULT_ROLE_PERMISSIONS).length,
  );
  expect(
    'every settings group exists',
    await Setting.countDocuments(),
    Object.keys(DEFAULT_SETTINGS).length,
  );
  expect('no demo users were created', await User.countDocuments({ role: 'patient' }), 0);

  /* ── Exactly what loginAction checks, in its order ──────────────── */

  console.log('\nThe conditions loginAction applies');

  const user = await User.findOne({ email }).select('+password');
  expect('the account is found by email', Boolean(user), true);
  if (!user) throw new Error('nothing further can be checked');

  expect('it is not locked', !(user.lockedUntil && user.lockedUntil > new Date()), true);
  expect('the password verifies', await verifyPassword(password, user.password), true);
  expect('a wrong password does not', await verifyPassword(`${password}x`, user.password), false);
  expect('the status is active', user.status, 'active');
  expect('it is a super admin', user.role, 'super_admin');
  expect('email verification cannot block it', Boolean(user.emailVerifiedAt), true);
  expect('no failed attempts are recorded', user.failedLoginAttempts, 0);
  expect(
    'and it routes to /admin',
    ADMIN_ROLES.includes(user.role) ? '/admin' : '/patient/dashboard',
    '/admin',
  );

  await mongoose.disconnect();

  console.log(
    failures === 0
      ? '\n\x1b[32m✓ A bootstrapped admin can sign in\x1b[0m\n'
      : `\n\x1b[31m✗ ${failures} check(s) failed\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    /* already disconnected */
  }
  process.exit(1);
});
