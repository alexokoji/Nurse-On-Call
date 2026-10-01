import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { connectDB } from '@/lib/db/connect';
import { User, Role, StaffProfile, PatientProfile } from '@/models';
import { SESSION_COOKIE, verifySession } from './session';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  type Permission,
} from '@/lib/permissions/catalogue';
import type { UserRole } from '@/types';

export interface CurrentUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  permissions: Permission[];
  /** StaffProfile id when the user is a staff member. */
  staffProfileId?: string;
  patientProfileId?: string;
}

/**
 * Resolve the signed-in user for the current request.
 *
 * `cache()` deduplicates this within a single render pass, so a layout, a page
 * and three server components all share one database round trip.
 *
 * Permissions come from the database each time (never from the token) so a
 * revoked role applies immediately.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const session = await verifySession(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  await connectDB();

  const user = await User.findById(session.sub)
    .select('name email role status avatar sessionVersion')
    .lean();

  if (!user) return null;
  // A suspended account keeps its cookie but loses all access.
  if (user.status !== 'active') return null;
  // Password change / forced logout invalidates older tokens.
  if ((user.sessionVersion ?? 1) !== session.v) return null;

  const permissions = await resolvePermissions(user.role);

  const result: CurrentUser = {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar,
    permissions,
  };

  if (user.role === 'staff') {
    const staff = await StaffProfile.findOne({ user: user._id }).select('_id').lean();
    if (staff) result.staffProfileId = String(staff._id);
  } else if (user.role === 'patient') {
    const profile = await PatientProfile.findOne({ user: user._id }).select('_id').lean();
    if (profile) result.patientProfileId = String(profile._id);
  }

  return result;
});

/** Super admins always hold every permission; other roles read from the Role collection. */
async function resolvePermissions(role: UserRole): Promise<Permission[]> {
  if (role === 'super_admin') return ALL_PERMISSIONS;
  if (role === 'patient') return [];

  const stored = await Role.findOne({ key: role }).select('permissions').lean();
  if (stored?.permissions?.length) {
    return stored.permissions.filter((p): p is Permission =>
      (ALL_PERMISSIONS as string[]).includes(p),
    );
  }
  // Role collection not seeded yet — fall back to the code defaults.
  return DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS] ?? [];
}

export function userCan(user: CurrentUser | null, permission: Permission): boolean {
  if (!user) return false;
  if (user.role === 'super_admin') return true;
  return user.permissions.includes(permission);
}

export function userCanAny(user: CurrentUser | null, permissions: Permission[]): boolean {
  return permissions.some((p) => userCan(user, p));
}
