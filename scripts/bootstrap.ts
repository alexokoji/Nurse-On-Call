/**
 * Production bootstrap: the minimum a real deployment needs to be usable.
 *
 * `npm run seed` exists for development and writes a whole demo practice —
 * 34 invented patients, 140 bookings, fabricated revenue. None of that belongs
 * in a live database, so this is the separate, boring path: synchronise
 * indexes, write the role catalogue and default settings, and create exactly
 * one super admin.
 *
 * It is safe to re-run. Roles and settings are upserted, an existing admin is
 * never overwritten, and no demo row is ever written.
 *
 *   npm run bootstrap -- --email you@clinic.ng --name "Your Name"
 *
 * The password is read from ADMIN_PASSWORD, or generated and printed once if
 * that is unset. It is never passed on the command line, because argv is
 * visible to other processes and lands in shell history.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

/**
 * Note `override: false`, unlike the development scripts. This one gets pointed
 * at real databases, so a MONGODB_URI already in the environment must win over
 * whatever .env.local happens to contain — otherwise
 * `MONGODB_URI=<production> npm run bootstrap` silently writes to the local
 * development database instead, and reports success.
 */
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: false });

import { Booking, Payment, Role, Service, Setting, User } from '../src/models';
import { DEFAULT_ROLE_PERMISSIONS, ROLE_DESCRIPTIONS } from '../src/lib/permissions/catalogue';
import { DEFAULT_SETTINGS } from '../src/lib/settings/defaults';
import { passwordSchema } from '../src/lib/validations/auth';

/** Passwords that ship in this repository. Never acceptable on a live site. */
const KNOWN_DEV_PASSWORDS = ['Admin@12345', 'Password123', 'Patient@12345'];

function arg(name: string): string | undefined {
  const prefix = `--${name}`;
  const argv = process.argv.slice(2);
  const index = argv.findIndex((a) => a === prefix || a.startsWith(`${prefix}=`));
  if (index === -1) return undefined;
  const found = argv[index];
  if (found.includes('=')) return found.slice(found.indexOf('=') + 1);
  return argv[index + 1];
}

function log(message: string) {
  console.log(`  ${message}`);
}

/** 18 bytes of base64url, then shaped to satisfy the app's own rules. */
function generatePassword(): string {
  const body = crypto
    .randomBytes(18)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/g, '');
  return `Aa1${body}`.slice(0, 24);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');

  const email = (arg('email') ?? process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
  const name = (arg('name') ?? process.env.ADMIN_NAME ?? '').trim();

  if (!email || !email.includes('@')) {
    throw new Error('Pass an admin email: npm run bootstrap -- --email you@clinic.ng');
  }
  if (!name) {
    throw new Error('Pass an admin name: npm run bootstrap -- --name "Your Name"');
  }

  let password = process.env.ADMIN_PASSWORD ?? '';
  let generated = false;
  if (!password) {
    password = generatePassword();
    generated = true;
  }

  if (KNOWN_DEV_PASSWORDS.includes(password)) {
    throw new Error(
      'That password is a documented development default and is public in this repository. Choose another.',
    );
  }

  const strength = passwordSchema.safeParse(password);
  if (!strength.success) {
    throw new Error(`ADMIN_PASSWORD is too weak: ${strength.error.issues[0].message}`);
  }

  console.log('\n🏁 Bootstrapping NurseOnCall\n');
  await mongoose.connect(uri);

  /* Print the database name, not just a masked URI. Writing an admin into the
     wrong database is the mistake this script must never make quietly. */
  log(`connected to ${uri.replace(/\/\/.*@/, '//***@')}`);
  log(`database: ${mongoose.connection.name}`);

  /* ── A guard against pointing this at a live practice by accident ── */

  const [existingBookings, existingPayments] = await Promise.all([
    Booking.estimatedDocumentCount(),
    Payment.estimatedDocumentCount(),
  ]);
  if (existingBookings > 0 || existingPayments > 0) {
    log(
      `note: this database already holds ${existingBookings} booking(s) and ${existingPayments} payment(s) — nothing will be removed`,
    );
  }

  /* ── Indexes ──────────────────────────────────────────────────────
     Before anything is written. The unique partial index on
     (staff, startAt) is what actually prevents double booking, so a
     deployment that never synchronised it is quietly unsafe. */

  await Promise.all([
    Booking.syncIndexes(),
    User.syncIndexes(),
    Service.syncIndexes(),
    Payment.syncIndexes(),
  ]);
  log('indexes synchronised');

  /* ── Roles ───────────────────────────────────────────────────────── */

  for (const [key, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
    await Role.findOneAndUpdate(
      { key },
      {
        key,
        name: key
          .split('_')
          .map((part) => part[0].toUpperCase() + part.slice(1))
          .join(' '),
        description: ROLE_DESCRIPTIONS[key as keyof typeof ROLE_DESCRIPTIONS],
        permissions,
        isSystem: true,
      },
      { upsert: true },
    );
  }
  log(`roles written (${Object.keys(DEFAULT_ROLE_PERMISSIONS).length})`);

  /* ── Settings ─────────────────────────────────────────────────────
     Only groups that do not exist yet, so re-running never reverts a
     change an administrator made in the UI. */

  let written = 0;
  for (const [group, values] of Object.entries(DEFAULT_SETTINGS)) {
    const result = await Setting.updateOne(
      { group },
      { $setOnInsert: { group, values } },
      { upsert: true },
    );
    if (result.upsertedCount) written += 1;
  }
  log(
    `settings groups created (${written}; ${Object.keys(DEFAULT_SETTINGS).length - written} already present)`,
  );

  /* ── The super admin ─────────────────────────────────────────────── */

  const existing = await User.findOne({ email });

  if (existing) {
    log(`a user with ${email} already exists (role: ${existing.role}) — left untouched`);
    console.log(
      '\nTo reset that password, use "Forgot password?" on the sign-in page, or delete the user and re-run.\n',
    );
    await mongoose.disconnect();
    return;
  }

  await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 12),
    role: 'super_admin',
    status: 'active',
    emailVerifiedAt: new Date(),
  });

  log(`super admin created: ${email}`);

  const superAdmins = await User.countDocuments({ role: 'super_admin' });

  console.log('\n\x1b[32m✓ Ready\x1b[0m\n');
  if (generated) {
    console.log('  Sign in with this password, then change it immediately.');
    console.log('  It is shown once and is not stored anywhere else.\n');
    console.log(`      ${password}\n`);
  } else {
    console.log('  Sign in with the password from ADMIN_PASSWORD, then change it.\n');
  }
  if (superAdmins > 1) {
    console.log(
      `  Note: there are now ${superAdmins} super admins. Remove any you did not create.\n`,
    );
  }
  console.log('  Still to do before taking bookings:');
  console.log('    - add your services and staff in /admin');
  console.log('    - set a real EMAIL_PROVIDER, or password reset cannot work');
  console.log('    - set CRON_SECRET so reminders are sent');
  console.log('');

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`\n\x1b[31m✗ ${error instanceof Error ? error.message : error}\x1b[0m\n`);
  try {
    await mongoose.disconnect();
  } catch {
    /* already disconnected */
  }
  process.exit(1);
});
