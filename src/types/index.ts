/**
 * Shared domain enums and types.
 *
 * These string unions are the single source of truth: Mongoose schemas,
 * Zod validators and UI badges all derive from them so a new status can
 * never be introduced in one layer without the others noticing.
 */

export const USER_ROLES = [
  'super_admin',
  'admin',
  'operations_manager',
  'finance',
  'staff',
  'patient',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const ADMIN_ROLES: UserRole[] = [
  'super_admin',
  'admin',
  'operations_manager',
  'finance',
  'staff',
];

export const USER_STATUSES = ['active', 'inactive', 'suspended', 'pending'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

/** Where a service is delivered. */
export const SERVICE_TYPES = ['clinic', 'home', 'virtual', 'hybrid'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

/** Concrete location chosen for a single booking. "hybrid" is never booked directly. */
export const LOCATION_TYPES = ['clinic', 'home', 'virtual'] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const SERVICE_STATUSES = ['draft', 'published', 'archived'] as const;
export type ServiceStatus = (typeof SERVICE_STATUSES)[number];

export const BOOKING_STATUSES = [
  'pending_payment',
  'confirmed',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
  'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const PAYMENT_STATUSES = [
  'pending',
  'successful',
  'failed',
  'abandoned',
  'refunded',
  'partially_refunded',
] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/**
 * `bank_transfer` is a patient-initiated transfer the organisation confirms by
 * hand; `manual` is a payment an administrator records after the fact (cash at
 * the visit, a POS terminal, a phone booking). They are kept apart because the
 * first needs a pending state a patient can see and chase, and the second is
 * settled the moment it is entered.
 */
export const PAYMENT_PROVIDERS = [
  'paystack',
  'flutterwave',
  'korapay',
  'bank_transfer',
  'manual',
] as const;
export type PaymentProvider = (typeof PAYMENT_PROVIDERS)[number];

export const REFUND_STATUSES = [
  'requested',
  'approved',
  'rejected',
  'processing',
  'completed',
  'failed',
] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const REVIEW_STATUSES = ['pending', 'approved', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const NOTIFICATION_CHANNELS = ['email', 'sms', 'in_app'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

export const NOTIFICATION_STATUSES = ['queued', 'sent', 'failed', 'read'] as const;
export type NotificationStatus = (typeof NOTIFICATION_STATUSES)[number];

export const NOTIFICATION_TEMPLATES = [
  'booking_confirmation',
  'appointment_reminder',
  'payment_confirmation',
  'cancellation',
  'reschedule',
  'refund',
  'staff_assigned',
  'custom',
] as const;
export type NotificationTemplate = (typeof NOTIFICATION_TEMPLATES)[number];

export const STAFF_DEPARTMENTS = [
  'nursing',
  'medical',
  'physiotherapy',
  'pharmacy',
  'laboratory',
  'operations',
] as const;
export type StaffDepartment = (typeof STAFF_DEPARTMENTS)[number];

export const STAFF_ROLES = [
  'doctor',
  'nurse',
  'physiotherapist',
  'pharmacist',
  'lab_technician',
  'care_coordinator',
] as const;
export type StaffRoleTitle = (typeof STAFF_ROLES)[number];

export const TICKET_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'] as const;
export type Gender = (typeof GENDERS)[number];

export const WEEKDAYS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** Slot returned by the availability engine. */
export interface TimeSlot {
  /** "HH:mm" start of the slot in clinic-local time. */
  start: string;
  /** "HH:mm" end of the slot. */
  end: string;
  available: boolean;
  /** Staff ids that can serve this slot. Empty when none are free. */
  staffIds: string[];
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ActionResult<T = unknown> {
  ok: boolean;
  message?: string;
  data?: T;
  fieldErrors?: Record<string, string[]>;
}

/** Human-readable labels, kept next to the unions they describe. */
export const LABELS = {
  serviceType: {
    clinic: 'Clinic Visit',
    home: 'Home Visit',
    virtual: 'Virtual Consultation',
    hybrid: 'Clinic or Home',
  } satisfies Record<ServiceType, string>,
  locationType: {
    clinic: 'Clinic Visit',
    home: 'Home Visit',
    virtual: 'Virtual',
  } satisfies Record<LocationType, string>,
  bookingStatus: {
    pending_payment: 'Pending',
    confirmed: 'Confirmed',
    in_progress: 'In Progress',
    completed: 'Completed',
    cancelled: 'Cancelled',
    no_show: 'No Show',
    expired: 'Expired',
  } satisfies Record<BookingStatus, string>,
  paymentStatus: {
    pending: 'Pending',
    successful: 'Successful',
    failed: 'Failed',
    abandoned: 'Abandoned',
    refunded: 'Refunded',
    partially_refunded: 'Partially Refunded',
  } satisfies Record<PaymentStatus, string>,
  refundStatus: {
    requested: 'Requested',
    approved: 'Approved',
    rejected: 'Rejected',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
  } satisfies Record<RefundStatus, string>,
  userRole: {
    super_admin: 'Super Admin',
    admin: 'Admin',
    operations_manager: 'Operations Manager',
    finance: 'Finance',
    staff: 'Staff',
    patient: 'Patient',
  } satisfies Record<UserRole, string>,
  staffRole: {
    doctor: 'Doctor',
    nurse: 'Nurse',
    physiotherapist: 'Physiotherapist',
    pharmacist: 'Pharmacist',
    lab_technician: 'Lab Technician',
    care_coordinator: 'Care Coordinator',
  } satisfies Record<StaffRoleTitle, string>,
  department: {
    nursing: 'Nursing',
    medical: 'Medical',
    physiotherapy: 'Physiotherapy',
    pharmacy: 'Pharmacy',
    laboratory: 'Laboratory',
    operations: 'Operations',
  } satisfies Record<StaffDepartment, string>,
} as const;
