import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import {
  STAFF_DEPARTMENTS,
  STAFF_ROLES,
  WEEKDAYS,
  type StaffDepartment,
  type StaffRoleTitle,
  type Weekday,
} from '@/types';

/** One recurring working window, in clinic-local "HH:mm". */
export interface IWorkingDay {
  day: Weekday;
  enabled: boolean;
  start: string;
  end: string;
  breakStart?: string;
  breakEnd?: string;
}

export interface IStaffProfile extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  staffNumber: string;
  title: StaffRoleTitle;
  department: StaffDepartment;
  bio?: string;
  qualifications: string[];
  specialisations: string[];
  licenceNumber?: string;
  yearsOfExperience?: number;
  /** Services this staff member is cleared to deliver. */
  services: Types.ObjectId[];
  workingHours: IWorkingDay[];
  /** Concurrent appointments this person can hold in one slot. */
  maxConcurrentAppointments: number;
  /** Shown on the public /team page when true. */
  isPubliclyVisible: boolean;
  isActive: boolean;
  averageRating: number;
  reviewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const WorkingDaySchema = new Schema<IWorkingDay>(
  {
    day: { type: String, enum: WEEKDAYS, required: true },
    enabled: { type: Boolean, default: true },
    start: { type: String, default: '08:00' },
    end: { type: String, default: '17:00' },
    breakStart: String,
    breakEnd: String,
  },
  { _id: false },
);

const StaffProfileSchema = new Schema<IStaffProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    staffNumber: { type: String, required: true, unique: true, index: true },
    title: { type: String, enum: STAFF_ROLES, required: true, index: true },
    department: { type: String, enum: STAFF_DEPARTMENTS, required: true, index: true },
    bio: { type: String, maxlength: 2000 },
    qualifications: [String],
    specialisations: [String],
    licenceNumber: String,
    yearsOfExperience: Number,
    services: [{ type: Schema.Types.ObjectId, ref: 'Service', index: true }],
    workingHours: { type: [WorkingDaySchema], default: [] },
    maxConcurrentAppointments: { type: Number, default: 1, min: 1 },
    isPubliclyVisible: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true, index: true },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

StaffProfileSchema.index({ department: 1, isActive: 1 });

export const StaffProfile: Model<IStaffProfile> =
  (models.StaffProfile as Model<IStaffProfile>) ||
  model<IStaffProfile>('StaffProfile', StaffProfileSchema);

export default StaffProfile;
