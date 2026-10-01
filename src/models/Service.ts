import { Schema, model, models, type Model, type Document, type Types } from 'mongoose';
import {
  SERVICE_STATUSES,
  SERVICE_TYPES,
  type ServiceStatus,
  type ServiceType,
} from '@/types';

export interface IServiceFaq {
  question: string;
  answer: string;
}

export interface IService extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  category: Types.ObjectId;
  shortDescription: string;
  description: string;
  image?: string;
  icon?: string;
  /** Base price in kobo. Money is always stored in minor units. */
  priceKobo: number;
  /** Home-visit surcharge in kobo, applied only for `home` bookings. */
  homeVisitSurchargeKobo: number;
  /** Minutes. Drives slot length in the availability engine. */
  durationMinutes: number;
  /** Minutes of clean-up/travel reserved after each appointment. */
  bufferMinutes: number;
  serviceType: ServiceType;
  whatsIncluded: string[];
  requirements: string[];
  preparation: string[];
  faqs: IServiceFaq[];
  status: ServiceStatus;
  isFeatured: boolean;
  /** Cached from approved reviews. */
  averageRating: number;
  reviewCount: number;
  bookingCount: number;
  seo?: {
    title?: string;
    description?: string;
    keywords?: string[];
  };
  createdAt: Date;
  updatedAt: Date;
}

const FaqSchema = new Schema<IServiceFaq>(
  { question: { type: String, required: true }, answer: { type: String, required: true } },
  { _id: false },
);

const ServiceSchema = new Schema<IService>(
  {
    name: { type: String, required: true, trim: true, maxlength: 140 },
    slug: { type: String, required: true, unique: true, lowercase: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: 'ServiceCategory', required: true, index: true },
    shortDescription: { type: String, required: true, maxlength: 240 },
    description: { type: String, required: true },
    image: String,
    icon: { type: String, default: 'stethoscope' },
    priceKobo: { type: Number, required: true, min: 0 },
    homeVisitSurchargeKobo: { type: Number, default: 0, min: 0 },
    durationMinutes: { type: Number, required: true, min: 5, default: 60 },
    bufferMinutes: { type: Number, default: 15, min: 0 },
    serviceType: { type: String, enum: SERVICE_TYPES, required: true, index: true },
    whatsIncluded: [String],
    requirements: [String],
    preparation: [String],
    faqs: { type: [FaqSchema], default: [] },
    status: { type: String, enum: SERVICE_STATUSES, default: 'draft', index: true },
    isFeatured: { type: Boolean, default: false, index: true },
    averageRating: { type: Number, default: 0 },
    reviewCount: { type: Number, default: 0 },
    bookingCount: { type: Number, default: 0 },
    seo: {
      title: String,
      description: String,
      keywords: [String],
    },
  },
  { timestamps: true },
);

ServiceSchema.index({ name: 'text', shortDescription: 'text', description: 'text' });
ServiceSchema.index({ status: 1, serviceType: 1, priceKobo: 1 });

/** Total price for a given delivery location, in kobo. */
ServiceSchema.methods.priceForLocation = function (location: string) {
  const self = this as IService;
  return location === 'home' ? self.priceKobo + self.homeVisitSurchargeKobo : self.priceKobo;
};

export const Service: Model<IService> =
  (models.Service as Model<IService>) || model<IService>('Service', ServiceSchema);

export default Service;
