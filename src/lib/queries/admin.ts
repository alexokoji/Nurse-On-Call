import 'server-only';
import { connectDB } from '@/lib/db/connect';
import {
  AuditLog,
  Booking,
  HealthArticle,
  Invoice,
  Notification,
  PatientProfile,
  Payment,
  Refund,
  Review,
  Service,
  ServiceCategory,
  StaffProfile,
  SupportTicket,
  User,
} from '@/models';
import type {
  BookingStatus,
  LocationType,
  Paginated,
  PaymentStatus,
  RefundStatus,
  ReviewStatus,
  UserStatus,
} from '@/types';

/**
 * Admin read models.
 *
 * Every list is paginated *in the database* — `skip`/`limit` with a matching
 * `countDocuments`. Loading a whole collection into the browser is the single
 * fastest way to make an admin panel unusable at real data volumes, so no
 * query here returns an unbounded set.
 */

const DEFAULT_PAGE_SIZE = 15;

interface PageParams {
  page?: number;
  pageSize?: number;
}

function pagination({ page = 1, pageSize = DEFAULT_PAGE_SIZE }: PageParams) {
  const safePage = Math.max(1, Math.floor(page));
  const safeSize = Math.min(100, Math.max(5, Math.floor(pageSize)));
  return { page: safePage, pageSize: safeSize, skip: (safePage - 1) * safeSize };
}

