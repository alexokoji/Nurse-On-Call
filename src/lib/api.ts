import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { AuthError } from '@/lib/auth/guards';
import { BookingError } from '@/lib/bookings/service';
import { PaymentError } from '@/lib/payments/service';

/**
 * One place that turns a thrown error into a client-safe HTTP response.
 *
 * Known domain errors carry a message written for a patient to read. Anything
 * else is logged server-side and returned as a generic 500 — stack traces,
 * Mongo errors and gateway internals never reach the browser.
 */

export interface ApiErrorBody {
  error: string;
  code?: string;
  fieldErrors?: Record<string, string[]>;
}

export function apiSuccess<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function apiError(message: string, status = 400, extra?: Partial<ApiErrorBody>) {
  return NextResponse.json({ error: message, ...extra }, { status });
}

export function handleApiError(error: unknown, context: string): NextResponse<ApiErrorBody> {
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: 'Please check the highlighted fields and try again.',
        code: 'VALIDATION',
        fieldErrors: error.flatten().fieldErrors as Record<string, string[]>,
      },
      { status: 422 },
    );
  }

  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message, code: 'AUTH' }, { status: error.status });
  }

  if (error instanceof BookingError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'FORBIDDEN'
          ? 403
          : error.code === 'SLOT_TAKEN' || error.code === 'CONFLICT'
            ? 409
            : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  if (error instanceof PaymentError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'CONFLICT'
          ? 409
          : error.code === 'GATEWAY'
            ? 502
            : 400;
    return NextResponse.json({ error: error.message, code: error.code }, { status });
  }

  // Unexpected: log everything we have, disclose nothing.
  console.error(`[api:${context}]`, error);
  return NextResponse.json(
    { error: 'Something went wrong on our side. Please try again shortly.', code: 'INTERNAL' },
    { status: 500 },
  );
}
