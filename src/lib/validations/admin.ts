import { z } from 'zod';
import {
  GENDERS,
  SERVICE_STATUSES,
  SERVICE_TYPES,
  STAFF_DEPARTMENTS,
  STAFF_ROLES,
  USER_STATUSES,
  WEEKDAYS,
} from '@/types';
import { emailSchema, passwordSchema, phoneSchema } from './auth';

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use the HH:MM format');
const dateKeySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date');

/** Naira entered by an admin; stored as kobo. */
const nairaSchema = z.coerce.number().min(0, 'Price cannot be negative').max(100_000_000);

/* ── Services ─────────────────────────────────────────────────────── */

export const serviceSchema = z.object({
  name: z.string().trim().min(3, 'Enter a service name').max(140),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only')
    .min(3)
    .max(140),
  categoryId: z.string().min(1, 'Select a category'),
  shortDescription: z.string().trim().min(10, 'Add a short description').max(240),
  description: z.string().trim().min(30, 'Add a full description'),
  image: z.string().trim().url('Enter a valid image URL').optional().or(z.literal('')),
  icon: z.string().trim().max(60).optional(),
  price: nairaSchema,
  homeVisitSurcharge: nairaSchema.default(0),
  durationMinutes: z.coerce.number().int().min(5, 'Minimum 5 minutes').max(600),
  bufferMinutes: z.coerce.number().int().min(0).max(240).default(15),
  serviceType: z.enum(SERVICE_TYPES),
  whatsIncluded: z.array(z.string().trim().max(200)).default([]),
  requirements: z.array(z.string().trim().max(200)).default([]),
  preparation: z.array(z.string().trim().max(300)).default([]),
  faqs: z
    .array(
      z.object({
        question: z.string().trim().min(3).max(200),
        answer: z.string().trim().min(3).max(1000),
      }),
    )
    .default([]),
  status: z.enum(SERVICE_STATUSES).default('draft'),
  isFeatured: z.boolean().default(false),
  seoTitle: z.string().trim().max(70).optional(),
  seoDescription: z.string().trim().max(160).optional(),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

export const serviceCategorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only'),
  description: z.string().trim().max(400).optional(),
  icon: z.string().trim().max(60).default('heart-pulse'),
  accent: z.string().trim().max(30).default('crimson'),
  sortOrder: z.coerce.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type ServiceCategoryInput = z.infer<typeof serviceCategorySchema>;

/* ── Staff ────────────────────────────────────────────────────────── */

export const workingDaySchema = z
  .object({
    day: z.enum(WEEKDAYS),
    enabled: z.boolean().default(true),
    start: timeSchema,
    end: timeSchema,
    breakStart: timeSchema.optional().or(z.literal('')),
    breakEnd: timeSchema.optional().or(z.literal('')),
  })
  .refine((day) => !day.enabled || day.start < day.end, {
    message: 'End time must be after the start time',
    path: ['end'],
  });

export const staffSchema = z.object({
  name: z.string().trim().min(2, 'Enter the full name').max(120),
  email: emailSchema,
  phone: phoneSchema,
  /** Required on create, omitted on edit (an admin cannot read the old one). */
  password: passwordSchema.optional(),
  avatar: z.string().trim().url().optional().or(z.literal('')),
  title: z.enum(STAFF_ROLES),
  department: z.enum(STAFF_DEPARTMENTS),
  bio: z.string().trim().max(2000).optional(),
  qualifications: z.array(z.string().trim().max(160)).default([]),
  specialisations: z.array(z.string().trim().max(160)).default([]),
  licenceNumber: z.string().trim().max(80).optional(),
  yearsOfExperience: z.coerce.number().int().min(0).max(70).optional(),
  serviceIds: z.array(z.string()).default([]),
  workingHours: z.array(workingDaySchema).default([]),
  maxConcurrentAppointments: z.coerce.number().int().min(1).max(10).default(1),
  isPubliclyVisible: z.boolean().default(true),
  isActive: z.boolean().default(true),
});
export type StaffInput = z.infer<typeof staffSchema>;

export const blockedScheduleSchema = z
  .object({
    staffId: z.string().optional().nullable(),
    type: z.enum(['leave', 'holiday', 'training', 'blocked']).default('blocked'),
    startDateKey: dateKeySchema,
    endDateKey: dateKeySchema,
    startTime: timeSchema.optional().or(z.literal('')),
    endTime: timeSchema.optional().or(z.literal('')),
    reason: z.string().trim().max(300).optional(),
  })
  .refine((block) => block.startDateKey <= block.endDateKey, {
    message: 'The end date must not be before the start date',
    path: ['endDateKey'],
  });
export type BlockedScheduleInput = z.infer<typeof blockedScheduleSchema>;

export const availabilityOverrideSchema = z
  .object({
    staffId: z.string().min(1, 'Select a staff member'),
    dateKey: dateKeySchema,
    start: timeSchema,
    end: timeSchema,
    note: z.string().trim().max(200).optional(),
  })
  .refine((slot) => slot.start < slot.end, {
    message: 'End time must be after the start time',
    path: ['end'],
  });
export type AvailabilityOverrideInput = z.infer<typeof availabilityOverrideSchema>;

/* ── Patients & users ─────────────────────────────────────────────── */

export const patientSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema,
  password: passwordSchema.optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(GENDERS).optional(),
  address: z
    .object({
      street: z.string().trim().max(200).optional(),
      area: z.string().trim().max(120).optional(),
      city: z.string().trim().max(120).optional(),
      state: z.string().trim().max(120).optional(),
      landmark: z.string().trim().max(200).optional(),
    })
    .optional(),
  bloodGroup: z.string().trim().max(10).optional(),
  allergies: z.array(z.string().trim().max(120)).default([]),
  chronicConditions: z.array(z.string().trim().max(120)).default([]),
  emergencyContact: z
    .object({
      name: z.string().trim().max(120).optional(),
      relationship: z.string().trim().max(80).optional(),
      phone: z.string().trim().max(30).optional(),
    })
    .optional(),
  status: z.enum(USER_STATUSES).default('active'),
  notes: z.string().trim().max(2000).optional(),
});
export type PatientInput = z.infer<typeof patientSchema>;