function paginate<T>(data: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return {
    data,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Escape user input before it reaches a $regex, or `.*` becomes a scan. */
function escapeRegex(input: string) {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ── Appointments ─────────────────────────────────────────────────── */

export interface AdminBookingRow {
  id: string;
  reference: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  serviceName: string;
  serviceCategory: string | null;
  staffId: string | null;
  staffName: string | null;
  staffTitle: string | null;
  dateKey: string;
  startTime: string;
  locationType: LocationType;
  locationLabel: string;
  status: BookingStatus;
  totalKobo: number;
  isPaid: boolean;
}

export interface AdminBookingFilters extends PageParams {
  q?: string;
  status?: string;
  serviceId?: string;
  staffId?: string;
  from?: string;
  to?: string;
  patientId?: string;
}

export async function getAdminBookings(
  filters: AdminBookingFilters = {},
): Promise<Paginated<AdminBookingRow>> {
  await connectDB();

  const { page, pageSize, skip } = pagination(filters);
  const query: Record<string, unknown> = {};

  if (filters.status && filters.status !== 'all') query.status = filters.status;
  if (filters.serviceId) query.service = filters.serviceId;
  if (filters.staffId) query.staff = filters.staffId;
  if (filters.patientId) query.patient = filters.patientId;

  if (filters.from || filters.to) {
    const dateKey: Record<string, string> = {};
    if (filters.from) dateKey.$gte = filters.from;
    if (filters.to) dateKey.$lte = filters.to;
    query.dateKey = dateKey;
  }

  if (filters.q?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.q.trim()), 'i');
    query.$or = [
      { reference: pattern },
      { 'contact.name': pattern },
      { 'contact.phone': pattern },
      { 'contact.email': pattern },
      { 'snapshot.serviceName': pattern },
    ];
  }

  const [docs, total] = await Promise.all([
    Booking.find(query)
      .populate({ path: 'staff', select: 'user title', populate: { path: 'user', select: 'name' } })
      .populate({ path: 'service', select: 'category', populate: { path: 'category', select: 'name' } })
      .sort({ startAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Booking.countDocuments(query),
  ]);

  const rows: AdminBookingRow[] = docs.map((doc) => {
    const staff = doc.staff as unknown as
      | { _id: unknown; title?: string; user?: { name?: string } }
      | null;
    const service = doc.service as unknown as { category?: { name?: string } } | null;
    const address = doc.address as Record<string, string> | undefined;

    return {
      id: String(doc._id),
      reference: doc.reference,
      patientId: String(doc.patient),
      patientName: doc.contact.name,
      patientPhone: doc.contact.phone,
      serviceName: doc.snapshot.serviceName,
      serviceCategory: service?.category?.name ?? null,
      staffId: staff?._id ? String(staff._id) : null,
      staffName: staff?.user?.name ?? null,
      staffTitle: staff?.title ?? null,
      dateKey: doc.dateKey,
      startTime: doc.startTime,
      locationType: doc.locationType,
      locationLabel:
        doc.locationType === 'home'
          ? [address?.area, address?.city].filter(Boolean).join(', ') || 'Home visit'
          : doc.locationType === 'virtual'
            ? 'Online'
            : 'Main Clinic, Port Harcourt',
      status: doc.status,
      totalKobo: doc.totalKobo,
      isPaid: doc.isPaid,
    };
  });

  return paginate(rows, total, page, pageSize);
}

export async function getAdminBooking(bookingId: string) {
  await connectDB();

  const doc = await Booking.findById(bookingId)
    .populate({ path: 'staff', select: 'user title department', populate: { path: 'user', select: 'name email phone' } })
    .populate('service', 'name slug durationMinutes serviceType')
    .populate('patient', 'name email phone')
    .lean();

  if (!doc) return null;

  const [payments, invoice, review, profile] = await Promise.all([
    Payment.find({ booking: doc._id }).sort({ createdAt: -1 }).lean(),
    Invoice.findOne({ booking: doc._id }).lean(),
    Review.findOne({ booking: doc._id }).lean(),
    PatientProfile.findOne({ user: doc.patient }).select('patientNumber').lean(),
  ]);

  const staff = doc.staff as unknown as
    | { _id: unknown; title?: string; department?: string; user?: { name?: string; phone?: string } }
    | null;
  const service = doc.service as unknown as { _id: unknown; name: string; serviceType: string };
  const address = doc.address as Record<string, string> | undefined;

  return {
    id: String(doc._id),
    reference: doc.reference,
    status: doc.status as BookingStatus,
    dateKey: doc.dateKey,
    startTime: doc.startTime,
    endTime: doc.endTime,
    locationType: doc.locationType as LocationType,
    address: address
      ? [address.street, address.area, address.city, address.state].filter(Boolean).join(', ')
      : null,
    landmark: address?.landmark ?? null,
    notes: doc.notes ?? null,
    cancellationReason: doc.cancellationReason ?? null,

    serviceId: String(service._id),
    serviceName: service.name,
    serviceType: service.serviceType,

    patientId: String(doc.patient),
    patientNumber: profile?.patientNumber ?? '—',
    contact: {
      name: doc.contact.name,
      phone: doc.contact.phone,
      email: doc.contact.email,
    },
    emergencyContact: doc.emergencyContact ?? null,

    staffId: staff?._id ? String(staff._id) : null,
    staffName: staff?.user?.name ?? null,
    staffTitle: staff?.title ?? null,

    servicePriceKobo: doc.servicePriceKobo,
    surchargeKobo: doc.surchargeKobo,
    discountKobo: doc.discountKobo,
    totalKobo: doc.totalKobo,
    isPaid: doc.isPaid,
    promotionCode: doc.promotionCode ?? null,

    createdAt: doc.createdAt.toISOString(),

    payments: payments.map((payment) => ({
      id: String(payment._id),
      reference: payment.reference,
      status: payment.status as PaymentStatus,
      provider: payment.provider,
      amountKobo: payment.amountKobo,
      amountPaidKobo: payment.amountPaidKobo,
      refundedKobo: payment.refundedKobo,
      channel: payment.channel ?? null,
      paidAt: payment.paidAt ? payment.paidAt.toISOString() : null,
      createdAt: payment.createdAt.toISOString(),
    })),
    invoiceNumber: invoice?.number ?? null,
    review: review
      ? { rating: review.rating, comment: review.comment, status: review.status as ReviewStatus }
      : null,
  };
}

/* ── Patients ─────────────────────────────────────────────────────── */

export interface AdminPatientRow {
  id: string;
  patientNumber: string;
  name: string;
  email: string;
  phone: string;
  status: UserStatus;
  totalAppointments: number;
  totalSpentKobo: number;
  lastAppointmentAt: string | null;
  createdAt: string;
}

export async function getAdminPatients(
  filters: PageParams & { q?: string; status?: string } = {},
): Promise<Paginated<AdminPatientRow>> {
  await connectDB();

  const { page, pageSize, skip } = pagination(filters);
  const query: Record<string, unknown> = { role: 'patient' };

  if (filters.status && filters.status !== 'all') query.status = filters.status;

  if (filters.q?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.q.trim()), 'i');
    query.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }

  const [users, total] = await Promise.all([
    User.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    User.countDocuments(query),
  ]);

  // One extra query for the whole page beats N queries per row.
  const profiles = await PatientProfile.find({ user: { $in: users.map((u) => u._id) } }).lean();
  const byUser = new Map(profiles.map((profile) => [String(profile.user), profile]));

  const rows: AdminPatientRow[] = users.map((user) => {
    const profile = byUser.get(String(user._id));
    return {
      id: String(user._id),
      patientNumber: profile?.patientNumber ?? '—',
      name: user.name,
      email: user.email,
      phone: user.phone ?? '—',
      status: user.status,
      totalAppointments: profile?.totalAppointments ?? 0,
      totalSpentKobo: profile?.totalSpentKobo ?? 0,
      lastAppointmentAt: profile?.lastAppointmentAt
        ? profile.lastAppointmentAt.toISOString()
        : null,
      createdAt: user.createdAt.toISOString(),
    };
  });

  return paginate(rows, total, page, pageSize);
}

export async function getPatientStats() {
  await connectDB();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [total, active, recent] = await Promise.all([
    User.countDocuments({ role: 'patient' }),
    User.countDocuments({ role: 'patient', status: 'active' }),
    User.countDocuments({ role: 'patient', createdAt: { $gte: thirtyDaysAgo } }),
  ]);

  return { total, active, recent };
}

export async function getAdminPatient(patientId: string) {
  await connectDB();

  const [user, profile] = await Promise.all([
    User.findOne({ _id: patientId, role: 'patient' }).lean(),
    PatientProfile.findOne({ user: patientId }).lean(),
  ]);

  if (!user) return null;

  const [bookings, payments, reviews, tickets] = await Promise.all([
    Booking.find({ patient: patientId }).sort({ startAt: -1 }).limit(25).lean(),
    Payment.find({ patient: patientId }).sort({ createdAt: -1 }).limit(25).lean(),
    Review.find({ patient: patientId }).populate('service', 'name').sort({ createdAt: -1 }).lean(),
    SupportTicket.find({ patient: patientId }).sort({ updatedAt: -1 }).lean(),
  ]);

  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone ?? '—',
    status: user.status as UserStatus,
    emailVerified: Boolean(user.emailVerifiedAt),
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    createdAt: user.createdAt.toISOString(),

    patientNumber: profile?.patientNumber ?? '—',
    dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString() : null,
    gender: profile?.gender ?? null,
    bloodGroup: profile?.bloodGroup ?? null,
    allergies: profile?.allergies ?? [],
    chronicConditions: profile?.chronicConditions ?? [],
    address: profile?.address ?? null,
    emergencyContact: profile?.emergencyContact ?? null,
    notes: profile?.notes ?? '',
    totalAppointments: profile?.totalAppointments ?? 0,
    totalSpentKobo: profile?.totalSpentKobo ?? 0,

    bookings: bookings.map((booking) => ({
      id: String(booking._id),
      reference: booking.reference,
      serviceName: booking.snapshot.serviceName,
      dateKey: booking.dateKey,
      startTime: booking.startTime,
      status: booking.status as BookingStatus,
      totalKobo: booking.totalKobo,
    })),
    payments: payments.map((payment) => ({
      id: String(payment._id),
      reference: payment.reference,
      status: payment.status as PaymentStatus,
      amountKobo: payment.amountKobo,
      provider: payment.provider,
      createdAt: payment.createdAt.toISOString(),
    })),
    reviews: reviews.map((review) => ({
      id: String(review._id),
      rating: review.rating,
      comment: review.comment,
      status: review.status as ReviewStatus,
      serviceName: (review.service as unknown as { name?: string })?.name ?? '—',
      createdAt: review.createdAt.toISOString(),
    })),
    tickets: tickets.map((ticket) => ({
      id: String(ticket._id),
      reference: ticket.reference,
      subject: ticket.subject,
      status: ticket.status,
      updatedAt: ticket.updatedAt.toISOString(),
    })),
  };
}

