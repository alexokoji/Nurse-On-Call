import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { RolePermissionEditor } from './role-editor';
import { Badge } from '@/components/ui/badge';
import { Alert } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getRoles } from '@/lib/queries/admin';
import { PERMISSION_GROUPS, PERMISSIONS } from '@/lib/permissions/catalogue';

export const metadata: Metadata = { title: 'Roles & Permissions' };

export default async function RolesPage() {
  const user = await requireAdmin('users.view');
  const roles = await getRoles();
  const canEdit = userCan(user, 'roles.manage');

  return (
    <div className="space-y-5">
      <Link
        href="/admin/users"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Users
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Roles &amp; permissions
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A permission change takes effect immediately — permissions are read from the database on
          every request, not baked into a session token.
        </p>
      </div>

      {!canEdit && (
        <Alert variant="info" title="Read-only">
          You can review these permissions but not change them. That requires the
          <code className="mx-1 rounded bg-secondary px-1 py-0.5 text-xs">roles.manage</code>
          permission.
        </Alert>
      )}

      <div className="space-y-5">
        {roles.map((role) => (
          <section
            key={role.id}
            className="rounded-xl border border-border bg-card shadow-card"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold text-navy-800">{role.name}</h3>
                  {role.isSystem && <Badge variant="outline">System role</Badge>}
                  <Badge variant="neutral">
                    {role.userCount} {role.userCount === 1 ? 'user' : 'users'}
                  </Badge>
                </div>
                {role.description && (
                  <p className="mt-1 text-xs text-muted-foreground">{role.description}</p>
                )}
              </div>

              <Badge variant="info">
                <ShieldCheck className="size-3" aria-hidden />
                {role.key === 'super_admin'
                  ? `All ${Object.keys(PERMISSIONS).length} permissions`
                  : `${role.permissions.length} permissions`}
              </Badge>
            </div>

            <div className="p-5">
              {role.key === 'super_admin' ? (
                <Alert variant="info">
                  The super admin role always holds every permission by definition, and cannot be
                  narrowed here. To restrict someone, give them a different role instead.
                </Alert>
              ) : (
                <RolePermissionEditor
                  roleKey={role.key}
                  roleName={role.name}
                  description={role.description}
                  granted={role.permissions}
                  groups={PERMISSION_GROUPS.map((group) => ({
                    label: group.label,
                    permissions: group.permissions.map((permission) => ({
                      key: permission,
                      description: PERMISSIONS[permission],
                    })),
                  }))}
                  canEdit={canEdit}
                />
              )}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
