import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

/**
 * Roles are seeded from the catalogue in lib/permissions/catalogue.ts.
 * Storing them lets an operator tune a role's permission set without a deploy;
 * `isSystem` roles cannot be deleted, and super_admin always holds every
 * permission regardless of what is stored here.
 */
export interface IRole extends Document {
  _id: Types.ObjectId;
  /** Matches a UserRole key, e.g. "operations_manager". */
  key: string;
  name: string;
  description?: string;
  permissions: string[];
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoleSchema = new Schema<IRole>(
  {
    key: { type: String, required: true, unique: true, lowercase: true, index: true },
    name: { type: String, required: true },
    description: String,
    permissions: { type: [String], default: [] },
    isSystem: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Role: Model<IRole> = (models.Role as Model<IRole>) || model<IRole>('Role', RoleSchema);

export default Role;
