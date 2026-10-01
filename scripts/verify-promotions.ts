/**
 * Integration check for promotion usage limits against a real database.
 *
 * This exercises the atomic claim directly, including the concurrent case —
 * the thing that a unit test with a mocked model cannot prove. It creates a
 * throwaway promotion, hammers it, then removes it.
 *
 *   npx tsx scripts/verify-promotions.ts
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { Promotion } from '../src/models';

const CODE = '__TEST_LIMIT__';
const LIMIT = 5;
const ATTEMPTS = 25;

/** Mirrors claimPromotionUse() in lib/bookings/service.ts. */
async function claim(code: string): Promise<boolean> {
  const result = await Promotion.updateOne(
    {
      code,
      isActive: true,
      $or: [{ usageLimit: 0 }, { $expr: { $lt: ['$usageCount', '$usageLimit'] } }],
    },
    { $inc: { usageCount: 1 } },
  );
  return (result.modifiedCount ?? 0) > 0;
}

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
  await mongoose.connect(process.env.MONGODB_URI!);
  console.log('\n🎟  Promotion usage limits\n');

  await Promotion.deleteOne({ code: CODE });

  /* ── Limited promotion under concurrency ───────────────────────── */

  await Promotion.create({
    code: CODE,
    type: 'percentage',
    value: 10,
    usageLimit: LIMIT,
    usageCount: 0,
    perPatientLimit: 0,
    isActive: true,
  });

  // Fire every attempt at once — this is the race the atomic filter exists for.
  const results = await Promise.all(Array.from({ length: ATTEMPTS }, () => claim(CODE)));
  const granted = results.filter(Boolean).length;
  const refused = results.length - granted;

  expect(`${ATTEMPTS} concurrent claims on a limit of ${LIMIT}: granted`, granted, LIMIT);
  expect('refused', refused, ATTEMPTS - LIMIT);

  const after = await Promotion.findOne({ code: CODE }).lean();
  expect('usageCount never exceeds the limit', after?.usageCount, LIMIT);

  expect('a further claim is refused', await claim(CODE), false);

  /* ── Unlimited promotion ───────────────────────────────────────── */

  await Promotion.updateOne({ code: CODE }, { $set: { usageLimit: 0, usageCount: 0 } });
  const unlimited = await Promise.all(Array.from({ length: 10 }, () => claim(CODE)));
  expect('usageLimit 0 means unlimited', unlimited.every(Boolean), true);

  /* ── Inactive promotion ────────────────────────────────────────── */

  await Promotion.updateOne({ code: CODE }, { $set: { isActive: false } });
  expect('an inactive promotion cannot be claimed', await claim(CODE), false);

  await Promotion.deleteOne({ code: CODE });
  await mongoose.disconnect();

  console.log(
    failures === 0
      ? '\n\x1b[32m✓ Promotion limits hold under concurrency\x1b[0m\n'
      : `\n\x1b[31m✗ ${failures} check(s) failed\x1b[0m\n`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
