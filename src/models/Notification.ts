import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_STATUSES,
  NOTIFICATION_TEMPLATES,
  type NotificationChannel,
  type NotificationStatus,
  type NotificationTemplate,
} from '@/types';

export interface INotification extends Document {
  _id: Types.ObjectId;
  /** Null for broadcasts that were not addressed to a specific account. */
  recipient?: Types.ObjectId | null;
  /** Snapshot of the destination at send time. */
  recipientEmail?: string;
  recipientPhone?: string;

  channel: NotificationChannel;
  template: NotificationTemplate;
  subject: string;
  body: string;

  status: NotificationStatus;
  sentAt?: Date | null;
  readAt?: Date | null;
  failureReason?: string;

  /** Deep link opened when an in-app notification is clicked. */
  link?: string;
  relatedBooking?: Types.ObjectId | null;
  /** Groups every message produced by one bulk send. */
  batchId?: string | null;
  sentBy?: Types.ObjectId | null;

  createdAt: Date;
  updatedAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    recipientEmail: String,
    recipientPhone: String,

    channel: { type: String, enum: NOTIFICATION_CHANNELS, required: true, index: true },
    template: { type: String, enum: NOTIFICATION_TEMPLATES, default: 'custom', index: true },
    subject: { type: String, required: true },
    body: { type: String, required: true },

    status: { type: String, enum: NOTIFICATION_STATUSES, default: 'queued', index: true },
    sentAt: { type: Date, default: null },
    readAt: { type: Date, default: null },
    failureReason: String,

    link: String,
    relatedBooking: { type: Schema.Types.ObjectId, ref: 'Booking', default: null },
    batchId: { type: String, default: null, index: true },
    sentBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

NotificationSchema.index({ recipient: 1, readAt: 1, createdAt: -1 });
NotificationSchema.index({ createdAt: -1 });

export const Notification: Model<INotification> =
  (models.Notification as Model<INotification>) ||
  model<INotification>('Notification', NotificationSchema);

export default Notification;