/* ── Services ─────────────────────────────────────────────────────── */

export async function getAdminServices(
  filters: PageParams & { q?: string; status?: string; categoryId?: string } = {},
) {
  await connectDB();

  const { page, pageSize, skip } = pagination({ ...filters, pageSize: filters.pageSize ?? 20 });
  const query: Record<string, unknown> = {};

  if (filters.status && filters.status !== 'all') query.status = filters.status;
  if (filters.categoryId) query.category = filters.categoryId;
  if (filters.q?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.q.trim()), 'i');
    query.$or = [{ name: pattern }, { slug: pattern }, { shortDescription: pattern }];
  }

  const [docs, total] = await Promise.all([
    Service.find(query)
      .populate('category', 'name slug accent')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Service.countDocuments(query),
  ]);

  const rows = docs.map((doc) => {
    const category = doc.category as unknown as { _id?: unknown; name?: string; accent?: string } | null;
    return {
      id: String(doc._id),
      name: doc.name,
      slug: doc.slug,
      icon: doc.icon,
      categoryId: category?._id ? String(category._id) : null,
      categoryName: category?.name ?? '—',
      accent: category?.accent ?? 'teal',
      priceKobo: doc.priceKobo,
      homeVisitSurchargeKobo: doc.homeVisitSurchargeKobo,
      durationMinutes: doc.durationMinutes,
      serviceType: doc.serviceType,
      status: doc.status,
      isFeatured: doc.isFeatured,
      bookingCount: doc.bookingCount,
      averageRating: doc.averageRating,
      reviewCount: doc.reviewCount,
    };
  });

  return paginate(rows, total, page, pageSize);
}

