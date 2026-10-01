import 'server-only';
import { connectDB } from '@/lib/db/connect';
import { Promotion, Booking } from '@/models';
import type { LocationType } from '@/types';

/**
 * Server-side price calculation.
 *
 * The client never sends money. It sends a service, a location and possibly a
 * promotion code; every figure below is derived here from stored records.
 */

export interface PriceBreakdown {
  servicePriceKobo: number;
  surchargeKobo: number;
  discountKobo: number;
  totalKobo: number;
  promotionCode: string | null;
  /** Set when a supplied code was rejected, for a clear message in the UI. */
  promotionError?: string;
}

export async function calculatePrice(params: {
  service: { _id: unknown; priceKobo: number; homeVisitSurchargeKobo: number };
  locationType: LocationType;
  promotionCode?: string | null;
  patientId?: string | null;
}): Promise<PriceBreakdown> {
  const { service, locationType, promotionCode, patientId } = params;

  const servicePriceKobo = service.priceKobo;
  const surchargeKobo = locationType === 'home' ? (service.homeVisitSurchargeKobo ?? 0) : 0;
  const subtotal = servicePriceKobo + surchargeKobo;

  const base: PriceBreakdown = {
    servicePriceKobo,
    surchargeKobo,
    discountKobo: 0,
    totalKobo: subtotal,
    promotionCode: null,
  };

  if (!promotionCode?.trim()) return base;

  const evaluation = await evaluatePromotion({
    code: promotionCode.trim().toUpperCase(),
    subtotal,
    serviceId: String(service._id),
    patientId,
  });

  if (!evaluation.ok) {
    return { ...base, promotionError: evaluation.reason };
  }

  return {
    ...base,
    discountKobo: evaluation.discountKobo,
    totalKobo: Math.max(0, subtotal - evaluation.discountKobo),
    promotionCode: evaluation.code,
  };
}

type PromotionResult =
  | { ok: true; code: string; discountKobo: number }
  | { ok: false; reason: string };

export async function evaluatePromotion(params: {
  code: string;
  subtotal: number;
  serviceId: string;
  patientId?: string | null;
}): Promise<PromotionResult> {
  await connectDB();

  const promotion = await Promotion.findOne({ code: params.code, isActive: true });
  if (!promotion) return { ok: false, reason: 'That promotion code is not valid.' };

  const now = new Date();
  if (promotion.startsAt && promotion.startsAt > now) {
    return { ok: false, reason: 'That promotion has not started yet.' };
  }
  if (promotion.endsAt && promotion.endsAt < now) {
    return { ok: false, reason: 'That promotion has expired.' };
  }
  if (promotion.usageLimit > 0 && promotion.usageCount >= promotion.usageLimit) {
    return { ok: false, reason: 'That promotion has been fully claimed.' };
  }
  if (promotion.minSpendKobo > params.subtotal) {
    return { ok: false, reason: 'This booking does not meet the minimum spend for that code.' };
  }
  if (
    promotion.services.length > 0 &&
    !promotion.services.some((id) => String(id) === params.serviceId)
  ) {
    return { ok: false, reason: 'That code does not apply to this service.' };
  }

  if (params.patientId && promotion.perPatientLimit > 0) {
    const used = await Booking.countDocuments({
      patient: params.patientId,
      promotionCode: promotion.code,
      status: { $nin: ['cancelled', 'expired'] },
    });
    if (used >= promotion.perPatientLimit) {
      return { ok: false, reason: 'You have already used that promotion code.' };
    }
  }

  let discountKobo =
    promotion.type === 'percentage'
      ? Math.round((params.subtotal * promotion.value) / 100)
      : promotion.value;

  if (promotion.maxDiscountKobo > 0) {
    discountKobo = Math.min(discountKobo, promotion.maxDiscountKobo);
  }
  // Never discount below zero.
  discountKobo = Math.min(discountKobo, params.subtotal);

  return { ok: true, code: promotion.code, discountKobo };
}

/**
 * Refund due for a cancellation, per the configured policy.
 * Outside the window: full refund. Inside it: half. After the appointment
 * started or for a no-show: nothing.
 */
export function refundableAmount(params: {
  paidKobo: number;
  startAt: Date;
  cancellationWindowHours: number;
  now?: Date;
}): number {
  const now = params.now ?? new Date();
  const hoursUntil = (params.startAt.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (hoursUntil <= 0) return 0;
  if (hoursUntil >= params.cancellationWindowHours) return params.paidKobo;
  return Math.round(params.paidKobo / 2);
}
