/**
 * Adds categories and services to a real database.
 *
 * Distinct from `npm run seed`, which builds a whole demo practice — invented
 * patients, bookings and revenue — and must never be pointed at production.
 * This writes catalogue rows only.
 *
 * Additive by design. An existing category or service with the same slug is
 * left exactly as it is, because an administrator may have edited its price,
 * description or status, and a seed script has no business overwriting that.
 * Re-running is therefore safe and reports what it skipped.
 *
 *   MONGODB_URI="<uri>" npm run seed:catalogue
 *   MONGODB_URI="<uri>" npm run seed:catalogue -- --dry-run
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';

/* `override: false`, as in bootstrap.ts: a URI given in the environment must
   win over .env.local, or pointing this at production silently writes to the
   local development database. */
loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: false });

import { Service, ServiceCategory } from '../src/models';
import { EXTRA_CATEGORIES, EXTRA_SERVICES } from './catalogue-data';
import { CATEGORIES } from './seed-data';

const DRY_RUN = process.argv.includes('--dry-run');

function log(message: string) {
  console.log(`  ${message}`);
}

/** Atlas SRV lookups fail intermittently; see bootstrap.ts. */
async function connectWithRetry(uri: string, attempts = 6): Promise<void> {
  const transient = /ESERVFAIL|EAI_AGAIN|ETIMEDOUT|ENOTFOUND|querySrv|queryTxt/;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 20_000 });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!transient.test(message) || attempt === attempts) throw error;
      log(`DNS lookup failed — retrying ${attempt}/${attempts - 1}`);
      await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
    }
  }
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set.');

  console.log(`\n🗂  Catalogue${DRY_RUN ? ' (dry run — nothing will be written)' : ''}\n`);
  await connectWithRetry(uri);
  log(`database: ${mongoose.connection.name}`);

  await Promise.all([ServiceCategory.syncIndexes(), Service.syncIndexes()]);

  /* ── Categories ──────────────────────────────────────────────────── */

  let categoriesAdded = 0;
  let categoriesKept = 0;

  for (const category of EXTRA_CATEGORIES) {
    const existing = await ServiceCategory.findOne({ slug: category.slug }).select('_id').lean();
    if (existing) {
      categoriesKept += 1;
      continue;
    }
    if (!DRY_RUN) await ServiceCategory.create({ ...category, isActive: true });
    categoriesAdded += 1;
    log(`+ category  ${category.name}`);
  }

  /* Some of these services belong under the original categories — a drip is
     home care, an ECG is diagnostics. A real deployment may never have had
     those rows: an administrator who built their catalogue by hand can easily
     have one category and six services. Any category a service needs is
     therefore created from the original definitions, or the service would be
     silently skipped. */
  let needed = 0;
  for (const slug of new Set(EXTRA_SERVICES.map((service) => service.categorySlug))) {
    if (EXTRA_CATEGORIES.some((category) => category.slug === slug)) continue;

    const existing = await ServiceCategory.findOne({ slug }).select('_id').lean();
    if (existing) continue;

    const definition = CATEGORIES.find((category) => category.slug === slug);
    if (!definition) throw new Error(`No definition for category "${slug}".`);

    if (!DRY_RUN) await ServiceCategory.create({ ...definition, isActive: true });
    needed += 1;
    categoriesAdded += 1;
    log(`+ category  ${definition.name}  (needed by a service below)`);
  }
  if (needed > 0 && DRY_RUN) log(`(dry run) ${needed} such category/ies would be created`);

  /* Every category, old and new, so services can be attached to either. */
  const categories = await ServiceCategory.find().select('slug').lean();
  const idBySlug = new Map(categories.map((c) => [c.slug, c._id]));

  /* ── Services ────────────────────────────────────────────────────── */

  let servicesAdded = 0;
  let servicesKept = 0;
  const missingCategories: string[] = [];

  for (const service of EXTRA_SERVICES) {
    const existing = await Service.findOne({ slug: service.slug }).select('_id').lean();
    if (existing) {
      servicesKept += 1;
      continue;
    }

    const categoryId = idBySlug.get(service.categorySlug);
    if (!categoryId) {
      /* Only reachable in a dry run, where the category was not created. */
      missingCategories.push(`${service.slug} → ${service.categorySlug}`);
      continue;
    }

    if (!DRY_RUN) {
      await Service.create({
        name: service.name,
        slug: service.slug,
        category: categoryId,
        shortDescription: service.shortDescription,
        description: service.description,
        icon: service.icon,
        priceKobo: service.priceNaira * 100,
        homeVisitSurchargeKobo: service.homeVisitSurchargeNaira * 100,
        durationMinutes: service.durationMinutes,
        bufferMinutes: service.bufferMinutes,
        serviceType: service.serviceType,
        whatsIncluded: service.whatsIncluded,
        requirements: service.requirements,
        preparation: service.preparation,
        faqs: service.faqs,
        status: 'published',
        isFeatured: service.isFeatured,
        seo: {
          title: `${service.name} in Port Harcourt | NurseOnCall`,
          description: service.shortDescription,
        },
      });
    }

    servicesAdded += 1;
    log(`+ service   ${service.name}  ₦${service.priceNaira.toLocaleString('en-NG')}`);
  }

  /* ── Summary ─────────────────────────────────────────────────────── */

  console.log('');
  log(`categories: ${categoriesAdded} added, ${categoriesKept} already present`);
  log(`services:   ${servicesAdded} added, ${servicesKept} already present`);

  if (missingCategories.length > 0) {
    log(`(dry run) these would attach to categories created by a real run:`);
    for (const item of missingCategories) log(`    ${item}`);
  }

  const [totalCategories, totalServices, published] = await Promise.all([
    ServiceCategory.countDocuments(),
    Service.countDocuments(),
    Service.countDocuments({ status: 'published' }),
  ]);

  console.log('');
  log(`the catalogue now holds ${totalCategories} categories`);
  log(`and ${totalServices} services, ${published} of them published`);

  if (!DRY_RUN && servicesAdded > 0) {
    console.log('\n  New services are published and bookable immediately.');
    console.log('  Review their prices and assign staff to them in /admin/services.\n');
  } else {
    console.log('');
  }

  await mongoose.disconnect();
  console.log(DRY_RUN ? '  Nothing was written.\n' : '  \x1b[32m✓ Done\x1b[0m\n');
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
