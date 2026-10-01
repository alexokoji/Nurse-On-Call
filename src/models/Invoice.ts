import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

export interface IInvoiceLine {
  description: string;
  quantity: number;
  unitPriceKobo: number;
  totalKobo: number;
}

export interface IInvoice extends Document {
  _id: Types.ObjectId;
  /** Receipt number, e.g. RCP-000112. */
  number: string;
  booking: Types.ObjectId;
  payment: Types.ObjectId;
  patient: Types.ObjectId;

  lines: IInvoiceLine[];
  subtotalKobo: number;
  discountKobo: number;
  totalKobo: number;
  currency: string;

  issuedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvoiceLineSchema = new Schema<IInvoiceLine>(
  {
    description: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    unitPriceKobo: { type: Number, required: true },
    totalKobo: { type: Number, required: true },
  },
  { _id: false },
);

const InvoiceSchema = new Schema<IInvoice>(
  {
    number: { type: String, required: true, unique: true, index: true },
    booking: { type: Schema.Types.ObjectId, ref: 'Booking', required: true, index: true },
    payment: { type: Schema.Types.ObjectId, ref: 'Payment', required: true, unique: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    lines: { type: [InvoiceLineSchema], default: [] },
    subtotalKobo: { type: Number, required: true },
    discountKobo: { type: Number, default: 0 },
    totalKobo: { type: Number, required: true },
    currency: { type: String, default: 'NGN' },

    issuedAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
);

export const Invoice: Model<IInvoice> =
  (models.Invoice as Model<IInvoice>) || model<IInvoice>('Invoice', InvoiceSchema);

export default Invoice;
