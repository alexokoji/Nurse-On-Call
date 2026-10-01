import 'server-only';
import { connectDB } from '@/lib/db/connect';
import { Booking, Payment, Service, StaffProfile, User, Refund } from '@/models';
import { percentChange, toDateKey } from '@/lib/utils';
import { subDays, subMonths, eachDayOfInterval, format, startOfDay, endOfDay } from 'date-fns';

/**
 * Every figure on the admin dashboard is aggregated here from the database.
 * Nothing is hard-coded — if the collections are empty the dashboard shows
 * zeroes and its empty states, which is the honest result.
 */

export interface KpiCard {
  label: string;
  value: number;
  /** Percentage change against the comparison period. */
  change: number;
  comparison: string;
  /** Small series for the sparkline. */
  trend: { x: string; y: number }[];
  format: 'number' | 'currency';
}

const LIVE_STATUSES = ['pending_payment', 'confirmed', 'in_progress'];

export async function getDashboardKpis(): Promise<KpiCard[]> {
  await connectDB();

  const now = new Date();
  const last30Start = startOfDay(subDays(now, 29));
  const prev30Start = startOfDay(subDays(now, 59));
  const prev30End = endOfDay(subDays(now, 30));

  const [
    totalAppointments,
    appointments30,
    appointmentsPrev30,
    totalPatients,
    patients30,
    patientsPrev30,
    revenueAll,
    revenue30,
    revenuePrev30,
    pendingAppointments,
    pendingPrev,
    activeStaff,
    appointmentTrend,
    revenueTrend,
    patientTrend,
  ] = await Promise.all([
    Booking.countDocuments({}),
    Booking.countDocuments({ createdAt: { $gte: last30Start } }),
    Booking.countDocuments({ createdAt: { $gte: prev30Start, $lte: prev30End } }),

    User.countDocuments({ role: 'patient' }),
    User.countDocuments({ role: 'patient', createdAt: { $gte: last30Start } }),
    User.countDocuments({ role: 'patient', createdAt: { $gte: prev30Start, $lte: prev30End } }),

    sumPayments({}),
    sumPayments({ paidAt: { $gte: last30Start } }),
    sumPayments({ paidAt: { $gte: prev30Start, $lte: prev30End } }),

    Booking.countDocuments({ status: 'pending_payment' }),
    Booking.countDocuments({
      status: 'pending_payment',
      createdAt: { $gte: prev30Start, $lte: prev30End },
    }),

    StaffProfile.countDocuments({ isActive: true }),

    dailySeries('bookings', 14),
    dailySeries('revenue', 14),
    dailySeries('patients', 14),
  ]);

  return [
    {
      label: 'Total Appointments',
      value: totalAppointments,
      change: percentChange(appointments30, appointmentsPrev30),
      comparison: 'from last 30 days',
      trend: appointmentTrend,
      format: 'number',
    },
    {
      label: 'Total Patients',
      value: totalPatients,
      change: percentChange(patients30, patientsPrev30),
      comparison: 'from last month',
      trend: patientTrend,
      format: 'number',
    },
    {
      label: 'Total Revenue',
      value: revenueAll,
      change: percentChange(revenue30, revenuePrev30),
      comparison: 'from last month',
      trend: revenueTrend,
      format: 'currency',
    },
    {
      label: 'Pending Appointments',
      value: pendingAppointments,
      change: percentChange(pendingAppointments, pendingPrev),
      comparison: 'awaiting payment',
      trend: appointmentTrend,
      format: 'number',
    },
    {
      label: 'Active Staff',
      value: activeStaff,
      change: 0,
      comparison: 'currently on duty',
      trend: [],
      format: 'number',
    },
  ];
}

async function sumPayments(match: Record<string, unknown>): Promise<number> {
  const result = await Payment.aggregate<{ total: number }>([
    { $match: { status: { $in: ['successful', 'partially_refunded'] }, ...match } },
    { $group: { _id: null, total: { $sum: '$amountPaidKobo' } } },
  ]);
  return result[0]?.total ?? 0;
}

