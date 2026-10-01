import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

export interface IServiceCategory extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  icon: string;
  /** Tailwind accent token used by cards and badges, e.g. "teal". */
  accent: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ServiceCategorySchema = new Schema<IServiceCategory>(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    description: String,
    icon: { type: String, default: 'heart-pulse' },
    accent: { type: String, default: 'crimson' },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true },
);

export const ServiceCategory: Model<IServiceCategory> =
  (models.ServiceCategory as Model<IServiceCategory>) ||
  model<IServiceCategory>('ServiceCategory', ServiceCategorySchema);

export default ServiceCategory;
