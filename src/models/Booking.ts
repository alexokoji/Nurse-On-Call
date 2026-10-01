import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import {
  BOOKING_STATUSES,
  GENDERS,
  LOCATION_TYPES,
  type BookingStatus,
  type Gender,
  type LocationType,
} from '@/types';

/**
 * A Booking is the canonical appointment record.
 *
 * The brief lists "Booking" and "Appointment" separately; keeping two
 * collections in sync invites drift, so one row carries the whole lifecycle.
 * An *appointment* is simply a Booking whose status is confirmed, in_progress
 * or completed — see `appointmentFilter()` in lib/bookings/queries.ts.
 */

export interface IBookingSnapshot {
  /** Values copied at booking time so historical records never mutate
   *  when a service is re-priced or renamed. */
  serviceName: string;
  serviceSlug: string;
  durationMinutes: number;
  bufferMinutes: number;
}

export interface IBooking extends Document {
  _id: Types.ObjectId;
  /** Public reference, e.g. APT-000248. */
  reference: string;

  patient: Types.ObjectId;
  patientProfile?: Types.ObjectId | null;
  service: Types.ObjectId;
  staff?: Types.ObjectId | null;

  snapshot: IBookingSnapshot;

  /** Local calendar day, "YYYY-MM-DD" — immune to UTC drift. */
  dateKey: string;
  /** Slot start, "HH:mm" clinic-local. */
  startTime: string;
  endTime: string;
  /** UTC instants derived from dateKey + times; used for range queries. */
  startAt: Date;
  endAt: Date;

  locationType: LocationType;
  address?: {
    street?: string;
    area?: string;
    city?: string;
    state?: string;
    landmark?: string;
  };
  meetingLink?: string;

  contact: {
    name: string;
    phone: string;
    email: string;
    dateOfBirth?: Date;
    gender?: Gender;
  };
  emergencyContact?: {
    name?: string;
    phone?: string;
    relationship?: string;
  };
  notes?: string;
  /** Free-form answers to service-specific questions. */
  serviceAnswers?: Record<string, string>;

  status: BookingStatus;

  /* Money, all in kobo. */
  servicePriceKobo: number;
  surchargeKobo: number;
  discountKobo: number;
  totalKobo: number;
  promotionCode?: string | null;

  /** Set once a successful payment is verified server-side. */
  isPaid: boolean;
  paidAt?: Date | null;

  /** Unpaid bookings hold their slot only until this instant. */
  holdExpiresAt?: Date | null;

  cancelledAt?: Date | null;
  cancelledBy?: Types.ObjectId | null;
  cancellationReason?: string;
  completedAt?: Date | null;
  rescheduledFrom?: Types.ObjectId | null;

  reminderSentAt?: Date | null;
  hasReview: boolean;

  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    reference: { type: String, required: true, unique: true, index: true },

    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    patientProfile: { type: Schema.Types.ObjectId, ref: 'PatientProfile', default: null },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    staff: { type: Schema.Types.ObjectId, ref: 'StaffProfile', default: null, index: true },

    snapshot: {
      serviceName: { type: String, required: true },
      serviceSlug: { type: String, required: true },
      durationMinutes: { type: Number, required: true },
      bufferMinutes: { type: Number, default: 0 },
    },

    dateKey: { type: String, required: true, index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },

    locationType: { type: String, enum: LOCATION_TYPES, required: true, index: true },
    address: {
      street: String,
      area: String,
      city: String,
      state: String,
      landmark: String,
    },
    meetingLink: String,

    contact: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      dateOfBirth: Date,
      gender: { type: String, enum: GENDERS },
    },
    emergencyContact: {
      name: String,
      phone: String,
      relationship: String,
    },
    notes: { type: String, maxlength: 2000 },
    serviceAnswers: { type: Map, of: String },

    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'pending_payment',
      required: true,
      index: true,
    },

    servicePriceKobo: { type: Number, required: true, min: 0 },
    surchargeKobo: { type: Number, default: 0, min: 0 },
    discountKobo: { type: Number, default: 0, min: 0 },
    totalKobo: { type: Number, required: true, min: 0 },
    promotionCode: { type: String, default: null },

    isPaid: { type: Boolean, default: false, index: true },
    paidAt: { type: Date, default: null },

    holdExpiresAt: { type: Date, default: null },

    cancelledAt: { type: Date, default: null },
    cancelledBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    cancellationReason: String,
    completedAt: { type: Date, default: null },
    rescheduledFrom: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },

    reminderSentAt: { type: Date, default: null },
    hasReview: { type: Boolean, default: false },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

/* Query paths the admin lists and the availability engine actually use. */
BookingSchema.index({ status: 1, startAt: -1 });
BookingSchema.index({ patient: 1, startAt: -1 });
BookingSchema.index({ staff: 1, dateKey: 1, status: 1 });
BookingSchema.index({ service: 1, status: 1 });
BookingSchema.index({ 'contact.name': 'text', reference: 'text', 'snapshot.serviceName': 'text' });

/**
 * Double-booking guard at the storage layer.
 *
 * A staff member may hold only one *live* booking per exact slot start.
 * The partial filter lets cancelled/expired rows free the slot again, and
 * `staff: {$type: 'objectId'}` keeps unassigned bookings out of the index.
 */
BookingSchema.index(
  { staff: 1, startAt: 1 },
  {
    unique: true,
    name: 'uniq_staff_slot_live',
    partialFilterExpression: {
      staff: { $type: 'objectId' },
      status: { $in: ['pending_payment', 'confirmed', 'in_progress'] },
    },
  },
);

export const Booking: Model<IBooking> =
  (models.Booking as Model<IBooking>) || model<IBooking>('Booking', BookingSchema);

export default Booking;