export const adminUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema.optional().or(z.literal('')),
  password: passwordSchema.optional(),
  role: z.enum(['super_admin', 'admin', 'operations_manager', 'finance']),
  status: z.enum(USER_STATUSES).default('active'),
});
export type AdminUserInput = z.infer<typeof adminUserSchema>;

export const roleSchema = z.object({
  key: z.string().trim().min(2).max(60),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).optional(),
  permissions: z.array(z.string()).default([]),
});
export type RoleInput = z.infer<typeof roleSchema>;

/* ── Refunds, reviews, notifications ──────────────────────────────── */

export const refundRequestSchema = z.object({
  paymentId: z.string().min(1),
  amount: nairaSchema.refine((value) => value > 0, 'Enter an amount greater than zero'),
  reason: z.string().trim().min(5, 'Give a reason for the refund').max(1000),
});
export type RefundRequestInput = z.infer<typeof refundRequestSchema>;

export const refundDecisionSchema = z.object({
  refundId: z.string().min(1),
  decision: z.enum(['approve', 'reject']),
  note: z.string().trim().max(500).optional(),
});
export type RefundDecisionInput = z.infer<typeof refundDecisionSchema>;

export const reviewModerationSchema = z.object({
  reviewId: z.string().min(1),
  action: z.enum(['approve', 'hide', 'delete']),
});
export type ReviewModerationInput = z.infer<typeof reviewModerationSchema>;

