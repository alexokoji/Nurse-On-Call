import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

export const BLOCK_TYPES = ['leave', 'holiday', 'training', 'blocked'] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/**
 * Time during which no booking may be made.
 * `staff: null` blocks the whole organisation (public holidays).
 * Omitting start/end blocks the entire day.
 */
export interface IBlockedSchedule extends Document {
  _id: Types.ObjectId;
  staff?: Types.ObjectId | null;
  type: BlockType;
  /** Inclusive range of "YYYY-MM-DD" keys. */
  startDateKey: string;
  endDateKey: string;
  /** Optional intra-day window; when absent the whole day is blocked. */
  startTime?: string;
  endTime?: string;
  reason?: string;
  approved: boolean;
  createdBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const BlockedScheduleSchema = new Schema<IBlockedSchedule>(
  {
    staff: { type: Schema.Types.ObjectId, ref: 'StaffProfile', default: null, index: true },
    type: { type: String, enum: BLOCK_TYPES, default: 'blocked', index: true },
    startDateKey: { type: String, required: true, index: true },
    endDateKey: { type: String, required: true, index: true },
    startTime: String,
    endTime: String,
    reason: String,
    approved: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

BlockedScheduleSchema.index({ staff: 1, startDateKey: 1, endDateKey: 1 });

export const BlockedSchedule: Model<IBlockedSchedule> =
  (models.BlockedSchedule as Model<IBlockedSchedule>) ||
  model<IBlockedSchedule>('BlockedSchedule', BlockedScheduleSchema);

export default BlockedSchedule;
