/**
 * Small development helper for poking at seeded data from the terminal.
 *
 *   npx tsx scripts/dev-inspect.ts service home-nursing
 *   npx tsx scripts/dev-inspect.ts counts
 *   npx tsx scripts/dev-inspect.ts slots home-nursing home 3
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import { Service, Booking, User, Payment, StaffProfile } from '../src/models';
import { toDateKey } from '../src/lib/utils';

async function main() {
  await mongoose.connect(process.env.MONGODB_URI!);

  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case 'service': {
      const service = await Service.findOne({ slug: args[0] }).lean();
      console.log(JSON.stringify({ id: String(service?._id), name: service?.name }, null, 2));
      break;
    }

    case 'slots': {
      const service = await Service.findOne({ slug: args[0] }).lean();
      if (!service) throw new Error(`No service with slug "${args[0]}"`);

      const date = new Date();
      date.setDate(date.getDate() + Number(args[2] ?? 3));

      const { getAvailability } = await import('../src/lib/bookings/availability');
      const result = await getAvailability({
        serviceId: String(service._id),
        dateKey: toDateKey(date),
        locationType: (args[1] ?? 'home') as never,
      });

      console.log(`${result.dateKey} — ${result.slots.filter((s) => s.available).length}/${result.slots.length} free`);
      if (result.unavailableReason) console.log(`reason: ${result.unavailableReason}`);
      console.log(
        result.slots
          .slice(0, 12)
          .map((s) => `${s.start}${s.available ? '' : ' (taken)'}`)
          .join('  '),
      );
      break;
    }

    case 'counts':
    default: {
      const [users, staff, services, bookings, payments] = await Promise.all([
        User.countDocuments({}),
        StaffProfile.countDocuments({}),
        Service.countDocuments({}),
        Booking.countDocuments({}),
        Payment.countDocuments({}),
      ]);
      console.log({ users, staff, services, bookings, payments });
      break;
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
