import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

export interface IPromotion extends Document {
  _id: Types.ObjectId;
  code: string;
  description?: string;
  type: 'percentage' | 'fixed';
  /** Percentage points for `percentage`, kobo for `fixed`. */
  value: number;
  /** Caps a percentage discount, in kobo. 0 = uncapped. */
  maxDiscountKobo: number;
  minSpendKobo: number;
  /** Empty means the code applies to every service. */
  services: Types.ObjectId[];
  startsAt?: Date | null;
  endsAt?: Date | null;
  usageLimit: number;
  usageCount: number;
  /** Per-patient cap. 0 = unlimited. */
  perPatientLimit: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const PromotionSchema = new Schema<IPromotion>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    description: String,
    type: { type: String, enum: ['percentage', 'fixed'], required: true },
    value: { type: Number, required: true, min: 0 },
    maxDiscountKobo: { type: Number, default: 0 },
    minSpendKobo: { type: Number, default: 0 },
    services: [{ type: Schema.Types.ObjectId, ref: 'Service' }],
    startsAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    usageLimit: { type: Number, default: 0 },
    usageCount: { type: Number, default: 0 },
    perPatientLimit: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const Promotion: Model<IPromotion> =
  (models.Promotion as Model<IPromotion>) || model<IPromotion>('Promotion', PromotionSchema);

export default Promotion;
