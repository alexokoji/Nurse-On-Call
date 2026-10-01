import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';

export interface IHealthArticle extends Document {
  _id: Types.ObjectId;
  title: string;
  slug: string;
  excerpt: string;
  /** Markdown-ish body rendered as prose. */
  content: string;
  coverImage?: string;
  category: string;
  tags: string[];
  authorName: string;
  readMinutes: number;
  status: 'draft' | 'published';
  publishedAt?: Date | null;
  viewCount: number;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const HealthArticleSchema = new Schema<IHealthArticle>(
  {
    title: { type: String, required: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    excerpt: { type: String, required: true, maxlength: 400 },
    content: { type: String, required: true },
    coverImage: String,
    category: { type: String, default: 'General Health', index: true },
    tags: [String],
    authorName: { type: String, default: 'NurseOnCall Clinical Team' },
    readMinutes: { type: Number, default: 4 },
    status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
    publishedAt: { type: Date, default: null },
    viewCount: { type: Number, default: 0 },
    seo: {
      title: String,
      description: String,
      keywords: [String],
    },
  },
  { timestamps: true },
);

HealthArticleSchema.index({ title: 'text', excerpt: 'text' });
HealthArticleSchema.index({ status: 1, publishedAt: -1 });

export const HealthArticle: Model<IHealthArticle> =
  (models.HealthArticle as Model<IHealthArticle>) ||
  model<IHealthArticle>('HealthArticle', HealthArticleSchema);

export default HealthArticle;
