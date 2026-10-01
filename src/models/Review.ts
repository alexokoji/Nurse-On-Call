import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import { REVIEW_STATUSES, type ReviewStatus } from '@/types';

export interface IReview extends Document {
  _id: Types.ObjectId;
  patient: Types.ObjectId;
  booking: Types.ObjectId;
  service: Types.ObjectId;
  staff?: Types.ObjectId | null;

  rating: number;
  title?: string;
  comment: string;
  status: ReviewStatus;

  moderatedBy?: Types.ObjectId | null;
  moderatedAt?: Date | null;
  /** Optional public response from the organisation. */
  response?: string;

  createdAt: Date;
  updatedAt: Date;
}

const ReviewSchema = new Schema<IReview>(
  {
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    // One review per completed booking.
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
    service: { type: Schema.Types.ObjectId, ref: 'Service', required: true, index: true },
    staff: { type: Schema.Types.ObjectId, ref: 'StaffProfile', default: null, index: true },

    rating: { type: Number, required: true, min: 1, max: 5 },
    title: { type: String, maxlength: 140 },
    comment: { type: String, required: true, maxlength: 2000 },
    status: { type: String, enum: REVIEW_STATUSES, default: 'pending', index: true },

    moderatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    moderatedAt: { type: Date, default: null },
    response: String,
  },
  { timestamps: true },
);

ReviewSchema.index({ status: 1, createdAt: -1 });
ReviewSchema.index({ service: 1, status: 1 });

export const Review: Model<IReview> =
  (models.Review as Model<IReview>) || model<IReview>('Review', ReviewSchema);

export default Review;
