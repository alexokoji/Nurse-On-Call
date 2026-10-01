/**
 * Development database seed.
 *
 * Produces a complete, internally consistent dataset: every booking points at
 * a real service and a staff member cleared to deliver it, every payment
 * matches its booking total, and aggregates (patient spend, service ratings)
 * are recomputed from the rows actually written rather than invented.
 *
 * Run with:  npm run seed        (adds to whatever is there)
 *            npm run seed -- --fresh   (drops the collections first)
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import { config as loadEnv } from 'dotenv';
import path from 'path';
import bcrypt from 'bcryptjs';

loadEnv({ path: path.resolve(process.cwd(), '.env.local'), override: true });

import {
  User,
  PatientProfile,
  StaffProfile,
  Service,
  ServiceCategory,
  Booking,
  Payment,
  Invoice,
  Review,
  Notification,
  Role,
  Setting,
  Counter,
  HealthArticle,
  Promotion,
  AuditLog,
  BlockedSchedule,
  Refund,
} from '../src/models';
import { DEFAULT_ROLE_PERMISSIONS, ROLE_DESCRIPTIONS } from '../src/lib/permissions/catalogue';
import { DEFAULT_SETTINGS } from '../src/lib/settings/defaults';
import { toDateKey, minutesToTime, normalisePhone } from '../src/lib/utils';
import { WEEKDAYS } from '../src/types';
import {
  ADMINS,
  ARTICLES,
  CATEGORIES,
  FIRST_NAMES,
  LAST_NAMES,
  PH_AREAS,
  REVIEW_COMMENTS,
  SERVICES,
  STAFF,
  STREETS,
} from './seed-data';

const FRESH = process.argv.includes('--fresh');

const PATIENT_COUNT = 34;
const BOOKING_COUNT = 140;
const DEV_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@12345';

/* Deterministic PRNG so repeated seeds produce the same demo data. */
let seedState = 20250520;
function random(): number {
  seedState = (seedState * 1664525 + 1013904223) % 4294967296;
  return seedState / 4294967296;
}
function pick<T>(items: T[]): T {
  return items[Math.floor(random() * items.length)];
}
function pickMany<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const out: T[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return out;
}
function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function log(message: string) {
  console.log(`  ${message}`);
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set. Copy .env.example to .env.local first.');

  console.log('\n🌱 Seeding NurseOnCall\n');
  await mongoose.connect(uri);
  log(`connected to ${uri.replace(/\/\/.*@/, '//***@')}`);

  if (FRESH) {
    await Promise.all([
      User.deleteMany({}),
      PatientProfile.deleteMany({}),
      StaffProfile.deleteMany({}),
      Service.deleteMany({}),
      ServiceCategory.deleteMany({}),
      Booking.deleteMany({}),
      Payment.deleteMany({}),
      Invoice.deleteMany({}),
      Refund.deleteMany({}),
      Review.deleteMany({}),
      Notification.deleteMany({}),
      Role.deleteMany({}),
      Setting.deleteMany({}),
      Counter.deleteMany({}),
      HealthArticle.deleteMany({}),
      Promotion.deleteMany({}),
      AuditLog.deleteMany({}),
      BlockedSchedule.deleteMany({}),
    ]);
    log('cleared existing collections (--fresh)');
  }

  // Indexes must exist before inserts, or the unique slot guard is not enforced.
  await Promise.all([
    Booking.syncIndexes(),
    User.syncIndexes(),
    Service.syncIndexes(),
    Payment.syncIndexes(),
  ]);
  log('indexes synchronised');

  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 12);

  /* ── Roles ─────────────────────────────────────────────────────── */

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
  log(`roles seeded (${Object.keys(DEFAULT_ROLE_PERMISSIONS).length})`);

  /* ── Settings ──────────────────────────────────────────────────── */

  for (const [group, values] of Object.entries(DEFAULT_SETTINGS)) {
    await Setting.findOneAndUpdate({ group }, { group, values }, { upsert: true });
  }
  log('settings seeded');

  /* ── Admin users ───────────────────────────────────────────────── */

  const adminIds: mongoose.Types.ObjectId[] = [];
  for (const admin of ADMINS) {
    const user = await User.findOneAndUpdate(
      { email: admin.email },
      {
        name: admin.name,
        email: admin.email,
        phone: normalisePhone(admin.phone),
        password: passwordHash,
        role: admin.role,
        status: 'active',
        emailVerifiedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    adminIds.push(user._id);
  }
  log(`admin users seeded (${ADMINS.length})`);

  /* ── Categories & services ─────────────────────────────────────── */

  const categoryBySlug = new Map<string, mongoose.Types.ObjectId>();
  for (const category of CATEGORIES) {
    const doc = await ServiceCategory.findOneAndUpdate(
      { slug: category.slug },
      { ...category, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    categoryBySlug.set(category.slug, doc._id);
  }
  log(`service categories seeded (${CATEGORIES.length})`);

  const serviceBySlug = new Map<string, mongoose.HydratedDocument<InstanceType<typeof Service>>>();
  for (const service of SERVICES) {
    const doc = await Service.findOneAndUpdate(
      { slug: service.slug },
      {
        name: service.name,
        slug: service.slug,
        category: categoryBySlug.get(service.categorySlug),
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
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    serviceBySlug.set(service.slug, doc as never);
  }
  log(`services seeded (${SERVICES.length})`);

  /* ── Staff ─────────────────────────────────────────────────────── */

  const staffProfiles: { id: mongoose.Types.ObjectId; name: string; serviceIds: string[] }[] = [];
  let staffSeq = 0;

  for (const member of STAFF) {
    staffSeq += 1;

    const user = await User.findOneAndUpdate(
      { email: member.email },
      {
        name: member.name,
        email: member.email,
        phone: normalisePhone(member.phone),
        password: passwordHash,
        role: 'staff',
        status: 'active',
        emailVerifiedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const serviceIds = member.serviceSlugs
      .map((slug) => serviceBySlug.get(slug)?._id)
      .filter(Boolean) as mongoose.Types.ObjectId[];

    const workingHours = WEEKDAYS.map((day) => {
      const shift = member.schedule[day];
      return shift
        ? { day, enabled: true, ...shift }
        : { day, enabled: false, start: '08:00', end: '17:00' };
    });

    const profile = await StaffProfile.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        staffNumber: `STF-${String(staffSeq).padStart(6, '0')}`,
        title: member.title,
        department: member.department,
        bio: member.bio,
        qualifications: member.qualifications,
        specialisations: member.specialisations,
        yearsOfExperience: member.yearsOfExperience,
        services: serviceIds,
        workingHours,
        maxConcurrentAppointments: 1,
        isPubliclyVisible: true,
        isActive: true,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    staffProfiles.push({
      id: profile._id,
      name: member.name,
      serviceIds: serviceIds.map(String),
    });
  }
  await Counter.findByIdAndUpdate('staff', { seq: staffSeq }, { upsert: true });
  log(`staff seeded (${STAFF.length})`);

  /* ── Patients ──────────────────────────────────────────────────── */

  const patients: {
    userId: mongoose.Types.ObjectId;
    profileId: mongoose.Types.ObjectId;
    name: string;
    email: string;
    phone: string;
    address: { street: string; area: string; city: string; state: string };
  }[] = [];

  for (let i = 0; i < PATIENT_COUNT; i++) {
    const first = FIRST_NAMES[i % FIRST_NAMES.length];
    const last = LAST_NAMES[(i * 7) % LAST_NAMES.length];
    const name = `${first} ${last}`;
    const email = `${first}.${last}${i}`.toLowerCase().replace(/[^a-z0-9.]/g, '') + '@example.com';
    const phone = normalisePhone(`080${String(30000000 + i * 137).slice(0, 8)}`);
    const spot = PH_AREAS[i % PH_AREAS.length];

    const address = {
      street: `${randomInt(1, 120)} ${pick(STREETS)}`,
      area: spot.area,
      city: spot.city,
      state: 'Rivers',
    };

    const user = await User.findOneAndUpdate(
      { email },
      {
        name,
        email,
        phone,
        password: passwordHash,
        role: 'patient',
        // A few inactive accounts make the admin status filter meaningful.
        // Index 0 is always active — it is the documented demo login.
        status: i > 0 && i % 17 === 0 ? 'inactive' : 'active',
        emailVerifiedAt: i % 5 === 0 ? null : new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    const profile = await PatientProfile.findOneAndUpdate(
      { user: user._id },
      {
        user: user._id,
        patientNumber: `PAT-${String(i + 1).padStart(6, '0')}`,
        dateOfBirth: new Date(randomInt(1955, 2006), randomInt(0, 11), randomInt(1, 28)),
        gender: i % 2 === 0 ? 'female' : 'male',
        address,
        bloodGroup: pick(['O+', 'A+', 'B+', 'AB+', 'O-']),
        allergies: i % 6 === 0 ? [pick(['Penicillin', 'Sulfa drugs', 'Peanuts'])] : [],
        chronicConditions:
          i % 5 === 0 ? [pick(['Hypertension', 'Type 2 Diabetes', 'Asthma'])] : [],
        emergencyContact: {
          name: `${pick(FIRST_NAMES)} ${last}`,
          relationship: pick(['Spouse', 'Sibling', 'Child', 'Parent']),
          phone: normalisePhone(`0803${randomInt(1000000, 9999999)}`),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    patients.push({
      userId: user._id,
      profileId: profile._id,
      name,
      email,
      phone,
      address,
    });
  }
  await Counter.findByIdAndUpdate('patient', { seq: PATIENT_COUNT }, { upsert: true });
  log(`patients seeded (${PATIENT_COUNT})`);

  /* ── Bookings, payments, invoices ──────────────────────────────── */

  const serviceList = [...serviceBySlug.values()];
  /** Guards the unique (staff, startAt) index while generating. */
  const takenSlots = new Set<string>();

  let bookingSeq = 0;
  let paymentSeq = 0;
  let invoiceSeq = 0;

  const completedBookings: {
    id: mongoose.Types.ObjectId;
    patientUserId: mongoose.Types.ObjectId;
    serviceId: mongoose.Types.ObjectId;
    staffId: mongoose.Types.ObjectId;
  }[] = [];

  const spendByPatient = new Map<string, { total: number; count: number; last: Date | null }>();

  for (let i = 0; i < BOOKING_COUNT; i++) {
    const service = pick(serviceList);
    const serviceId = String(service._id);

    const eligibleStaff = staffProfiles.filter((member) => member.serviceIds.includes(serviceId));
    if (eligibleStaff.length === 0) continue;
    const staff = pick(eligibleStaff);

    const patient = pick(patients);

    /* Spread bookings from 45 days ago to 30 days ahead. */
    const dayOffset = randomInt(-45, 30);
    const date = new Date();
    date.setDate(date.getDate() + dayOffset);
    date.setHours(0, 0, 0, 0);

    // Sundays are closed for every seeded staff member.
    if (date.getDay() === 0) continue;

    const dateKey = toDateKey(date);
    const startMinutes = randomInt(16, 33) * 30; // 08:00 – 16:30 on the half hour
    const startTime = minutesToTime(startMinutes);
    const endTime = minutesToTime(startMinutes + service.durationMinutes);

    const slotKey = `${staff.id}-${dateKey}-${startTime}`;
    if (takenSlots.has(slotKey)) continue;
    takenSlots.add(slotKey);

    const startAt = new Date(date);
    startAt.setHours(Math.floor(startMinutes / 60), startMinutes % 60, 0, 0);
    const endAt = new Date(date);
    endAt.setHours(
      Math.floor((startMinutes + service.durationMinutes) / 60),
      (startMinutes + service.durationMinutes) % 60,
      0,
      0,
    );

    /* Location must be one the service actually supports. */
    const locationType =
      service.serviceType === 'hybrid'
        ? pick(['clinic', 'home'] as const)
        : (service.serviceType as 'clinic' | 'home' | 'virtual');

    const surcharge = locationType === 'home' ? service.homeVisitSurchargeKobo : 0;
    const total = service.priceKobo + surcharge;

    /* Status follows the date: past appointments are resolved, future ones pending. */
    const isPast = startAt.getTime() < Date.now();
    const roll = random();
    const status = isPast
      ? roll < 0.72
        ? 'completed'
        : roll < 0.86
          ? 'cancelled'
          : roll < 0.93
            ? 'no_show'
            : 'completed'
      : roll < 0.68
        ? 'confirmed'
        : roll < 0.9
          ? 'pending_payment'
          : 'confirmed';

    const isPaid = status === 'completed' || status === 'confirmed' || status === 'no_show';

    bookingSeq += 1;
    const reference = `APT-${String(bookingSeq).padStart(6, '0')}`;

    let booking;
    try {
      booking = await Booking.create({
        reference,
        patient: patient.userId,
        patientProfile: patient.profileId,
        service: service._id,
        staff: staff.id,
        snapshot: {
          serviceName: service.name,
          serviceSlug: service.slug,
          durationMinutes: service.durationMinutes,
          bufferMinutes: service.bufferMinutes,
        },
        dateKey,
        startTime,
        endTime,
        startAt,
        endAt,
        locationType,
        address: locationType === 'home' ? patient.address : undefined,
        contact: {
          name: patient.name,
          phone: patient.phone,
          email: patient.email,
        },
        notes: random() < 0.25 ? pick([
          'Please call on arrival, the gate bell is not working.',
          'Patient has limited mobility — ground floor access needed.',
          'Prefers a morning appointment where possible.',
          'Second visit for the same issue.',
        ]) : undefined,
        status,
        servicePriceKobo: service.priceKobo,
        surchargeKobo: surcharge,
        discountKobo: 0,
        totalKobo: total,
        isPaid,
        paidAt: isPaid ? new Date(startAt.getTime() - 86_400_000) : null,
        holdExpiresAt:
          status === 'pending_payment' ? new Date(Date.now() + 30 * 60 * 1000) : null,
        completedAt: status === 'completed' ? endAt : null,
        cancelledAt: status === 'cancelled' ? new Date(startAt.getTime() - 3_600_000) : null,
        cancellationReason:
          status === 'cancelled'
            ? pick([
                'Patient requested cancellation.',
                'Rescheduled to a later date by the patient.',
                'Patient no longer required the service.',
              ])
            : undefined,
      });
    } catch (error) {
      // Duplicate slot — the unique index doing its job. Skip and continue.
      if ((error as { code?: number }).code === 11000) continue;
      throw error;
    }

    /* Payment for anything that was actually paid. */
    if (isPaid) {
      paymentSeq += 1;
      const payment = await Payment.create({
        reference: `TXN-${String(paymentSeq).padStart(6, '0')}`,
        booking: booking._id,
        patient: patient.userId,
        provider: pick(['paystack', 'paystack', 'flutterwave', 'korapay'] as const),
        providerReference: `dev_${bookingSeq}_${randomInt(100000, 999999)}`,
        amountKobo: total,
        amountPaidKobo: total,
        currency: 'NGN',
        status: 'successful',
        channel: pick(['card', 'bank_transfer', 'ussd']),
        paidAt: booking.paidAt,
        verifiedAt: booking.paidAt,
        webhookVerifiedAt: booking.paidAt,
        fees: Math.round(total * 0.015),
      });

      invoiceSeq += 1;
      const lines = [
        {
          description: service.name,
          quantity: 1,
          unitPriceKobo: service.priceKobo,
          totalKobo: service.priceKobo,
        },
      ];
      if (surcharge > 0) {
        lines.push({
          description: 'Home visit surcharge',
          quantity: 1,
          unitPriceKobo: surcharge,
          totalKobo: surcharge,
        });
      }

      await Invoice.create({
        number: `RCP-${String(invoiceSeq).padStart(6, '0')}`,
        booking: booking._id,
        payment: payment._id,
        patient: patient.userId,
        lines,
        subtotalKobo: service.priceKobo + surcharge,
        discountKobo: 0,
        totalKobo: total,
        issuedAt: booking.paidAt ?? new Date(),
      });

      const key = String(patient.userId);
      const current = spendByPatient.get(key) ?? { total: 0, count: 0, last: null };
      spendByPatient.set(key, {
        total: current.total + total,
        count: current.count + 1,
        last: !current.last || startAt > current.last ? startAt : current.last,
      });
    }

    /* A pending-payment booking gets a matching pending transaction. */
    if (status === 'pending_payment') {
      paymentSeq += 1;
      await Payment.create({
        reference: `TXN-${String(paymentSeq).padStart(6, '0')}`,
        booking: booking._id,
        patient: patient.userId,
        provider: 'paystack',
        amountKobo: total,
        currency: 'NGN',
        status: random() < 0.35 ? 'failed' : 'pending',
        failureReason: random() < 0.35 ? 'The card was declined by the issuing bank.' : undefined,
      });
    }

    if (status === 'completed') {
      completedBookings.push({
        id: booking._id,
        patientUserId: patient.userId,
        serviceId: service._id,
        staffId: staff.id,
      });
    }
  }

  await Counter.findByIdAndUpdate('booking', { seq: bookingSeq }, { upsert: true });
  await Counter.findByIdAndUpdate('payment', { seq: paymentSeq }, { upsert: true });
  await Counter.findByIdAndUpdate('invoice', { seq: invoiceSeq }, { upsert: true });
  log(`bookings seeded (${bookingSeq}), payments (${paymentSeq}), receipts (${invoiceSeq})`);

  /* ── Patient aggregates, computed from what was actually written ─ */

  for (const [userId, totals] of spendByPatient) {
    await PatientProfile.updateOne(
      { user: userId },
      {
        $set: {
          totalAppointments: totals.count,
          totalSpentKobo: totals.total,
          lastAppointmentAt: totals.last,
        },
      },
    );
  }
  log('patient aggregates recomputed');

  /* ── Reviews ───────────────────────────────────────────────────── */

  const reviewTargets = pickMany(completedBookings, Math.min(48, completedBookings.length));
  let reviewCount = 0;

  for (const target of reviewTargets) {
    const rating = random() < 0.72 ? 5 : random() < 0.8 ? 4 : randomInt(2, 3);
    const status = random() < 0.82 ? 'approved' : random() < 0.6 ? 'pending' : 'hidden';

    try {
      await Review.create({
        patient: target.patientUserId,
        booking: target.id,
        service: target.serviceId,
        staff: target.staffId,
        rating,
        comment: pick(REVIEW_COMMENTS),
        status,
        moderatedAt: status === 'approved' ? new Date() : null,
      });
      await Booking.updateOne({ _id: target.id }, { $set: { hasReview: true } });
      reviewCount += 1;
    } catch (error) {
      // One review per booking — the unique index enforces it.
      if ((error as { code?: number }).code !== 11000) throw error;
    }
  }
  log(`reviews seeded (${reviewCount})`);

  /* Recompute service and staff ratings from approved reviews only. */
  const ratingAgg = await Review.aggregate([
    { $match: { status: 'approved' } },
    { $group: { _id: '$service', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  for (const row of ratingAgg) {
    await Service.updateOne(
      { _id: row._id },
      { $set: { averageRating: Math.round(row.avg * 10) / 10, reviewCount: row.count } },
    );
  }

  const staffRatingAgg = await Review.aggregate([
    { $match: { status: 'approved', staff: { $ne: null } } },
    { $group: { _id: '$staff', avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  for (const row of staffRatingAgg) {
    await StaffProfile.updateOne(
      { _id: row._id },
      { $set: { averageRating: Math.round(row.avg * 10) / 10, reviewCount: row.count } },
    );
  }

  /* Booking counts per service, from the bookings actually created. */
  const bookingAgg = await Booking.aggregate([
    { $group: { _id: '$service', count: { $sum: 1 } } },
  ]);
  for (const row of bookingAgg) {
    await Service.updateOne({ _id: row._id }, { $set: { bookingCount: row.count } });
  }
  log('service and staff ratings recomputed');

  /* ── Notifications ─────────────────────────────────────────────── */

  const recentBookings = await Booking.find({ isPaid: true })
    .sort({ createdAt: -1 })
    .limit(30)
    .lean();

  let notificationCount = 0;
  for (const booking of recentBookings) {
    await Notification.create({
      recipient: booking.patient,
      recipientEmail: booking.contact.email,
      channel: 'in_app',
      template: 'booking_confirmation',
      subject: `Your ${booking.snapshot.serviceName} appointment is confirmed — ${booking.reference}`,
      body: `Your appointment is confirmed for ${booking.dateKey} at ${booking.startTime}.`,
      status: random() < 0.5 ? 'sent' : 'read',
      readAt: random() < 0.5 ? new Date() : null,
      sentAt: new Date(),
      link: `/patient/appointments/${booking._id}`,
      relatedBooking: booking._id,
    });
    notificationCount += 1;
  }
  log(`notifications seeded (${notificationCount})`);

  /* ── Promotions ────────────────────────────────────────────────── */

  await Promotion.findOneAndUpdate(
    { code: 'WELCOME10' },
    {
      code: 'WELCOME10',
      description: '10% off your first booking with NurseOnCall.',
      type: 'percentage',
      value: 10,
      maxDiscountKobo: 500_000,
      minSpendKobo: 0,
      perPatientLimit: 1,
      usageLimit: 0,
      isActive: true,
    },
    { upsert: true },
  );

  await Promotion.findOneAndUpdate(
    { code: 'CARE5000' },
    {
      code: 'CARE5000',
      description: '₦5,000 off bookings over ₦25,000.',
      type: 'fixed',
      value: 500_000,
      minSpendKobo: 2_500_000,
      perPatientLimit: 2,
      usageLimit: 200,
      isActive: true,
    },
    { upsert: true },
  );
  log('promotions seeded (2)');

  /* ── Health articles ───────────────────────────────────────────── */

  for (const article of ARTICLES) {
    await HealthArticle.findOneAndUpdate(
      { slug: article.slug },
      {
        ...article,
        authorName: 'NurseOnCall Clinical Team',
        status: 'published',
        publishedAt: new Date(Date.now() - randomInt(1, 90) * 86_400_000),
        seo: { title: article.title, description: article.excerpt },
      },
      { upsert: true, setDefaultsOnInsert: true },
    );
  }
  log(`health articles seeded (${ARTICLES.length})`);

  /* ── A public holiday, so the blocked-date logic is exercised ──── */

  const holiday = new Date();
  holiday.setDate(holiday.getDate() + 14);
  const holidayKey = toDateKey(holiday);
  await BlockedSchedule.findOneAndUpdate(
    { staff: null, startDateKey: holidayKey },
    {
      staff: null,
      type: 'holiday',
      startDateKey: holidayKey,
      endDateKey: holidayKey,
      reason: 'Public holiday — clinic closed',
      approved: true,
    },
    { upsert: true },
  );
  log('public holiday seeded');

  /* ── Summary ───────────────────────────────────────────────────── */

  const [userTotal, bookingTotal, revenueAgg] = await Promise.all([
    User.countDocuments({}),
    Booking.countDocuments({}),
    Payment.aggregate([
      { $match: { status: 'successful' } },
      { $group: { _id: null, total: { $sum: '$amountPaidKobo' } } },
    ]),
  ]);

  const revenue = (revenueAgg[0]?.total ?? 0) / 100;

  console.log('\n✅ Seed complete\n');
  console.log(`   Users:        ${userTotal}`);
  console.log(`   Bookings:     ${bookingTotal}`);
  console.log(`   Revenue:      ₦${revenue.toLocaleString('en-NG')}`);
  console.log('\n   Development sign-in (all accounts share this password):');
  console.log(`   Super Admin   admin@nurseoncall.ng            / ${DEV_PASSWORD}`);
  console.log(`   Admin         ngozi.abara@nurseoncall.ng      / ${DEV_PASSWORD}`);
  console.log(`   Operations    tunde.bakare@nurseoncall.ng     / ${DEV_PASSWORD}`);
  console.log(`   Finance       halima.yusuf@nurseoncall.ng     / ${DEV_PASSWORD}`);
  console.log(`   Staff         maryjane.okafor@nurseoncall.ng  / ${DEV_PASSWORD}`);
  console.log(`   Patient       ${patients[0].email.padEnd(30)}/ ${DEV_PASSWORD}`);
  console.log('\n   ⚠  Development credentials only. Never deploy these.\n');

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('\n❌ Seed failed:', error);
  process.exit(1);
});
