import type { UserRole } from '@/types';

/**
 * The complete permission catalogue.
 *
 * Permissions are `resource.action` strings. Every admin route and mutation
 * checks one of these — there is no implicit "admins can do anything" path
 * except `super_admin`, which is granted the full set by definition.
 */
export const PERMISSIONS = {
  'dashboard.view': 'View the admin dashboard',

  'appointments.view': 'View appointments',
  'appointments.create': 'Create appointments',
  'appointments.edit': 'Edit appointments',
  'appointments.assign': 'Assign staff to appointments',
  'appointments.reschedule': 'Reschedule appointments',
  'appointments.cancel': 'Cancel appointments',
  'appointments.export': 'Export appointment data',

  'patients.view': 'View patients',
  'patients.create': 'Create patients',
  'patients.edit': 'Edit patient records',
  'patients.delete': 'Deactivate patient accounts',

  'services.view': 'View services',
  'services.create': 'Create services',
  'services.edit': 'Edit services',
  'services.delete': 'Archive services',

  'staff.view': 'View staff',
  'staff.manage': 'Create and edit staff members',
  'staff.schedule': 'Manage staff schedules and leave',

  'payments.view': 'View payments',
  'payments.refund': 'Issue refunds',
  'payments.export': 'Export payment data',

  'refunds.view': 'View refund requests',
  'refunds.approve': 'Approve or reject refunds',

  'reviews.view': 'View reviews',
  'reviews.moderate': 'Approve, hide or delete reviews',

  'notifications.view': 'View notification history',
  'notifications.send': 'Send notifications',

  'support.view': 'View support tickets',
  'support.respond': 'Respond to support tickets',

  'content.view': 'View health articles',
  'content.manage': 'Create and edit health articles',

  'reports.view': 'View reports and analytics',
  'reports.export': 'Export reports',

  'settings.view': 'View settings',
  'settings.manage': 'Change organisation settings',

  'users.view': 'View admin users',
  'users.manage': 'Create and edit admin users',
  'roles.manage': 'Change role permissions',

  'audit.view': 'View audit logs',
} as const;

export type Permission = keyof typeof PERMISSIONS;

export const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[];

/** Grouping used to render the roles matrix in the admin UI. */
export const PERMISSION_GROUPS: { label: string; permissions: Permission[] }[] = [
  { label: 'Dashboard', permissions: ['dashboard.view'] },
  {
    label: 'Appointments',
    permissions: [
      'appointments.view',
      'appointments.create',
      'appointments.edit',
      'appointments.assign',
      'appointments.reschedule',
      'appointments.cancel',
      'appointments.export',
    ],
  },
  {
    label: 'Patients',
    permissions: ['patients.view', 'patients.create', 'patients.edit', 'patients.delete'],
  },
  {
    label: 'Services',
    permissions: ['services.view', 'services.create', 'services.edit', 'services.delete'],
  },
  { label: 'Staff', permissions: ['staff.view', 'staff.manage', 'staff.schedule'] },
  {
    label: 'Payments & Refunds',
    permissions: [
      'payments.view',
      'payments.refund',
      'payments.export',
      'refunds.view',
      'refunds.approve',
    ],
  },
  { label: 'Reviews', permissions: ['reviews.view', 'reviews.moderate'] },
  { label: 'Notifications', permissions: ['notifications.view', 'notifications.send'] },
  { label: 'Support', permissions: ['support.view', 'support.respond'] },
  { label: 'Content', permissions: ['content.view', 'content.manage'] },
  { label: 'Reports', permissions: ['reports.view', 'reports.export'] },
  {
    label: 'Administration',
    permissions: [
      'settings.view',
      'settings.manage',
      'users.view',
      'users.manage',
      'roles.manage',
      'audit.view',
    ],
  },
];

/**
 * Default permission set per role. Seeded into the Role collection, after
 * which an operator may adjust them — except super_admin, which is always
 * the full catalogue and is not stored as an editable set.
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<Exclude<UserRole, 'patient'>, Permission[]> = {
  super_admin: ALL_PERMISSIONS,

  admin: ALL_PERMISSIONS.filter(
    (p) => !['roles.manage', 'users.manage', 'settings.manage'].includes(p),
  ).concat(['users.view', 'settings.view'] as Permission[]),

  operations_manager: [
    'dashboard.view',
    'appointments.view',
    'appointments.create',
    'appointments.edit',
    'appointments.assign',
    'appointments.reschedule',
    'appointments.cancel',
    'appointments.export',
    'patients.view',
    'patients.create',
    'patients.edit',
    'services.view',
    'staff.view',
    'staff.schedule',
    'payments.view',
    'refunds.view',
    'reviews.view',
    'reviews.moderate',
    'notifications.view',
    'notifications.send',
    'support.view',
    'support.respond',
    'reports.view',
  ],

  finance: [
    'dashboard.view',
    'appointments.view',
    'patients.view',
    'payments.view',
    'payments.refund',
    'payments.export',
    'refunds.view',
    'refunds.approve',
    'reports.view',
    'reports.export',
  ],

  staff: ['dashboard.view', 'appointments.view', 'appointments.edit', 'patients.view'],
};

export const ROLE_DESCRIPTIONS: Record<Exclude<UserRole, 'patient'>, string> = {
  super_admin: 'Unrestricted access, including roles, users and settings.',
  admin: 'Day-to-day administration across all modules except role and user management.',
  operations_manager: 'Runs scheduling, appointments and patient care coordination.',
  finance: 'Payments, refunds and financial reporting only.',
  staff: 'Clinical staff — sees their own appointments and patient details.',
};