export async function getServiceForEdit(serviceId: string) {
  await connectDB();
  const doc = await Service.findById(serviceId).lean();
  if (!doc) return null;

  return {
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    categoryId: String(doc.category),
    shortDescription: doc.shortDescription,
    description: doc.description,
    image: doc.image ?? '',
    icon: doc.icon ?? 'stethoscope',
    price: doc.priceKobo / 100,
    homeVisitSurcharge: doc.homeVisitSurchargeKobo / 100,
    durationMinutes: doc.durationMinutes,
    bufferMinutes: doc.bufferMinutes,
    serviceType: doc.serviceType,
    whatsIncluded: doc.whatsIncluded ?? [],
    requirements: doc.requirements ?? [],
    preparation: doc.preparation ?? [],
    faqs: doc.faqs ?? [],
    status: doc.status,
    isFeatured: doc.isFeatured,
    seoTitle: doc.seo?.title ?? '',
    seoDescription: doc.seo?.description ?? '',
  };
}

export async function getCategories() {
  await connectDB();
  const docs = await ServiceCategory.find({}).sort({ sortOrder: 1, name: 1 }).lean();
  return docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    slug: doc.slug,
    description: doc.description ?? '',
    icon: doc.icon,
    accent: doc.accent,
    sortOrder: doc.sortOrder,
    isActive: doc.isActive,
  }));
}

/* ── Staff ────────────────────────────────────────────────────────── */

export async function getAdminStaff(
  filters: PageParams & { q?: string; department?: string; active?: string } = {},
) {
  await connectDB();

  const { page, pageSize, skip } = pagination({ ...filters, pageSize: filters.pageSize ?? 20 });
  const query: Record<string, unknown> = {};

  if (filters.department && filters.department !== 'all') query.department = filters.department;
  if (filters.active === 'active') query.isActive = true;
  if (filters.active === 'inactive') query.isActive = false;

  const [docs, total] = await Promise.all([
    StaffProfile.find(query)
      .populate('user', 'name email phone status avatar')
      .populate('services', 'name slug')
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    StaffProfile.countDocuments(query),
  ]);

  /* Upcoming appointment counts for the whole page in one aggregation. */
  const counts = await Booking.aggregate<{ _id: unknown; count: number }>([
    {
      $match: {
        staff: { $in: docs.map((doc) => doc._id) },
        status: { $in: ['confirmed', 'in_progress'] },
        startAt: { $gte: new Date() },
      },
    },
    { $group: { _id: '$staff', count: { $sum: 1 } } },
  ]);
  const upcomingByStaff = new Map(counts.map((row) => [String(row._id), row.count]));

  let rows = docs.map((doc) => {
    const user = doc.user as unknown as {
      name?: string;
      email?: string;
      phone?: string;
      avatar?: string;
    } | null;

    return {
      id: String(doc._id),
      staffNumber: doc.staffNumber,
      name: user?.name ?? 'Unknown',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      avatar: user?.avatar ?? '',
      title: doc.title,
      department: doc.department,
      services: (doc.services as unknown as { name: string; slug: string }[] | undefined) ?? [],
      isActive: doc.isActive,
      averageRating: doc.averageRating,
      reviewCount: doc.reviewCount,
      upcomingAppointments: upcomingByStaff.get(String(doc._id)) ?? 0,
      workingDays: (doc.workingHours ?? []).filter((day) => day.enabled).length,
    };
  });

  // Name lives on the joined User, so text search is applied after the join.
  if (filters.q?.trim()) {
    const needle = filters.q.trim().toLowerCase();
    rows = rows.filter(
      (row) =>
        row.name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle) ||
        row.staffNumber.toLowerCase().includes(needle),
    );
  }

  return paginate(rows, filters.q?.trim() ? rows.length : total, page, pageSize);
}

