import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

/**
 * Organisation settings, stored as one document per group so a section can be
 * updated without read-modify-write races across unrelated settings.
 * Secrets (gateway keys, SMTP passwords) stay in environment variables and are
 * never written here.
 */
export type SettingGroup = 'general' | 'booking' | 'payments' | 'notifications' | 'seo' | 'security';

export interface ISetting extends Document {
  _id: Types.ObjectId;
  group: SettingGroup;
  values: Record<string, unknown>;
  updatedBy?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const SettingSchema = new Schema<ISetting>(
  {
    group: {
      type: String,
      enum: ['general', 'booking', 'payments', 'notifications', 'seo', 'security'],
      required: true,
      unique: true,
      index: true,
    },
    values: { type: Schema.Types.Mixed, default: {} },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

export const Setting: Model<ISetting> =
  (models.Setting as Model<ISetting>) || model<ISetting>('Setting', SettingSchema);

export default Setting;
