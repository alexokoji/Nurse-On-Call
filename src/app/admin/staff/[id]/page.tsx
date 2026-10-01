import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { format } from 'date-fns';
import {
  ArrowLeft,
  Award,
  CalendarRange,
  GraduationCap,
  Mail,
  Pencil,
  Phone,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { EmptyState } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getStaffMember } from '@/lib/queries/admin';
import { formatNaira, formatTimeLabel, initials } from '@/lib/utils';
import { LABELS, WEEKDAYS } from '@/types';

export const metadata: Metadata = { title: 'Staff member' };

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin('staff.view');
  const { id } = await params;

  const staff = await getStaffMember(id);
  if (!staff) notFound();

  const hoursByDay = new Map(staff.workingHours.map((day) => [day.day, day]));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/staff"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All staff
        </Link>

        <div className="flex gap-2">
          {userCan(user, 'staff.schedule') && (
            <Button asChild variant="outline">
              <Link href={`/admin/schedule?staffId=${staff.id}`}>
                <CalendarRange className="size-4" />
                Manage schedule
              </Link>
            </Button>
          )}
          {userCan(user, 'staff.manage') && (
            <Button asChild>
              <Link href={`/admin/staff/${staff.id}/edit`}>
                <Pencil className="size-4" />
                Edit
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Profile header */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-full bg-brand-50 font-display text-xl font-bold text-brand-700">
            {initials(staff.name)}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
                {staff.name}
              </h2>
              <Badge variant={staff.isActive ? 'success' : 'neutral'}>
                {staff.isActive ? 'Active' : 'Inactive'}
              </Badge>
              {!staff.isPubliclyVisible && <Badge variant="outline">Hidden from team page</Badge>}
            </div>

            <p className="mt-1 text-sm text-crimson-600">
              {LABELS.staffRole[staff.title as keyof typeof LABELS.staffRole]} ·{' '}
              {LABELS.department[staff.department as keyof typeof LABELS.department]}
            </p>

            <dl className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <dt className="sr-only">Staff number</dt>
                <dd className="font-mono text-xs">{staff.staffNumber}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Mail className="size-3.5" aria-hidden />
                <dd>{staff.email}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="size-3.5" aria-hidden />
                <dd>{staff.phone}</dd>
              </div>
              {staff.yearsOfExperience > 0 && (
                <div className="flex items-center gap-1.5">
                  <Award className="size-3.5" aria-hidden />
                  <dd>{staff.yearsOfExperience} years&apos; experience</dd>
                </div>
              )}
              {staff.reviewCount > 0 && (
                <div className="flex items-center gap-1.5">
                  <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                  <dd>
                    {staff.averageRating.toFixed(1)} ({staff.reviewCount})
                  </dd>
                </div>
              )}
            </dl>

            {staff.bio && (
              <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">
                {staff.bio}
              </p>
            )}

            {staff.qualifications.length > 0 && (
              <p className="mt-3 flex items-start gap-1.5 text-xs text-muted-foreground">
                <GraduationCap className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                {staff.qualifications.join(' · ')}
              </p>
            )}

            {staff.specialisations.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {staff.specialisations.map((item) => (
                  <Badge key={item} variant="outline">
                    {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Tabs defaultValue="schedule">
        <TabsList>
          <TabsTrigger value="schedule">Schedule</TabsTrigger>
          <TabsTrigger value="services">Services ({staff.services.length})</TabsTrigger>
          <TabsTrigger value="upcoming">Upcoming ({staff.upcoming.length})</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
          <TabsTrigger value="leave">Leave &amp; blocks ({staff.blocks.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="schedule">
          <Panel title="Working hours">
            <ul className="divide-y divide-border">
              {WEEKDAYS.map((day) => {
                const entry = hoursByDay.get(day);
                const working = entry?.enabled;

                return (
                  <li key={day} className="flex items-center justify-between gap-4 py-3">
                    <span className="text-sm font-medium capitalize text-navy-800">{day}</span>
                    {working ? (
                      <span className="text-sm text-muted-foreground">
                        {formatTimeLabel(entry!.start)} – {formatTimeLabel(entry!.end)}
                        {entry!.breakStart && entry!.breakEnd && (
                          <span className="ml-2 text-xs">
                            (break {formatTimeLabel(entry!.breakStart)}–
                            {formatTimeLabel(entry!.breakEnd)})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-sm italic text-muted-foreground">Not working</span>
                    )}
                  </li>
                );
              })}
            </ul>
          </Panel>
        </TabsContent>

        <TabsContent value="services">
          <Panel title="Services this person can deliver">
            {staff.services.length === 0 ? (
              <EmptyState
                title="No services assigned"
                description="Until a service is assigned, this staff member never appears in availability."
                action={
                  userCan(user, 'staff.manage')
                    ? { label: 'Assign services', href: `/admin/staff/${staff.id}/edit` }
                    : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {staff.services.map((service) => (
                  <li key={service.id} className="flex items-center justify-between gap-4 py-3">
                    <Link
                      href={`/admin/services/${service.id}`}
                      className="text-sm font-medium text-navy-800 hover:text-primary"
                    >
                      {service.name}
                    </Link>
                    <span className="text-sm text-muted-foreground">
                      {formatNaira(service.priceKobo)} · {service.durationMinutes} min
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="upcoming">
          <Panel title="Upcoming appointments">
            <BookingList bookings={staff.upcoming} emptyMessage="No upcoming appointments." />
          </Panel>
        </TabsContent>

        <TabsContent value="history">
          <Panel title="Recent appointment history">
            <BookingList bookings={staff.history} emptyMessage="No past appointments yet." />
          </Panel>
        </TabsContent>

        <TabsContent value="leave">
          <Panel title="Leave, holidays and blocked time">
            {staff.blocks.length === 0 ? (
              <EmptyState
                title="No blocked time"
                description="Leave and blocked periods are excluded from availability automatically."
                action={
                  userCan(user, 'staff.schedule')
                    ? { label: 'Add leave', href: `/admin/schedule?staffId=${staff.id}` }
                    : undefined
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {staff.blocks.map((block) => (
                  <li key={block.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <p className="text-sm font-medium capitalize text-navy-800">{block.type}</p>
                      {block.reason && (
                        <p className="text-xs text-muted-foreground">{block.reason}</p>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(block.startDateKey), 'd MMM yyyy')}
                      {block.endDateKey !== block.startDateKey &&
                        ` – ${format(new Date(block.endDateKey), 'd MMM yyyy')}`}
                      {block.startTime && block.endTime && (
                        <span className="ml-2 text-xs">
                          {formatTimeLabel(block.startTime)}–{formatTimeLabel(block.endTime)}
                        </span>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
        {title}
      </h3>
      <div className="p-5">{children}</div>
    </section>
  );
}

function BookingList({
  bookings,
  emptyMessage,
}: {
  bookings: {
    id: string;
    reference: string;
    serviceName: string;
    patientName: string;
    dateKey: string;
    startTime: string;
    status: string;
    totalKobo: number;
  }[];
  emptyMessage: string;
}) {
  if (bookings.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <ul className="divide-y divide-border">
      {bookings.map((booking) => (
        <li key={booking.id}>
          <Link
            href={`/admin/appointments/${booking.id}`}
            className="flex flex-wrap items-center justify-between gap-3 py-3 transition-colors hover:bg-secondary/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-navy-800">{booking.patientName}</p>
              <p className="truncate text-xs text-muted-foreground">
                {booking.serviceName} · <span className="font-mono">{booking.reference}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="whitespace-nowrap text-xs text-muted-foreground">
                {format(new Date(booking.dateKey), 'd MMM')} · {formatTimeLabel(booking.startTime)}
              </span>
              <span className="whitespace-nowrap text-sm font-medium text-navy-800">
                {formatNaira(booking.totalKobo)}
              </span>
              <StatusBadge kind="booking" status={booking.status as never} />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}