export async function getStaffMember(staffId: string) {
  await connectDB();

  const doc = await StaffProfile.findById(staffId)
    .populate('user', 'name email phone status avatar createdAt')
    .populate('services', 'name slug priceKobo durationMinutes')
    .lean();

  if (!doc) return null;

  const user = doc.user as unknown as {
    _id: unknown;
    name?: string;
    email?: string;
    phone?: string;
    status?: string;
    avatar?: string;
    createdAt?: Date;
  } | null;

  const [upcoming, history, blocks] = await Promise.all([
    Booking.find({
      staff: doc._id,
      status: { $in: ['confirmed', 'in_progress'] },
      startAt: { $gte: new Date() },
    })
      .sort({ startAt: 1 })
      .limit(15)
      .lean(),

    Booking.find({ staff: doc._id, status: { $in: ['completed', 'cancelled', 'no_show'] } })
      .sort({ startAt: -1 })
      .limit(15)
      .lean(),

    (await import('@/models')).BlockedSchedule.find({ staff: doc._id })
      .sort({ startDateKey: -1 })
      .limit(20)
      .lean(),
  ]);

  const toRow = (booking: (typeof upcoming)[number]) => ({
    id: String(booking._id),
    reference: booking.reference,
    serviceName: booking.snapshot.serviceName,
    patientName: booking.contact.name,
    dateKey: booking.dateKey,
    startTime: booking.startTime,
    status: booking.status as BookingStatus,
    totalKobo: booking.totalKobo,
  });

  return {
    id: String(doc._id),
    userId: user?._id ? String(user._id) : '',
    staffNumber: doc.staffNumber,
    name: user?.name ?? 'Unknown',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    avatar: user?.avatar ?? '',
    accountStatus: (user?.status ?? 'active') as UserStatus,
    joinedAt: user?.createdAt ? user.createdAt.toISOString() : null,

    title: doc.title,
    department: doc.department,
    bio: doc.bio ?? '',
    qualifications: doc.qualifications ?? [],
    specialisations: doc.specialisations ?? [],
    licenceNumber: doc.licenceNumber ?? '',
    yearsOfExperience: doc.yearsOfExperience ?? 0,
    isActive: doc.isActive,
    isPubliclyVisible: doc.isPubliclyVisible,
    maxConcurrentAppointments: doc.maxConcurrentAppointments,
    averageRating: doc.averageRating,
    reviewCount: doc.reviewCount,

    services: (doc.services as unknown as {
      _id: unknown;
      name: string;
      slug: string;
      priceKobo: number;
      durationMinutes: number;
    }[]).map((service) => ({
      id: String(service._id),
      name: service.name,
      slug: service.slug,
      priceKobo: service.priceKobo,
      durationMinutes: service.durationMinutes,
    })),

    workingHours: doc.workingHours ?? [],

    upcoming: upcoming.map(toRow),
    history: history.map(toRow),

    blocks: blocks.map((block) => ({
      id: String(block._id),
      type: block.type,
      startDateKey: block.startDateKey,
      endDateKey: block.endDateKey,
      startTime: block.startTime ?? null,
      endTime: block.endTime ?? null,
      reason: block.reason ?? '',
    })),
  };
}

/** Staff eligible to deliver a service — used by the assign-staff dialog. */
export async function getStaffForService(serviceId: string) {
  await connectDB();

  const docs = await StaffProfile.find({ isActive: true, services: serviceId })
    .populate('user', 'name')
    .select('user title department')
    .lean();

  return docs.map((doc) => ({
    id: String(doc._id),
    name: (doc.user as unknown as { name?: string })?.name ?? 'Unknown',
    title: doc.title,
    department: doc.department,
  }));
}

/* ── Payments & refunds ───────────────────────────────────────────── */