/** Daily counts for the sparklines. */
async function dailySeries(
  metric: 'bookings' | 'revenue' | 'patients',
  days: number,
): Promise<{ x: string; y: number }[]> {
  const start = startOfDay(subDays(new Date(), days - 1));

  const pipeline =
    metric === 'revenue'
      ? [
          { $match: { status: 'successful', paidAt: { $gte: start } } },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$paidAt' } },
              value: { $sum: '$amountPaidKobo' },
            },
          },
        ]
      : [
          {
            $match:
              metric === 'patients'
                ? { role: 'patient', createdAt: { $gte: start } }
                : { createdAt: { $gte: start } },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              value: { $sum: 1 },
            },
          },
        ];

  const model = metric === 'revenue' ? Payment : metric === 'patients' ? User : Booking;
  const rows = await model.aggregate<{ _id: string; value: number }>(pipeline as never);
  const byDay = new Map(rows.map((row) => [row._id, row.value]));

  // Fill gaps so the sparkline has a point for every day, not just busy ones.
  return eachDayOfInterval({ start, end: new Date() }).map((day) => {
    const key = toDateKey(day);
    return { x: key, y: byDay.get(key) ?? 0 };
  });
}

/* ── Appointments overview chart ──────────────────────────────────── */

export type ChartRange = 'today' | 'week' | 'month' | 'year';

export interface AppointmentChartPoint {
  label: string;
  completed: number;
  pending: number;
  cancelled: number;
}

export async function getAppointmentChart(
  range: ChartRange = 'week',
): Promise<AppointmentChartPoint[]> {
  await connectDB();

  const now = new Date();
  const { start, buckets, groupFormat, labelOf } = chartWindow(range, now);

  const rows = await Booking.aggregate<{
    _id: { bucket: string; status: string };
    count: number;
  }>([
    { $match: { startAt: { $gte: start, $lte: now > start ? endOfDay(now) : now } } },
    {
      $group: {
        _id: {
          bucket: { $dateToString: { format: groupFormat, date: '$startAt' } },
          status: '$status',
        },
        count: { $sum: 1 },
      },
    },
  ]);

  const table = new Map<string, AppointmentChartPoint>();
  for (const bucket of buckets) {
    table.set(bucket, { label: labelOf(bucket), completed: 0, pending: 0, cancelled: 0 });
  }

  for (const row of rows) {
    const point = table.get(row._id.bucket);
    if (!point) continue;

    if (row._id.status === 'completed') point.completed += row.count;
    else if (LIVE_STATUSES.includes(row._id.status)) point.pending += row.count;
    else if (['cancelled', 'no_show', 'expired'].includes(row._id.status)) {
      point.cancelled += row.count;
    }
  }

  return [...table.values()];
}

function chartWindow(range: ChartRange, now: Date) {
  switch (range) {
    case 'today': {
      const start = startOfDay(now);
      const buckets = Array.from({ length: 24 }, (_, hour) =>
        `${toDateKey(now)} ${String(hour).padStart(2, '0')}`,
      );
      return {
        start,
        buckets,
        groupFormat: '%Y-%m-%d %H',
        labelOf: (bucket: string) => `${bucket.slice(-2)}:00`,
      };
    }

    case 'month': {
      const start = startOfDay(subDays(now, 29));
      const buckets = eachDayOfInterval({ start, end: now }).map(toDateKey);
      return {
        start,
        buckets,
        groupFormat: '%Y-%m-%d',
        labelOf: (bucket: string) => format(new Date(bucket), 'd MMM'),
      };
    }

    case 'year': {
      const start = startOfDay(subMonths(now, 11));
      const buckets = Array.from({ length: 12 }, (_, i) =>
        format(subMonths(now, 11 - i), 'yyyy-MM'),
      );
      return {
        start,
        buckets,
        groupFormat: '%Y-%m',
        labelOf: (bucket: string) => format(new Date(`${bucket}-01`), 'MMM'),
      };
    }

    case 'week':
    default: {
      const start = startOfDay(subDays(now, 6));
      const buckets = eachDayOfInterval({ start, end: now }).map(toDateKey);
      return {
        start,
        buckets,
        groupFormat: '%Y-%m-%d',
        labelOf: (bucket: string) => format(new Date(bucket), 'EEE'),
      };
    }
  }
}

