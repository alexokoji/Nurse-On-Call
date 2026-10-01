import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

/**
 * A one-off override of a staff member's recurring working hours
 * (StaffProfile.workingHours). Used for extra shifts or a shortened day.
 * Blocked time — leave, holidays — lives in BlockedSchedule.
 */
export interface IAvailability extends Document {
  _id: Types.ObjectId;
  staff: Types.ObjectId;
  /** "YYYY-MM-DD" */
  dateKey: string;
  start: string;
  end: string;
  note?: string;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const AvailabilitySchema = new Schema<IAvailability>(
  {
    staff: { type: Schema.Types.ObjectId, ref: 'StaffProfile', required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    start: { type: String, required: true },
    end: { type: String, required: true },
    note: String,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

AvailabilitySchema.index({ staff: 1, dateKey: 1 });

export const Availability: Model<IAvailability> =
  (models.Availability as Model<IAvailability>) ||
  model<IAvailability>('Availability', AvailabilitySchema);

export default Availability;
