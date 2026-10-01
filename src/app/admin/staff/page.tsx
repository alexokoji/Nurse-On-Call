import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { CalendarRange, MoreHorizontal, Pencil, Plus, Star, UsersRound } from 'lucide-react';
import { FilterBar } from '@/components/admin/filter-bar';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, TableSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminStaff } from '@/lib/queries/admin';
import { initials } from '@/lib/utils';
import { LABELS, STAFF_DEPARTMENTS } from '@/types';

export const metadata: Metadata = { title: 'Staff' };

export default async function AdminStaffPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; department?: string; active?: string; page?: string }>;
}) {
  const user = await requireAdmin('staff.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      <FilterBar
        searchPlaceholder="Search staff by name or email…"
        filters={[
          {
            name: 'department',
            label: 'All Departments',
            options: STAFF_DEPARTMENTS.map((department) => ({
              value: department,
              label: LABELS.department[department],
            })),
          },
          {
            name: 'active',
            label: 'All Staff',
            options: [
              { value: 'active', label: 'Active only' },
              { value: 'inactive', label: 'Inactive only' },
            ],
          },
        ]}
      >
        {userCan(user, 'staff.manage') && (
          <Button asChild>
            <Link href="/admin/staff/new">
              <Plus className="size-4" />
              New Staff
            </Link>
          </Button>
        )}
      </FilterBar>

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={7} columns={6} />
          </div>
        }
      >
        <StaffTable params={params} />
      </Suspense>
    </div>
  );
}

async function StaffTable({
  params,
}: {
  params: { q?: string; department?: string; active?: string; page?: string };
}) {
  const user = await requireAdmin('staff.view');
  const canManage = userCan(user, 'staff.manage');

  const result = await getAdminStaff({
    q: params.q,
    department: params.department,
    active: params.active,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={UsersRound}
          title="No staff members found"
          description="Staff are created and managed here — they never register themselves."
          action={canManage ? { label: 'Add a staff member', href: '/admin/staff/new' } : undefined}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Staff member</TableHead>
            <TableHead>Department</TableHead>
            <TableHead>Services</TableHead>
            <TableHead className="text-right">Working days</TableHead>
            <TableHead className="text-right">Upcoming</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((member) => (
            <TableRow key={member.id}>
              <TableCell>
                <Link href={`/admin/staff/${member.id}`} className="group flex items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                    {initials(member.name)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-navy-800 group-hover:text-primary">
                      {member.name}
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {LABELS.staffRole[member.title as keyof typeof LABELS.staffRole]}
                      {member.reviewCount > 0 && (
                        <>
                          {' · '}
                          <Star
                            className="inline size-3 fill-amber-400 text-amber-400"
                            aria-hidden
                          />{' '}
                          {member.averageRating.toFixed(1)}
                        </>
                      )}
                    </span>
                  </span>
                </Link>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {LABELS.department[member.department as keyof typeof LABELS.department]}
                </span>
              </TableCell>

              <TableCell>
                {member.services.length === 0 ? (
                  <span className="text-xs italic text-amber-600">
                    No services — cannot be booked
                  </span>
                ) : (
                  <div className="flex max-w-[16rem] flex-wrap gap-1">
                    {member.services.slice(0, 2).map((service) => (
                      <Badge key={service.slug} variant="outline">
                        {service.name}
                      </Badge>
                    ))}
                    {member.services.length > 2 && (
                      <Badge variant="neutral">+{member.services.length - 2}</Badge>
                    )}
                  </div>
                )}
              </TableCell>

              <TableCell className="text-right">
                <span className="text-sm text-muted-foreground">{member.workingDays}/7</span>
              </TableCell>

              <TableCell className="text-right">
                <span className="text-sm font-medium text-navy-800">
                  {member.upcomingAppointments}
                </span>
              </TableCell>

              <TableCell>
                <Badge variant={member.isActive ? 'success' : 'neutral'}>
                  {member.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label="Staff actions">
                      <MoreHorizontal className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href={`/admin/staff/${member.id}`}>
                        <UsersRound />
                        View profile
                      </Link>
                    </DropdownMenuItem>
                    {canManage && (
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/staff/${member.id}/edit`}>
                          <Pencil />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                    )}
                    {userCan(user, 'staff.schedule') && (
                      <DropdownMenuItem asChild>
                        <Link href={`/admin/schedule?staffId=${member.id}`}>
                          <CalendarRange />
                          Manage schedule
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="staff"
      />
    </div>
  );
}
