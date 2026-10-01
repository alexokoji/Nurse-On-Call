import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

export interface IAuditLog extends Document {
  _id: Types.ObjectId;
  actor?: Types.ObjectId | null;
  actorName: string;
  actorRole: string;

  /** Dotted verb, e.g. "booking.cancel", "payment.refund". */
  action: string;
  entity: string;
  entityId?: string;
  /** One-line summary rendered in the audit list. */
  summary: string;

  /** Only the fields that changed, redacted of secrets. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;

  ipAddress?: string;
  userAgent?: string;

  createdAt: Date;
  updatedAt: Date;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    actorName: { type: String, default: 'System' },
    actorRole: { type: String, default: 'system' },

    action: { type: String, required: true, index: true },
    entity: { type: String, required: true, index: true },
    entityId: { type: String, index: true },
    summary: { type: String, required: true },

    before: { type: Schema.Types.Mixed, default: null },
    after: { type: Schema.Types.Mixed, default: null },

    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true },
);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });

export const AuditLog: Model<IAuditLog> =
  (models.AuditLog as Model<IAuditLog>) || model<IAuditLog>('AuditLog', AuditLogSchema);

export default AuditLog;
