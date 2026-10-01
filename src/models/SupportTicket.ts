import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import { TICKET_STATUSES, type TicketStatus } from '@/types';

export interface ITicketMessage {
  author: Types.ObjectId;
  authorName: string;
  isStaff: boolean;
  body: string;
  createdAt: Date;
}

export interface ISupportTicket extends Document {
  _id: Types.ObjectId;
  reference: string;
  patient: Types.ObjectId;
  subject: string;
  category: string;
  status: TicketStatus;
  priority: 'low' | 'normal' | 'high';
  relatedBooking?: Types.ObjectId | null;
  messages: ITicketMessage[];
  assignedTo?: Types.ObjectId | null;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TicketMessageSchema = new Schema<ITicketMessage>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorName: { type: String, required: true },
    isStaff: { type: Boolean, default: false },
    body: { type: String, required: true, maxlength: 4000 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
);

const SupportTicketSchema = new Schema<ISupportTicket>(
  {
    reference: { type: String, required: true, unique: true, index: true },
    patient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, maxlength: 200 },
    category: { type: String, default: 'general' },
    status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },
    priority: { type: String, enum: ['low', 'normal', 'high'], default: 'normal' },
    relatedBooking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    messages: { type: [TicketMessageSchema], default: [] },
    assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

SupportTicketSchema.index({ status: 1, createdAt: -1 });

export const SupportTicket: Model<ISupportTicket> =
  (models.SupportTicket as Model<ISupportTicket>) ||
  model<ISupportTicket>('SupportTicket', SupportTicketSchema);

export default SupportTicket;
