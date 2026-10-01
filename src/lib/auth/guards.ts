import 'server-only';
import { redirect } from 'next/navigation';
import { getCurrentUser, userCan, type CurrentUser } from './current-user';
import type { Permission } from '@/lib/permissions/catalogue';
import { ADMIN_ROLES } from '@/types';

/**
 * Guards for server components, server actions and route handlers.
 *
 * Page-level guards redirect; API-level guards throw a typed error that the
 * route handler converts into a status code. Both hit the database — a
 * client-supplied role or id is never trusted.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    public status: 401 | 403 = 401,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/* ── Page guards (redirect) ───────────────────────────────────────── */

export async function requireUser(redirectTo?: string): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const next = redirectTo ? `?next=${encodeURIComponent(redirectTo)}` : '';
    redirect(`/login${next}`);
  }
  return user;
}

export async function requirePatient(redirectTo?: string): Promise<CurrentUser> {
  const user = await requireUser(redirectTo);
  if (user.role !== 'patient') redirect('/admin');
  return user;
}

export async function requireAdmin(permission?: Permission): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (!ADMIN_ROLES.includes(user.role)) redirect('/patient/dashboard');
  if (permission && !userCan(user, permission)) redirect('/admin/forbidden');
  return user;
}

/* ── API / server-action guards (throw) ───────────────────────────── */

export async function apiRequireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('You must be signed in.', 401);
  return user;
}

export async function apiRequirePermission(permission: Permission): Promise<CurrentUser> {
  const user = await apiRequireUser();
  if (!userCan(user, permission)) {
    throw new AuthError('You do not have permission to perform this action.', 403);
  }
  return user;
}

/**
 * Ownership check for patient-facing resources: a patient may only read their
 * own records, while any admin with the matching permission may read all.
 */
export function assertOwnershipOrPermission(
  user: CurrentUser,
  ownerId: string,
  permission: Permission,
) {
  if (user.id === ownerId) return;
  if (userCan(user, permission)) return;
  throw new AuthError('You do not have access to this record.', 403);
}
