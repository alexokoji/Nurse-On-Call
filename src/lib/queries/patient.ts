import 'server-only';
import { connectDB } from '@/lib/db/connect';
import {
  Booking,
  Payment,
  Invoice,
  Notification,
  PatientProfile,
  Review,
  SupportTicket,
  User,
} from '@/models';
import type { BookingStatus, PaymentStatus } from '@/types';

/**
 * Read models for the patient portal.
 *
 * Every function takes the patient's user id and filters on it, so a query
 * can never leak another patient's records even if a route guard is missed.
 */

export interface PatientBookingRow {
  id: string;
  reference: string;
  serviceName: string;
  serviceSlug: string;
  staffName: string | null;
  dateKey: string;
  startTime: string;
  endTime: string;
  startAt: string;
  locationType: string;
  address: string | null;
  status: BookingStatus;
  totalKobo: number;
  isPaid: boolean;
  hasReview: boolean;
  notes?: string;
  cancellationReason?: string;
}

function toRow(doc: Record<string, unknown>): PatientBookingRow {
  const staff = doc.staff as { user?: { name?: string } } | null;
  const snapshot = doc.snapshot as { serviceName: string; serviceSlug: string };
  const address = doc.address as Record<string, string> | undefined;

  return {
    id: String(doc._id),
    reference: String(doc.reference),
    serviceName: snapshot.serviceName,
    serviceSlug: snapshot.serviceSlug,
    staffName: staff?.user?.name ?? null,
    dateKey: String(doc.dateKey),
    startTime: String(doc.startTime),
    endTime: String(doc.endTime),
    startAt: (doc.startAt as Date).toISOString(),
    locationType: String(doc.locationType),
    address: address
      ? [address.street, address.area, address.city, address.state].filter(Boolean).join(', ')
      : null,
    status: doc.status as BookingStatus,
    totalKobo: Number(doc.totalKobo),
    isPaid: Boolean(doc.isPaid),
    hasReview: Boolean(doc.hasReview),
    notes: doc.notes ? String(doc.notes) : undefined,
    cancellationReason: doc.cancellationReason ? String(doc.cancellationReason) : undefined,
  };
}

const STAFF_POPULATE = {
  path: 'staff',
  select: 'user title',
  populate: { path: 'user', select: 'name' },
};

export async function getPatientBookings(
  userId: string,
  options: { status?: 'upcoming' | 'past' | 'all'; limit?: number } = {},
): Promise<PatientBookingRow[]> {
  await connectDB();

  const filter: Record<string, unknown> = { patient: userId };

  if (options.status === 'upcoming') {
    filter.status = { $in: ['pending_payment', 'confirmed', 'in_progress'] };
    filter.startAt = { $gte: new Date() };
  } else if (options.status === 'past') {
    filter.$or = [
      { startAt: { $lt: new Date() } },
      { status: { $in: ['completed', 'cancelled', 'no_show', 'expired'] } },
    ];
  }

  const query = Booking.find(filter)
    .populate(STAFF_POPULATE)
    .sort(options.status === 'upcoming' ? { startAt: 1 } : { startAt: -1 });

  if (options.limit) query.limit(options.limit);

  const docs = await query.lean();
  return docs.map((doc) => toRow(doc as unknown as Record<string, unknown>));
}

export async function getPatientBooking(userId: string, bookingId: string) {
  await connectDB();

  const doc = await Booking.findOne({ _id: bookingId, patient: userId })
    .populate(STAFF_POPULATE)
    .lean();

  if (!doc) return null;

  const [payments, invoice, review] = await Promise.all([
    Payment.find({ booking: doc._id }).sort({ createdAt: -1 }).lean(),
    Invoice.findOne({ booking: doc._id }).lean(),
    Review.findOne({ booking: doc._id }).lean(),
  ]);

  return {
    ...toRow(doc as unknown as Record<string, unknown>),
    servicePriceKobo: doc.servicePriceKobo,
    surchargeKobo: doc.surchargeKobo,
    discountKobo: doc.discountKobo,
    contact: {
      name: doc.contact.name,
      phone: doc.contact.phone,
      email: doc.contact.email,
    },
    payments: payments.map((payment) => ({
      id: String(payment._id),
      reference: payment.reference,
      status: payment.status as PaymentStatus,
      amountKobo: payment.amountKobo,
      amountPaidKobo: payment.amountPaidKobo,
      provider: payment.provider,
      channel: payment.channel ?? null,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      createdAt: payment.createdAt.toISOString(),
    })),
    invoiceNumber: invoice?.number ?? null,
    review: review
      ? { id: String(review._id), rating: review.rating, comment: review.comment, status: review.status }
      : null,
  };
}

export async function getPatientPayments(userId: string) {
  await connectDB();

  const docs = await Payment.find({ patient: userId })
    .populate('booking', 'reference snapshot dateKey startTime')
    .sort({ createdAt: -1 })
    .lean();

  return docs.map((doc) => {
    const booking = doc.booking as unknown as {
      _id: unknown;
      reference?: string;
      snapshot?: { serviceName?: string };
      dateKey?: string;
    } | null;

    return {
      id: String(doc._id),
      reference: doc.reference,
      bookingId: booking ? String(booking._id) : null,
      bookingReference: booking?.reference ?? '—',
      serviceName: booking?.snapshot?.serviceName ?? '—',
      amountKobo: doc.amountKobo,
      amountPaidKobo: doc.amountPaidKobo,
      refundedKobo: doc.refundedKobo,
      status: doc.status as PaymentStatus,
      provider: doc.provider,
      channel: doc.channel ?? null,
      paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
      createdAt: doc.createdAt.toISOString(),
    };
  });
}