/* ── Revenue ──────────────────────────────────────────────────────── */

export async function getRevenueOverview() {
  await connectDB();

  const now = new Date();
  const monthStart = startOfDay(subDays(now, 29));
  const prevMonthStart = startOfDay(subDays(now, 59));
  const prevMonthEnd = endOfDay(subDays(now, 30));

  const [total, thisMonth, lastMonth, byService, byMonth] = await Promise.all([
    sumPayments({}),
    sumPayments({ paidAt: { $gte: monthStart } }),
    sumPayments({ paidAt: { $gte: prevMonthStart, $lte: prevMonthEnd } }),

    Payment.aggregate<{ _id: string; total: number; count: number }>([
      { $match: { status: { $in: ['successful', 'partially_refunded'] } } },
      {
        $lookup: {
          from: 'bookings',
          localField: 'booking',
          foreignField: '_id',
          as: 'booking',
        },
      },
      { $unwind: '$booking' },
      {
        $group: {
          _id: '$booking.snapshot.serviceName',
          total: { $sum: '$amountPaidKobo' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]),

    Payment.aggregate<{ _id: string; total: number }>([
      {
        $match: {
          status: { $in: ['successful', 'partially_refunded'] },
          paidAt: { $gte: subMonths(now, 11) },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$paidAt' } },
          total: { $sum: '$amountPaidKobo' },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const topFive = byService.slice(0, 5);
  const othersTotal = byService.slice(5).reduce((sum, row) => sum + row.total, 0);

  const breakdown = [
    ...topFive.map((row) => ({ name: row._id ?? 'Unknown', value: row.total })),
    ...(othersTotal > 0 ? [{ name: 'Others', value: othersTotal }] : []),
  ];

  return {
    totalKobo: total,
    thisMonthKobo: thisMonth,
    change: percentChange(thisMonth, lastMonth),
    breakdown,
    monthly: byMonth.map((row) => ({
      label: format(new Date(`${row._id}-01`), 'MMM'),
      value: row.total,
    })),
  };
}

/* ── Top services ─────────────────────────────────────────────────── */

export async function getTopServices(limit = 5) {
  await connectDB();

  const rows = await Booking.aggregate<{
    _id: unknown;
    name: string;
    appointments: number;
    revenue: number;
  }>([
    {
      $group: {
        _id: '$service',
        name: { $first: '$snapshot.serviceName' },
        appointments: { $sum: 1 },
        // Only paid bookings contribute revenue.
        revenue: { $sum: { $cond: ['$isPaid', '$totalKobo', 0] } },
      },
    },
    { $sort: { appointments: -1 } },
    { $limit: limit },
  ]);

  const services = await Service.find({ _id: { $in: rows.map((row) => row._id) } })
    .select('icon slug category')
    .populate('category', 'accent')
    .lean();

  const meta = new Map(
    services.map((service) => [
      String(service._id),
      {
        icon: service.icon,
        slug: service.slug,
        accent: (service.category as unknown as { accent?: string })?.accent ?? 'teal',
      },
    ]),
  );

  return rows.map((row) => ({
    id: String(row._id),
    name: row.name ?? 'Unknown service',
    appointments: row.appointments,
    revenueKobo: row.revenue,
    icon: meta.get(String(row._id))?.icon ?? 'stethoscope',
    slug: meta.get(String(row._id))?.slug ?? '',
    accent: meta.get(String(row._id))?.accent ?? 'teal',
  }));
}

/* ── Appointment status counts (summary cards) ────────────────────── */

export async function getAppointmentCounts() {
  await connectDB();

  const rows = await Booking.aggregate<{ _id: string; count: number }>([
    { $group: { _id: '$status', count: { $sum: 1 } } },
  ]);

  const byStatus = new Map(rows.map((row) => [row._id, row.count]));
  const total = rows.reduce((sum, row) => sum + row.count, 0);

  return {
    total,
    confirmed: byStatus.get('confirmed') ?? 0,
    pending: byStatus.get('pending_payment') ?? 0,
    cancelled: (byStatus.get('cancelled') ?? 0) + (byStatus.get('no_show') ?? 0),
    completed: byStatus.get('completed') ?? 0,
  };
}

/* ── Reports ──────────────────────────────────────────────────────── */

export async function getReportData(from: Date, to: Date) {
  await connectDB();

  const [
    bookingsByStatus,
    bookingsByService,
    revenueTotal,
    refundTotal,
    newPatients,
    staffPerformance,
    dailyBookings,
  ] = await Promise.all([
    Booking.aggregate<{ _id: string; count: number }>([
      { $match: { startAt: { $gte: from, $lte: to } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),

    Booking.aggregate<{ _id: string; count: number; revenue: number }>([
      { $match: { startAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: '$snapshot.serviceName',
          count: { $sum: 1 },
          revenue: { $sum: { $cond: ['$isPaid', '$totalKobo', 0] } },
        },
      },
      { $sort: { count: -1 } },
    ]),

    sumPayments({ paidAt: { $gte: from, $lte: to } }),

    Refund.aggregate<{ total: number }>([
      { $match: { status: 'completed', processedAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: '$amountKobo' } } },
    ]).then((rows) => rows[0]?.total ?? 0),

    User.countDocuments({ role: 'patient', createdAt: { $gte: from, $lte: to } }),

    Booking.aggregate<{
      _id: unknown;
      name: string;
      total: number;
      completed: number;
      cancelled: number;
      revenue: number;
    }>([
      { $match: { startAt: { $gte: from, $lte: to }, staff: { $ne: null } } },
      {
        $lookup: {
          from: 'staffprofiles',
          localField: 'staff',
          foreignField: '_id',
          as: 'staffProfile',
        },
      },
      { $unwind: '$staffProfile' },
      {
        $lookup: {
          from: 'users',
          localField: 'staffProfile.user',
          foreignField: '_id',
          as: 'staffUser',
        },
      },
      { $unwind: '$staffUser' },
      {
        $group: {
          _id: '$staff',
          name: { $first: '$staffUser.name' },
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
          revenue: { $sum: { $cond: ['$isPaid', '$totalKobo', 0] } },
        },
      },
      { $sort: { total: -1 } },
    ]),

    Booking.aggregate<{ _id: string; count: number }>([
      { $match: { startAt: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$startAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
  ]);

  const statusMap = new Map(bookingsByStatus.map((row) => [row._id, row.count]));
  const totalBookings = bookingsByStatus.reduce((sum, row) => sum + row.count, 0);
  const cancelled = (statusMap.get('cancelled') ?? 0) + (statusMap.get('no_show') ?? 0);

  return {
    totalBookings,
    completed: statusMap.get('completed') ?? 0,
    cancelled,
    pending: statusMap.get('pending_payment') ?? 0,
    confirmed: statusMap.get('confirmed') ?? 0,
    cancellationRate: totalBookings > 0 ? (cancelled / totalBookings) * 100 : 0,
    revenueKobo: revenueTotal,
    refundedKobo: refundTotal,
    newPatients,
    byService: bookingsByService.map((row) => ({
      name: row._id ?? 'Unknown',
      appointments: row.count,
      revenueKobo: row.revenue,
    })),
    byStaff: staffPerformance.map((row) => ({
      id: String(row._id),
      name: row.name,
      appointments: row.total,
      completed: row.completed,
      cancelled: row.cancelled,
      revenueKobo: row.revenue,
      completionRate: row.total > 0 ? (row.completed / row.total) * 100 : 0,
    })),
    daily: dailyBookings.map((row) => ({
      label: format(new Date(row._id), 'd MMM'),
      value: row.count,
    })),
  };
}
