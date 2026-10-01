/**
 * Security checks for the image upload route, against a running dev server.
 *
 * The upload endpoint accepts a file from a signed-in user, so it is the most
 * attackable surface added recently. These assert the guards hold: no session,
 * wrong role, wrong folder, oversized file, and — the one that matters most —
 * a non-image whose filename and Content-Type claim otherwise.
 *
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/verify-uploads.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { User } from '../src/models';
import { signSession, SESSION_COOKIE } from '../src/lib/auth/session';
import { sniffImageType } from '../src/lib/storage/cloudinary';

const BASE = process.argv[2] ?? 'http://localhost:3000';

let failures = 0;

function expect(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${label.padEnd(50)} ${actual}`);
  if (!ok) {
    console.log(`      expected ${expected}`);
    failures += 1;
  }
}

async function sessionFor(email: string): Promise<string | null> {
  const user = await User.findOne({ email }).select('name email role sessionVersion').lean();
  if (!user) return null;

  const token = await signSession({
    sub: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role,
    v: user.sessionVersion ?? 1,
  });
  return `${SESSION_COOKIE}=${token}`;
}

/** Smallest valid PNG: an 8-byte signature is all the sniffer reads. */
function pngBytes(sizeBytes = 1024): Uint8Array {
  const bytes = new Uint8Array(sizeBytes);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  return bytes;
}

async function post(
  cookie: string | null,
  folder: string,
  file: { bytes: Uint8Array; name: string; type: string },
): Promise<number> {
  const form = new FormData();
  form.set('folder', folder);
  form.set('file', new Blob([new Uint8Array(file.bytes)], { type: file.type }), file.name);

  const response = await fetch(`${BASE}/api/admin/upload`, {
    method: 'POST',
    headers: cookie ? { cookie } : {},
    body: form,
  });
  return response.status;
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log(`\n🔐 Image upload guards — ${BASE}\n`);

  /* ── The byte sniffer, directly ─────────────────────────────────── */

  console.log('File type detection');
  expect('recognises a PNG', sniffImageType(pngBytes()), 'image/png');
  expect(
    'recognises a JPEG',
    sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])),
    'image/jpeg',
  );
  expect(
    'rejects a script renamed .png',
    sniffImageType(new TextEncoder().encode('<?php system($_GET[0]); ?>  ')),
    null,
  );
  expect('rejects an empty buffer', sniffImageType(new Uint8Array(0)), null);

  /* ── The route ──────────────────────────────────────────────────── */

  console.log('\nRoute guards');

  const admin = await sessionFor('admin@nurseoncall.ng');
  const staff = await sessionFor('maryjane.okafor@nurseoncall.ng');
  const patient = await sessionFor('chinedu.okafor0@example.com');

  if (!admin || !staff || !patient) {
    throw new Error('Seed the database first: npm run seed -- --fresh');
  }

  const png = { bytes: pngBytes(), name: 'photo.png', type: 'image/png' };

  expect('no session is refused', await post(null, 'service', png), 401);
  expect('a patient is refused', await post(patient, 'service', png), 403);

  // A nurse may manage neither services nor site settings.
  expect('clinical staff cannot upload a service image', await post(staff, 'service', png), 403);
  expect('clinical staff cannot upload branding', await post(staff, 'branding', png), 403);

  expect('an unknown folder is refused', await post(admin, 'nonsense', png), 400);

  expect(
    'a renamed script is refused on its bytes',
    await post(admin, 'service', {
      bytes: new TextEncoder().encode('<?php system($_GET[0]); ?>  '),
      name: 'innocent.png',
      // The declared type is a lie; only the sniffer catches it.
      type: 'image/png',
    }),
    415,
  );

  expect(
    'an oversized file is refused',
    await post(admin, 'service', { bytes: pngBytes(6 * 1024 * 1024), name: 'big.png', type: 'image/png' }),
    413,
  );

  expect('an empty file is refused', await post(admin, 'service', { bytes: new Uint8Array(0), name: 'empty.png', type: 'image/png' }), 400);

  /* A real PNG from an authorised admin: 200 when Cloudinary is configured,
     503 when it is not. Both prove the guards let it through. */
  const valid = await post(admin, 'service', png);
  const storageConfigured = Boolean(process.env.CLOUDINARY_CLOUD_NAME);
  expect(
    storageConfigured
      ? 'a valid image from an admin is accepted'
      : 'a valid image reaches storage (unconfigured → 503)',
    valid,
    storageConfigured ? 200 : 503,
  );

  await mongoose.disconnect();

  console.log(
    failures === 0
      ? '\n\x1b[32m✓ Upload guards hold\x1b[0m\n'
      : `\n\x1b[31m✗ ${failures} check(s) failed\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  process.exit(1);
});
