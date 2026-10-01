import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

/**
 * Immutable record of a patient agreeing to a policy. Consent is never
 * updated in place — withdrawing writes a new row with granted: false so the
 * history stays auditable (NDPR accountability).
 */
export interface IConsent extends Document {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  type: 'terms' | 'privacy' | 'treatment' | 'marketing' | 'data_processing';
  version: string;
  granted: boolean;
  grantedAt: Date;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ConsentSchema = new Schema<IConsent>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['terms', 'privacy', 'treatment', 'marketing', 'data_processing'],
      required: true,
    },
    version: { type: String, default: '1.0' },
    granted: { type: Boolean, default: true },
    grantedAt: { type: Date, default: () => new Date() },
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true },
);

ConsentSchema.index({ user: 1, type: 1, createdAt: -1 });

export const Consent: Model<IConsent> =
  (models.Consent as Model<IConsent>) || model<IConsent>('Consent', ConsentSchema);

export default Consent;
