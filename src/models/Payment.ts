import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import {
  PAYMENT_PROVIDERS,
  PAYMENT_STATUSES,
  type PaymentProvider,
  type PaymentStatus,
} from '@/types';

export interface IPayment extends Document {
  _id: Types.ObjectId;
  /** Internal transaction reference we generate and send to the gateway. */
  reference: string;
  booking: Types.ObjectId;
  patient: Types.ObjectId;

  provider: PaymentProvider;
  /** Gateway's own id/reference, captured on verification. */
  providerReference?: string | null;
  /** Full verification payload, kept for dispute resolution. */
  providerResponse?: Record<string, unknown>;

  amountKobo: number;
  currency: string;
  /** Set from the verified gateway response, never from the client. */
  amountPaidKobo: number;
  channel?: string;
  fees?: number;

  status: PaymentStatus;
  paidAt?: Date | null;
  failureReason?: string;

  /** Total refunded so far, in kobo. */
  refundedKobo: number;

  /** True once a signed webhook has independently confirmed this payment. */
  webhookVerifiedAt?: Date | null;
  verifiedAt?: Date | null;

  authorizationUrl?: string;
  metadata?: Record<string, unknown>;

  createdAt: Date;
  updatedAt: Date;
}

const PaymentSchema = new Schema<IPayment>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true, index: true },
    providerReference: { type: String, default: null, index: true },
    providerResponse: { type: Schema.Types.Mixed },

    amountKobo: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'NGN' },
    amountPaidKobo: { type: Number, default: 0, min: 0 },
    channel: String,
    fees: Number,

    status: { type: String, enum: PAYMENT_STATUSES, default: 'pending', index: true },
    paidAt: { type: Date, default: null },
    failureReason: String,

    refundedKobo: { type: Number, default: 0, min: 0 },

    webhookVerifiedAt: { type: Date, default: null },
    verifiedAt: { type: Date, default: null },

    authorizationUrl: String,
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);

PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ provider: 1, status: 1 });
/** Revenue aggregations scan successful payments by settlement date. */
PaymentSchema.index({ status: 1, paidAt: -1 });

export const Payment: Model<IPayment> =
  (models.Payment as Model<IPayment>) || model<IPayment>('Payment', PaymentSchema);

export default Payment;
