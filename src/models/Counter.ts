import { Schema, model, models, type Model, type Document } from 'mongoose';

/**
 * Atomic sequence source for human-facing references (APT-000248, PAT-000031).
 * findOneAndUpdate with $inc is atomic in MongoDB, so two concurrent bookings
 * can never receive the same number.
 */
export interface ICounter extends Document<string> {
  _id: string;
  seq: number;
}

const CounterSchema = new Schema<ICounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const Counter: Model<ICounter> =
  (models.Counter as Model<ICounter>) || model<ICounter>('Counter', CounterSchema);

export type CounterKey = 'booking' | 'patient' | 'staff' | 'payment' | 'refund' | 'invoice' | 'ticket';

const PREFIX: Record<CounterKey, string> = {
  booking: 'APT',
  patient: 'PAT',
  staff: 'STF',
  payment: 'TXN',
  refund: 'RFD',
  invoice: 'RCP',
  ticket: 'TKT',
};

/** Next reference in the sequence, e.g. "APT-000248". */
export async function nextReference(key: CounterKey, padding = 6): Promise<string> {
  const counter = await Counter.findByIdAndUpdate(
    key,
    { $inc: { seq: 1 } },
    { new: true, upsert: true },
  ).lean<{ seq: number }>();

  const seq = counter?.seq ?? 1;
  return `${PREFIX[key]}-${String(seq).padStart(padding, '0')}`;
}

export default Counter;
