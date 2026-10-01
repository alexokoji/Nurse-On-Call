import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import { REFUND_STATUSES, type RefundStatus } from '@/types';

export interface IRefund extends Document {
  _id: Types.ObjectId;
  reference: string;
  payment: Types.ObjectId;
  booking: Types.ObjectId;
  patient: Types.ObjectId;

  amountKobo: number;
  reason: string;
  status: RefundStatus;

  requestedBy: Types.ObjectId;
  reviewedBy?: Types.ObjectId | null;
  reviewedAt?: Date | null;
  reviewNote?: string;

  providerReference?: string | null;
  providerResponse?: Record<string, unknown>;
  processedAt?: Date | null;
  failureReason?: string;

  createdAt: Date;
  updatedAt: Date;
}

const RefundSchema = new Schema<IRefund>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    amountKobo: { type: Number, required: true, min: 1 },
    reason: { type: String, required: true, maxlength: 1000 },
    status: { type: String, enum: REFUND_STATUSES, default: 'requested', index: true },

    requestedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: String,

    providerReference: { type: String, default: null },
    providerResponse: { type: Schema.Types.Mixed },
    processedAt: { type: Date, default: null },
    failureReason: String,
  },
  { timestamps: true },
);

RefundSchema.index({ status: 1, createdAt: -1 });

export const Refund: Model<IRefund> =
  (models.Refund as Model<IRefund>) || model<IRefund>('Refund', RefundSchema);

export default Refund;
