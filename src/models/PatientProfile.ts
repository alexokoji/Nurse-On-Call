import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import { GENDERS, type Gender } from '@/types';

export interface IAddress {
  street?: string;
  area?: string;
  city?: string;
  state?: string;
  landmark?: string;
}

export interface IPatientProfile extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  /** Human-facing identifier, e.g. PAT-000241. */
  patientNumber: string;
  dateOfBirth?: Date;
  gender?: Gender;
  address?: IAddress;
  bloodGroup?: string;
  allergies?: string[];
  chronicConditions?: string[];
  emergencyContact?: {
    name?: string;
    relationship?: string;
    phone?: string;
  };
  /** Denormalised aggregates, recomputed when a booking/payment settles. */
  totalAppointments: number;
  totalSpentKobo: number;
  lastAppointmentAt?: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const AddressSchema = new Schema<IAddress>(
  {
    street: String,
    area: String,
    city: { type: String, default: 'Port Harcourt' },
    state: { type: String, default: 'Rivers' },
    landmark: String,
  },
  { _id: false },
);

const PatientProfileSchema = new Schema<IPatientProfile>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    patientNumber: { type: String, required: true, unique: true, index: true },
    dateOfBirth: Date,
    gender: { type: String, enum: GENDERS },
    address: AddressSchema,
    bloodGroup: String,
    allergies: [String],
    chronicConditions: [String],
    emergencyContact: {
      name: String,
      relationship: String,
      phone: String,
    },
    totalAppointments: { type: Number, default: 0 },
    totalSpentKobo: { type: Number, default: 0 },
    lastAppointmentAt: { type: Date, default: null },
    notes: String,
  },
  { timestamps: true },
);

PatientProfileSchema.index({ patientNumber: 'text' });
PatientProfileSchema.index({ lastAppointmentAt: -1 });

export const PatientProfile: Model<IPatientProfile> =
  (models.PatientProfile as Model<IPatientProfile>) ||
  model<IPatientProfile>('PatientProfile', PatientProfileSchema);

export default PatientProfile;
