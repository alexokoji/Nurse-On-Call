import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { FilterBar } from '@/components/admin/filter-bar';
import { AdminUserDialog } from './user-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, TableSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminUsers } from '@/lib/queries/admin';
import { initials } from '@/lib/utils';
import { LABELS, type UserRole } from '@/types';

export const metadata: Metadata = { title: 'Users & Roles' };

const ROLE_TONE: Record<string, 'purple' | 'info' | 'success' | 'warning' | 'neutral'> = {
  super_admin: 'purple',
  admin: 'info',
  operations_manager: 'success',
  finance: 'warning',
  staff: 'neutral',
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string; page?: string }>;
}) {
  const user = await requireAdmin('users.view');
  const params = await searchParams;
  const canManage = userCan(user, 'users.manage');

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
            Users &amp; roles
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Everyone with access to this admin panel, and what their role permits.
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/roles">
              <ShieldCheck className="size-4" />
              Manage roles
            </Link>
          </Button>
          {canManage && <AdminUserDialog canCreateSuperAdmin={user.role === 'super_admin'} />}
        </div>
      </div>

      <FilterBar
        searchPlaceholder="Search by name or email…"
        filters={[
          {
            name: 'role',
            label: 'All Roles',
            options: (
              ['super_admin', 'admin', 'operations_manager', 'finance', 'staff'] as UserRole[]
            ).map((role) => ({ value: role, label: LABELS.userRole[role] })),
          },
        ]}
      />

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={8} columns={5} />
          </div>
        }
      >
        <UsersTable params={params} canManage={canManage} isSuperAdmin={user.role === 'super_admin'} />
      </Suspense>
    </div>
  );
}

async function UsersTable({
  params,
  canManage,
  isSuperAdmin,
}: {
  params: { q?: string; role?: string; page?: string };
  canManage: boolean;
  isSuperAdmin: boolean;
}) {
  const result = await getAdminUsers({
    q: params.q,
    role: params.role,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={UserPlus}
          title="No users found"
          description="Nothing matches these filters."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Last sign-in</TableHead>
            <TableHead>Status</TableHead>
            {canManage && (
              <TableHead className="w-12 text-right">
                <span className="sr-only">Actions</span>
              </TableHead>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((account) => (
            <TableRow key={account.id}>
              <TableCell>
                <div className="flex items-center gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[11px] font-semibold text-brand-700">
                    {initials(account.name)}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-navy-800">{account.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{account.email}</p>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <Badge variant={ROLE_TONE[account.role] ?? 'neutral'}>
                  {LABELS.userRole[account.role as UserRole]}
                </Badge>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {account.phone}
                </span>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {account.lastLoginAt
                    ? format(new Date(account.lastLoginAt), 'd MMM yyyy, HH:mm')
                    : 'Never'}
                </span>
              </TableCell>

              <TableCell>
                <StatusBadge kind="user" status={account.status} />
              </TableCell>

              {canManage && (
                <TableCell className="text-right">
                  <AdminUserDialog
                    canCreateSuperAdmin={isSuperAdmin}
                    user={{
                      id: account.id,
                      name: account.name,
                      email: account.email,
                      phone: account.phone === '—' ? '' : account.phone,
                      role: account.role,
                      status: account.status,
                    }}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="users"
      />
    </div>
  );
}