export async function getAdminPayments(
  filters: PageParams & {
    q?: string;
    status?: string;
    provider?: string;
    from?: string;
    to?: string;
  } = {},
) {
  await connectDB();

  const { page, pageSize, skip } = pagination(filters);
  const query: Record<string, unknown> = {};

  if (filters.status && filters.status !== 'all') query.status = filters.status;
  if (filters.provider && filters.provider !== 'all') query.provider = filters.provider;

  if (filters.from || filters.to) {
    const createdAt: Record<string, Date> = {};
    if (filters.from) createdAt.$gte = new Date(filters.from);
    if (filters.to) createdAt.$lte = new Date(`${filters.to}T23:59:59.999Z`);
    query.createdAt = createdAt;
  }

  if (filters.q?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.q.trim()), 'i');
    query.$or = [{ reference: pattern }, { providerReference: pattern }];
  }

  const [docs, total] = await Promise.all([
    Payment.find(query)
      .populate('booking', 'reference snapshot contact')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Payment.countDocuments(query),
  ]);

  const rows = docs.map((doc) => {
    const booking = doc.booking as unknown as {
      _id?: unknown;
      reference?: string;
      snapshot?: { serviceName?: string };
      contact?: { name?: string };
    } | null;

    return {
      id: String(doc._id),
      reference: doc.reference,
      providerReference: doc.providerReference ?? null,
      bookingId: booking?._id ? String(booking._id) : null,
      bookingReference: booking?.reference ?? '—',
      patientName: booking?.contact?.name ?? '—',
      serviceName: booking?.snapshot?.serviceName ?? '—',
      amountKobo: doc.amountKobo,
      amountPaidKobo: doc.amountPaidKobo,
      refundedKobo: doc.refundedKobo,
      status: doc.status as PaymentStatus,
      provider: doc.provider,
      channel: doc.channel ?? null,
      paidAt: doc.paidAt ? doc.paidAt.toISOString() : null,
      createdAt: doc.createdAt.toISOString(),
      webhookVerified: Boolean(doc.webhookVerifiedAt),
    };
  });

  return paginate(rows, total, page, pageSize);
}