export const sendNotificationSchema = z
  .object({
    channel: z.enum(['email', 'sms', 'in_app']),
    audience: z.enum(['individual', 'all_patients', 'active_patients', 'all_staff']),
    recipientId: z.string().optional(),
    subject: z.string().trim().min(3, 'Enter a subject').max(200),
    body: z.string().trim().min(5, 'Enter a message').max(4000),
  })
  .refine((data) => data.audience !== 'individual' || Boolean(data.recipientId), {
    message: 'Select a recipient',
    path: ['recipientId'],
  });
export type SendNotificationInput = z.infer<typeof sendNotificationSchema>;

/* ── Settings ─────────────────────────────────────────────────────── */

export const generalSettingsSchema = z.object({
  organisationName: z.string().trim().min(2).max(140),
  tagline: z.string().trim().max(200).optional(),
  logo: z.string().trim().url().optional().or(z.literal('')),
  phone: z.string().trim().max(40),
  supportEmail: emailSchema,
  address: z.string().trim().max(300),
  website: z.string().trim().url().optional().or(z.literal('')),
});

export const bookingSettingsSchema = z.object({
  /** Hours of notice required before the earliest bookable slot. */
  minimumNoticeHours: z.coerce.number().int().min(0).max(720).default(4),
  maximumAdvanceDays: z.coerce.number().int().min(1).max(365).default(90),
  defaultDurationMinutes: z.coerce.number().int().min(5).max(480).default(60),
  slotIntervalMinutes: z.coerce.number().int().min(5).max(120).default(30),
  /** Minutes an unpaid booking holds its slot before expiring. */
  paymentHoldMinutes: z.coerce.number().int().min(5).max(1440).default(30),
  cancellationWindowHours: z.coerce.number().int().min(0).max(720).default(24),
  cancellationPolicy: z.string().trim().max(2000).optional(),
  allowSameDayBooking: z.boolean().default(true),
});

export const paymentSettingsSchema = z.object({
  defaultProvider: z.enum(['paystack', 'flutterwave', 'korapay']),
  currency: z.string().trim().length(3).default('NGN'),
  enabledProviders: z.array(z.enum(['paystack', 'flutterwave', 'korapay'])).default(['paystack']),
  allowPayAtVisit: z.boolean().default(false),
});

export const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean().default(true),
  smsEnabled: z.boolean().default(false),
  reminderHoursBefore: z.coerce.number().int().min(1).max(168).default(24),
  sendBookingConfirmation: z.boolean().default(true),
  sendPaymentReceipt: z.boolean().default(true),
});

export const seoSettingsSchema = z.object({
  siteTitle: z.string().trim().min(3).max(70),
  siteDescription: z.string().trim().min(10).max(160),
  keywords: z.array(z.string().trim().max(60)).default([]),
  socialImage: z.string().trim().url().optional().or(z.literal('')),
});

export const securitySettingsSchema = z.object({
  sessionTimeoutMinutes: z.coerce.number().int().min(15).max(20160).default(10080),
  maxFailedLogins: z.coerce.number().int().min(3).max(20).default(5),
  lockoutMinutes: z.coerce.number().int().min(1).max(1440).default(15),
  requireEmailVerification: z.boolean().default(false),
});

/* ── Content ──────────────────────────────────────────────────────── */

export const healthArticleSchema = z.object({
  title: z.string().trim().min(5).max(200),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens only'),
  excerpt: z.string().trim().min(20).max(400),
  content: z.string().trim().min(100, 'The article body is too short'),
  coverImage: z.string().trim().url().optional().or(z.literal('')),
  category: z.string().trim().max(80).default('General Health'),
  tags: z.array(z.string().trim().max(40)).default([]),
  authorName: z.string().trim().max(120).default('NurseOnCall Clinical Team'),
  readMinutes: z.coerce.number().int().min(1).max(60).default(4),
  status: z.enum(['draft', 'published']).default('draft'),
});
export type HealthArticleInput = z.infer<typeof healthArticleSchema>;
