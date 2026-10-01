import { z } from 'zod';
import { GENDERS, LOCATION_TYPES } from '@/types';
import { emailSchema, phoneSchema } from './auth';

const dateKeySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Select a valid date')
  .refine((key) => !Number.isNaN(Date.parse(key)), 'Select a valid date');

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Select a valid time');

export const addressSchema = z.object({
  street: z.string().trim().min(3, 'Enter the street address').max(200),
  area: z.string().trim().max(120).optional(),
  city: z.string().trim().min(2, 'Enter the city').max(120),
  state: z.string().trim().min(2, 'Enter the state').max(120),
  landmark: z.string().trim().max(200).optional(),
});

/**
 * Payload accepted by POST /api/bookings.
 *
 * Note what is *absent*: price, staff assignment and status. Those are
 * derived server-side — a client that sends them is ignored.
 */
export const createBookingSchema = z
  .object({
    serviceId: z.string().min(1, 'Select a service'),
    locationType: z.enum(LOCATION_TYPES, { errorMap: () => ({ message: 'Select a location' }) }),
    dateKey: dateKeySchema,
    startTime: timeSchema,
    /** Optional preference; the engine still verifies the staff member is free. */
    staffId: z.string().optional().nullable(),

    contact: z.object({
      name: z.string().trim().min(2, 'Enter the patient name').max(120),
      phone: phoneSchema,
      email: emailSchema,
      dateOfBirth: z.string().optional(),
      gender: z.enum(GENDERS).optional(),
    }),

    address: addressSchema.optional(),

    emergencyContact: z
      .object({
        name: z.string().trim().max(120).optional(),
        phone: z.string().trim().optional(),
        relationship: z.string().trim().max(80).optional(),
      })
      .optional(),

    notes: z.string().trim().max(2000).optional(),
    serviceAnswers: z.record(z.string().max(500)).optional(),
    promotionCode: z.string().trim().max(40).optional(),
  })
  .superRefine((data, ctx) => {
    // A home visit without an address cannot be delivered.
    if (data.locationType === 'home' && !data.address) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['address'],
        message: 'A delivery address is required for home visits',
      });
    }
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

export const availabilityQuerySchema = z.object({
  serviceId: z.string().min(1),
  dateKey: dateKeySchema,
  locationType: z.enum(LOCATION_TYPES),
  staffId: z.string().optional(),
});
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;

export const rescheduleSchema = z.object({
  bookingId: z.string().min(1),
  dateKey: dateKeySchema,
  startTime: timeSchema,
  staffId: z.string().optional().nullable(),
  reason: z.string().trim().max(500).optional(),
});
export type RescheduleInput = z.infer<typeof rescheduleSchema>;

export const cancelBookingSchema = z.object({
  bookingId: z.string().min(1),
  reason: z.string().trim().min(3, 'Tell us why this is being cancelled').max(500),
});
export type CancelBookingInput = z.infer<typeof cancelBookingSchema>;

export const assignStaffSchema = z.object({
  bookingId: z.string().min(1),
  staffId: z.string().min(1, 'Select a staff member'),
});
export type AssignStaffInput = z.infer<typeof assignStaffSchema>;

export const updateBookingStatusSchema = z.object({
  bookingId: z.string().min(1),
  status: z.enum(['confirmed', 'in_progress', 'completed', 'no_show']),
});
export type UpdateBookingStatusInput = z.infer<typeof updateBookingStatusSchema>;