export async function getPaymentStats() {
  await connectDB();

  const [agg, refunded] = await Promise.all([
    Payment.aggregate<{ _id: string; count: number; total: number }>([
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amountPaidKobo' } } },
    ]),
    Refund.aggregate<{ total: number }>([
      { $match: { status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$amountKobo' } } },
    ]),
  ]);

  const byStatus = new Map(agg.map((row) => [row._id, row]));

  return {
    revenueKobo:
      (byStatus.get('successful')?.total ?? 0) + (byStatus.get('partially_refunded')?.total ?? 0),
    successful: byStatus.get('successful')?.count ?? 0,
    pending: byStatus.get('pending')?.count ?? 0,
    failed: byStatus.get('failed')?.count ?? 0,
    refundedKobo: refunded[0]?.total ?? 0,
  };
}

export async function getAdminRefunds(filters: PageParams & { status?: string } = {}) {
  await connectDB();

  const { page, pageSize, skip } = pagination(filters);
  const query: Record<string, unknown> = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;

  const [docs, total] = await Promise.all([
    Refund.find(query)
      .populate('payment', 'reference provider amountPaidKobo refundedKobo')
      .populate('booking', 'reference snapshot contact')
      .populate('requestedBy', 'name')
      .populate('reviewedBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Refund.countDocuments(query),
  ]);

  const rows = docs.map((doc) => {
    const payment = doc.payment as unknown as {
      reference?: string;
      provider?: string;
      amountPaidKobo?: number;
      refundedKobo?: number;
    } | null;
    const booking = doc.booking as unknown as {
      _id?: unknown;
      reference?: string;
      snapshot?: { serviceName?: string };
      contact?: { name?: string };
    } | null;

    return {
      id: String(doc._id),
      reference: doc.reference,
      amountKobo: doc.amountKobo,
      reason: doc.reason,
      status: doc.status as RefundStatus,
      paymentReference: payment?.reference ?? '—',
      provider: payment?.provider ?? '—',
      paidKobo: payment?.amountPaidKobo ?? 0,
      alreadyRefundedKobo: payment?.refundedKobo ?? 0,
      bookingId: booking?._id ? String(booking._id) : null,
      bookingReference: booking?.reference ?? '—',
      serviceName: booking?.snapshot?.serviceName ?? '—',
      patientName: booking?.contact?.name ?? '—',
      requestedBy: (doc.requestedBy as unknown as { name?: string })?.name ?? 'System',
      reviewedBy: (doc.reviewedBy as unknown as { name?: string })?.name ?? null,
      reviewNote: doc.reviewNote ?? null,
      createdAt: doc.createdAt.toISOString(),
      processedAt: doc.processedAt ? doc.processedAt.toISOString() : null,
    };
  });

  return paginate(rows, total, page, pageSize);
}

/* ── Reviews ──────────────────────────────────────────────────────── */

export async function getAdminReviews(filters: PageParams & { status?: string } = {}) {
  await connectDB();

  const { page, pageSize, skip } = pagination(filters);
  const query: Record<string, unknown> = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;

  const [docs, total] = await Promise.all([
    Review.find(query)
      .populate('patient', 'name email')
      .populate('service', 'name')
      .populate({ path: 'staff', select: 'user', populate: { path: 'user', select: 'name' } })
      .populate('booking', 'reference dateKey')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Review.countDocuments(query),
  ]);

  const rows = docs.map((doc) => ({
    id: String(doc._id),
    rating: doc.rating,
    comment: doc.comment,
    status: doc.status as ReviewStatus,
    response: doc.response ?? null,
    patientName: (doc.patient as unknown as { name?: string })?.name ?? '—',
    serviceName: (doc.service as unknown as { name?: string })?.name ?? '—',
    staffName:
      (doc.staff as unknown as { user?: { name?: string } })?.user?.name ?? null,
    bookingReference: (doc.booking as unknown as { reference?: string })?.reference ?? '—',
    createdAt: doc.createdAt.toISOString(),
  }));

  return paginate(rows, total, page, pageSize);
}

export async function getReviewStats() {
  await connectDB();
  const rows = await Review.aggregate<{ _id: string; count: number; avg: number }>([
    { $group: { _id: '$status', count: { $sum: 1 }, avg: { $avg: '$rating' } } },
  ]);

  const byStatus = new Map(rows.map((row) => [row._id, row]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const weighted = rows.reduce((sum, row) => sum + row.avg * row.count, 0);

  return {
    total,
    pending: byStatus.get('pending')?.count ?? 0,
    approved: byStatus.get('approved')?.count ?? 0,
    hidden: byStatus.get('hidden')?.count ?? 0,
    averageRating: total > 0 ? weighted / total : 0,
  };
}

/* ── Notifications, tickets, content, audit ───────────────────────── */

export async function getNotificationHistory(filters: PageParams & { channel?: string } = {}) {
  await connectDB();

  const { page, pageSize, skip } = pagination(filters);
  const query: Record<string, unknown> = {};
  if (filters.channel && filters.channel !== 'all') query.channel = filters.channel;

  const [docs, total] = await Promise.all([
    Notification.find(query)
      .populate('recipient', 'name email')
      .populate('sentBy', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    Notification.countDocuments(query),
  ]);

  const rows = docs.map((doc) => ({
    id: String(doc._id),
    channel: doc.channel,
    template: doc.template,
    subject: doc.subject,
    body: doc.body,
    status: doc.status,
    recipientName: (doc.recipient as unknown as { name?: string })?.name ?? doc.recipientEmail ?? '—',
    sentBy: (doc.sentBy as unknown as { name?: string })?.name ?? 'System',
    batchId: doc.batchId ?? null,
    failureReason: doc.failureReason ?? null,
    createdAt: doc.createdAt.toISOString(),
  }));

  return paginate(rows, total, page, pageSize);
}

export async function getAdminTickets(filters: PageParams & { status?: string } = {}) {
  await connectDB();

  const { page, pageSize, skip } = pagination(filters);
  const query: Record<string, unknown> = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;

  const [docs, total] = await Promise.all([
    SupportTicket.find(query)
      .populate('patient', 'name email')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(pageSize)
      .lean(),
    SupportTicket.countDocuments(query),
  ]);

  const rows = docs.map((doc) => ({
    id: String(doc._id),
    reference: doc.reference,
    subject: doc.subject,
    status: doc.status,
    priority: doc.priority,
    patientId: String(doc.patient),
    patientName: (doc.patient as unknown as { name?: string })?.name ?? '—',
    patientEmail: (doc.patient as unknown as { email?: string })?.email ?? '',
    messages: doc.messages.map((message) => ({
      authorName: message.authorName,
      isStaff: message.isStaff,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    })),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  }));

  return paginate(rows, total, page, pageSize);
}

export async function getAdminArticles(filters: PageParams & { status?: string } = {}) {
  await connectDB();

  const { page, pageSize, skip } = pagination({ ...filters, pageSize: filters.pageSize ?? 20 });
  const query: Record<string, unknown> = {};
  if (filters.status && filters.status !== 'all') query.status = filters.status;

  const [docs, total] = await Promise.all([
    HealthArticle.find(query).sort({ updatedAt: -1 }).skip(skip).limit(pageSize).lean(),
    HealthArticle.countDocuments(query),
  ]);

  const rows = docs.map((doc) => ({
    id: String(doc._id),
    title: doc.title,
    slug: doc.slug,
    category: doc.category,
    status: doc.status,
    authorName: doc.authorName,
    readMinutes: doc.readMinutes,
    viewCount: doc.viewCount,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    updatedAt: doc.updatedAt.toISOString(),
  }));

  return paginate(rows, total, page, pageSize);
}

export async function getAuditLogs(
  filters: PageParams & { q?: string; entity?: string; action?: string } = {},
) {
  await connectDB();

  const { page, pageSize, skip } = pagination({ ...filters, pageSize: filters.pageSize ?? 25 });
  const query: Record<string, unknown> = {};

  if (filters.entity && filters.entity !== 'all') query.entity = filters.entity;
  if (filters.action && filters.action !== 'all') query.action = filters.action;
  if (filters.q?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.q.trim()), 'i');
    query.$or = [{ summary: pattern }, { actorName: pattern }, { entityId: pattern }];
  }

  const [docs, total] = await Promise.all([
    AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(pageSize).lean(),
    AuditLog.countDocuments(query),
  ]);

  const rows = docs.map((doc) => ({
    id: String(doc._id),
    actorName: doc.actorName,
    actorRole: doc.actorRole,
    action: doc.action,
    entity: doc.entity,
    entityId: doc.entityId ?? null,
    summary: doc.summary,
    before: doc.before ?? null,
    after: doc.after ?? null,
    ipAddress: doc.ipAddress ?? null,
    createdAt: doc.createdAt.toISOString(),
  }));

  return paginate(rows, total, page, pageSize);
}

/** Distinct entities/actions, for the audit-log filter dropdowns. */
export async function getAuditFilterOptions() {
  await connectDB();
  const [entities, actions] = await Promise.all([
    AuditLog.distinct('entity'),
    AuditLog.distinct('action'),
  ]);
  return { entities: entities.sort(), actions: actions.sort() };
}

/* ── Admin users & roles ──────────────────────────────────────────── */

export async function getAdminUsers(filters: PageParams & { q?: string; role?: string } = {}) {
  await connectDB();

  const { page, pageSize, skip } = pagination({ ...filters, pageSize: filters.pageSize ?? 20 });
  const query: Record<string, unknown> = {
    role: { $in: ['super_admin', 'admin', 'operations_manager', 'finance', 'staff'] },
  };

  if (filters.role && filters.role !== 'all') query.role = filters.role;
  if (filters.q?.trim()) {
    const pattern = new RegExp(escapeRegex(filters.q.trim()), 'i');
    query.$or = [{ name: pattern }, { email: pattern }];
  }

  const [docs, total] = await Promise.all([
    User.find(query).sort({ createdAt: 1 }).skip(skip).limit(pageSize).lean(),
    User.countDocuments(query),
  ]);

  const rows = docs.map((doc) => ({
    id: String(doc._id),
    name: doc.name,
    email: doc.email,
    phone: doc.phone ?? '—',
    role: doc.role,
    status: doc.status as UserStatus,
    lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
  }));

  return paginate(rows, total, page, pageSize);
}

export async function getRoles() {
  await connectDB();
  const { Role } = await import('@/models');
  const docs = await Role.find({}).sort({ key: 1 }).lean();

  const counts = await User.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$role', count: { $sum: 1 } } },
  ]);
  const byRole = new Map(counts.map((row) => [row._id, row.count]));

  return docs.map((doc) => ({
    id: String(doc._id),
    key: doc.key,
    name: doc.name,
    description: doc.description ?? '',
    permissions: doc.permissions,
    isSystem: doc.isSystem,
    userCount: byRole.get(doc.key) ?? 0,
  }));
}