export async function getPatientReceipts(userId: string) {
  await connectDB();

  const docs = await Invoice.find({ patient: userId })
    .populate('booking', 'reference snapshot dateKey startTime locationType')
    .sort({ issuedAt: -1 })
    .lean();

  return docs.map((doc) => {
    const booking = doc.booking as unknown as {
      _id: unknown;
      reference?: string;
      snapshot?: { serviceName?: string };
      dateKey?: string;
    } | null;

    return {
      id: String(doc._id),
      number: doc.number,
      bookingId: booking ? String(booking._id) : null,
      bookingReference: booking?.reference ?? '—',
      serviceName: booking?.snapshot?.serviceName ?? '—',
      dateKey: booking?.dateKey ?? '',
      lines: doc.lines,
      subtotalKobo: doc.subtotalKobo,
      discountKobo: doc.discountKobo,
      totalKobo: doc.totalKobo,
      issuedAt: doc.issuedAt.toISOString(),
    };
  });
}

export async function getPatientNotifications(userId: string) {
  await connectDB();

  const docs = await Notification.find({ recipient: userId, channel: 'in_app' })
    .sort({ createdAt: -1 })
    .limit(60)
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    subject: doc.subject,
    body: doc.body,
    template: doc.template,
    link: doc.link ?? null,
    readAt: doc.readAt ? doc.readAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  }));
}

export async function getPatientProfile(userId: string) {
  await connectDB();

  const [account, profile] = await Promise.all([
    User.findById(userId).select('name email phone avatar createdAt').lean(),
    PatientProfile.findOne({ user: userId }).lean(),
  ]);

  if (!account) return null;

  return {
    name: account.name,
    email: account.email,
    phone: account.phone ?? '',
    avatar: account.avatar ?? '',
    memberSince: account.createdAt.toISOString(),
    patientNumber: profile?.patientNumber ?? '—',
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : '',
    gender: profile?.gender ?? '',
    bloodGroup: profile?.bloodGroup ?? '',
    allergies: profile?.allergies ?? [],
    chronicConditions: profile?.chronicConditions ?? [],
    address: {
      street: profile?.address?.street ?? '',
      area: profile?.address?.area ?? '',
      city: profile?.address?.city ?? '',
      state: profile?.address?.state ?? '',
      landmark: profile?.address?.landmark ?? '',
    },
    emergencyContact: {
      name: profile?.emergencyContact?.name ?? '',
      relationship: profile?.emergencyContact?.relationship ?? '',
      phone: profile?.emergencyContact?.phone ?? '',
    },
    totalAppointments: profile?.totalAppointments ?? 0,
    totalSpentKobo: profile?.totalSpentKobo ?? 0,
  };
}

/** Percentage of the optional profile fields that are filled in. */
export function profileCompletion(profile: Awaited<ReturnType<typeof getPatientProfile>>): number {
  if (!profile) return 0;

  const checks = [
    Boolean(profile.name),
    Boolean(profile.email),
    Boolean(profile.phone),
    Boolean(profile.dateOfBirth),
    Boolean(profile.gender),
    Boolean(profile.address.street),
    Boolean(profile.address.city),
    Boolean(profile.bloodGroup),
    Boolean(profile.emergencyContact.name),
    Boolean(profile.emergencyContact.phone),
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export async function getPatientReviews(userId: string) {
  await connectDB();

  const docs = await Review.find({ patient: userId })
    .populate('service', 'name slug')
    .populate('booking', 'reference dateKey')
    .sort({ createdAt: -1 })
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    rating: doc.rating,
    comment: doc.comment,
    status: doc.status,
    response: doc.response ?? null,
    serviceName: (doc.service as unknown as { name?: string })?.name ?? '—',
    bookingReference: (doc.booking as unknown as { reference?: string })?.reference ?? '—',
    createdAt: doc.createdAt.toISOString(),
  }));
}

/** Completed bookings that have not yet been reviewed. */
export async function getReviewableBookings(userId: string) {
  await connectDB();

  const docs = await Booking.find({
    patient: userId,
    status: 'completed',
    hasReview: false,
  })
    .sort({ startAt: -1 })
    .limit(10)
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    reference: doc.reference,
    serviceName: doc.snapshot.serviceName,
    serviceId: String(doc.service),
    staffId: doc.staff ? String(doc.staff) : null,
    dateKey: doc.dateKey,
  }));
}

export async function getPatientTickets(userId: string) {
  await connectDB();

  const docs = await SupportTicket.find({ patient: userId }).sort({ updatedAt: -1 }).lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    reference: doc.reference,
    subject: doc.subject,
    status: doc.status,
    priority: doc.priority,
    messages: doc.messages.map((message) => ({
      authorName: message.authorName,
      isStaff: message.isStaff,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

/** Headline figures for the dashboard cards. */
export async function getPatientSummary(userId: string) {
  await connectDB();

  const now = new Date();

  const [upcoming, completed, pendingPayment, spendAgg] = await Promise.all([
    Booking.countDocuments({
      patient: userId,
      status: { $in: ['confirmed', 'in_progress'] },
      startAt: { $gte: now },
    }),
    Booking.countDocuments({ patient: userId, status: 'completed' }),
    Booking.countDocuments({ patient: userId, status: 'pending_payment' }),
    Payment.aggregate<{ total: number }>([
      { $match: { patient: (await import('mongoose')).Types.ObjectId.createFromHexString(userId), status: 'successful' } },
      { $group: { _id: null, total: { $sum: '$amountPaidKobo' } } },
    ]),
  ]);

  return {
    upcoming,
    completed,
    pendingPayment,
    totalSpentKobo: spendAgg[0]?.total ?? 0,
  };
}
