import { describe, it, expect } from 'vitest';
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  PERMISSIONS,
  PERMISSION_GROUPS,
  type Permission,
} from '@/lib/permissions/catalogue';
import { userCan, userCanAny, type CurrentUser } from '@/lib/auth/current-user';

/**
 * Authorisation is the difference between an admin panel and a data breach,
 * so the role definitions get their own tests — particularly the rule that
 * a lower-privilege role cannot reach money or other people's accounts.
 */

function user(role: CurrentUser['role'], permissions: Permission[] = []): CurrentUser {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@nurseoncall.ng',
    role,
    permissions,
  };
}

describe('permission catalogue', () => {
  it('exposes every catalogue key through ALL_PERMISSIONS', () => {
    expect(ALL_PERMISSIONS).toHaveLength(Object.keys(PERMISSIONS).length);
  });

  it('places every permission in exactly one UI group', () => {
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions);

    // Nothing is missing from the roles screen…
    for (const permission of ALL_PERMISSIONS) {
      expect(grouped).toContain(permission);
    }
    // …and nothing appears twice, which would render duplicate checkboxes.
    expect(new Set(grouped).size).toBe(grouped.length);
  });

  it('only references permissions that exist', () => {
    for (const [role, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS)) {
      for (const permission of permissions) {
        expect(ALL_PERMISSIONS, `${role} grants unknown "${permission}"`).toContain(permission);
      }
    }
  });
});

describe('default role grants', () => {
  it('gives super_admin everything', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.super_admin).toEqual(ALL_PERMISSIONS);
  });

  it('keeps role management away from ordinary admins', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.admin).not.toContain('roles.manage');
    expect(DEFAULT_ROLE_PERMISSIONS.admin).not.toContain('users.manage');
    expect(DEFAULT_ROLE_PERMISSIONS.admin).not.toContain('settings.manage');
  });

  it('keeps refunds away from the operations manager', () => {
    // Operations runs the diary; money is finance's responsibility.
    expect(DEFAULT_ROLE_PERMISSIONS.operations_manager).not.toContain('payments.refund');
    expect(DEFAULT_ROLE_PERMISSIONS.operations_manager).not.toContain('refunds.approve');
    expect(DEFAULT_ROLE_PERMISSIONS.operations_manager).toContain('appointments.cancel');
  });

  it('keeps clinical and staff administration away from finance', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.finance).toContain('payments.refund');
    expect(DEFAULT_ROLE_PERMISSIONS.finance).toContain('refunds.approve');
    expect(DEFAULT_ROLE_PERMISSIONS.finance).not.toContain('appointments.cancel');
    expect(DEFAULT_ROLE_PERMISSIONS.finance).not.toContain('staff.manage');
    expect(DEFAULT_ROLE_PERMISSIONS.finance).not.toContain('services.edit');
  });

  it('gives clinical staff a read-mostly view and no money access', () => {
    const staff = DEFAULT_ROLE_PERMISSIONS.staff;
    expect(staff).toContain('appointments.view');
    expect(staff).toContain('patients.view');
    expect(staff).not.toContain('payments.view');
    expect(staff).not.toContain('patients.edit');
    expect(staff).not.toContain('appointments.cancel');
    expect(staff).not.toContain('audit.view');
  });

  it('never grants a patient any admin permission', () => {
    expect(DEFAULT_ROLE_PERMISSIONS).not.toHaveProperty('patient');
  });
});

describe('userCan', () => {
  it('refuses everything when nobody is signed in', () => {
    expect(userCan(null, 'appointments.view')).toBe(false);
    expect(userCanAny(null, ['appointments.view', 'patients.view'])).toBe(false);
  });

  it('grants a super admin everything without consulting the stored list', () => {
    // Deliberately given an empty permission array.
    const superAdmin = user('super_admin', []);
    expect(userCan(superAdmin, 'roles.manage')).toBe(true);
    expect(userCan(superAdmin, 'payments.refund')).toBe(true);
  });

  it('grants only what the resolved list contains', () => {
    const finance = user('finance', ['payments.view', 'payments.refund']);
    expect(userCan(finance, 'payments.refund')).toBe(true);
    expect(userCan(finance, 'staff.manage')).toBe(false);
  });

  it('refuses a patient every admin permission', () => {
    const patient = user('patient', []);
    for (const permission of ALL_PERMISSIONS) {
      expect(userCan(patient, permission)).toBe(false);
    }
  });

  it('userCanAny passes when at least one permission is held', () => {
    const ops = user('operations_manager', ['appointments.view']);
    expect(userCanAny(ops, ['payments.refund', 'appointments.view'])).toBe(true);
    expect(userCanAny(ops, ['payments.refund', 'roles.manage'])).toBe(false);
  });
});
