import type { Metadata } from 'next';
import { addDays, startOfWeek } from 'date-fns';
import { CalendarRange } from 'lucide-react';
import { ScheduleView } from './schedule-view';
import { requireAdmin } from '@/lib/auth/guards';
import { connectDB } from '@/lib/db/connect';
import { Booking, BlockedSchedule, StaffProfile } from '@/models';
import { toDateKey } from '@/lib/utils';
import { EmptyState } from '@/components/ui/feedback';
import type { BookingStatus } from '@/types';

export const metadata: Metadata = { title: 'Schedule' };

export default async function AdminSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ staffId?: string; date?: string; view?: string }>;
}) {
  await requireAdmin('staff.schedule');
  const params = await searchParams;

  const anchor = params.date ? new Date(params.date) : new Date();
  const view = (['day', 'week', 'month'].includes(params.view ?? '') ? params.view : 'week') as
    | 'day'
    | 'week'
    | 'month';

  const { from, to } = windowFor(anchor, view);

  await connectDB();

  const staffFilter: Record<string, unknown> = { isActive: true };
  if (params.staffId) staffFilter._id = params.staffId;

  const [staff, bookings, blocks] = await Promise.all([
    StaffProfile.find(staffFilter)
      .populate('user', 'name')
      .select('user title department')
      .sort({ createdAt: 1 })
      .lean(),

    Booking.find({
      dateKey: { $gte: toDateKey(from), $lte: toDateKey(to) },
      status: { $in: ['pending_payment', 'confirmed', 'in_progress', 'completed'] },
      ...(params.staffId ? { staff: params.staffId } : {}),
    })
      .populate({ path: 'staff', select: 'user', populate: { path: 'user', select: 'name' } })
      .sort({ startAt: 1 })
      .lean(),

    BlockedSchedule.find({
      approved: true,
      startDateKey: { $lte: toDateKey(to) },
      endDateKey: { $gte: toDateKey(from) },
      ...(params.staffId ? { $or: [{ staff: params.staffId }, { staff: null }] } : {}),
    }).lean(),
  ]);

  const staffOptions = staff.map((member) => ({
    id: String(member._id),
    name: (member.user as unknown as { name?: string })?.name ?? 'Unknown',
    title: member.title,
  }));

  if (staffOptions.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="No active staff"
        description="Add a staff member with working hours before scheduling appointments."
        action={{ label: 'Add staff', href: '/admin/staff/new' }}
      />
    );
  }

  return (
    <ScheduleView
      view={view}
      anchorDate={toDateKey(anchor)}
      staff={staffOptions}
      selectedStaffId={params.staffId ?? null}
      events={bookings.map((booking) => ({
        id: String(booking._id),
        reference: booking.reference,
        title: booking.snapshot.serviceName,
        patientName: booking.contact.name,
        staffId: booking.staff ? String(booking.staff) : null,
        staffName:
          (booking.staff as unknown as { user?: { name?: string } })?.user?.name ?? 'Unassigned',
        dateKey: booking.dateKey,
        startTime: booking.startTime,
        endTime: booking.endTime,
        status: booking.status as BookingStatus,
        locationType: booking.locationType,
      }))}
      blocks={blocks.map((block) => ({
        id: String(block._id),
        staffId: block.staff ? String(block.staff) : null,
        type: block.type,
        startDateKey: block.startDateKey,
        endDateKey: block.endDateKey,
        startTime: block.startTime ?? null,
        endTime: block.endTime ?? null,
        reason: block.reason ?? '',
      }))}
    />
  );
}

/** Date window the calendar needs to fetch for the current view. */
function windowFor(anchor: Date, view: 'day' | 'week' | 'month') {
  if (view === 'day') return { from: anchor, to: anchor };

  if (view === 'month') {
    const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    // Pad to whole weeks so the grid's leading/trailing days are populated.
    return { from: startOfWeek(first), to: addDays(startOfWeek(last), 6) };
  }

  const start = startOfWeek(anchor);
  return { from: start, to: addDays(start, 6) };
}

export const dynamic = 'force-dynamic';
