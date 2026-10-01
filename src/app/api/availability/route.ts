import type { NextRequest } from 'next/server';
import { getAvailability } from '@/lib/bookings/availability';
import { expireStaleHolds } from '@/lib/bookings/service';
import { availabilityQuerySchema } from '@/lib/validations/booking';
import { apiSuccess, handleApiError } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * GET /api/availability
 *
 * Public: a visitor must be able to see when we are free before creating an
 * account. It reveals only slot times and internal staff ids — never patient
 * data — and returns unavailable slots too, so the calendar reads honestly.
 */
export async function GET(request: NextRequest) {
  try {
    const params = availabilityQuerySchema.parse({
      serviceId: request.nextUrl.searchParams.get('serviceId'),
      dateKey: request.nextUrl.searchParams.get('dateKey'),
      locationType: request.nextUrl.searchParams.get('locationType'),
      staffId: request.nextUrl.searchParams.get('staffId') ?? undefined,
    });

    // Release slots held by abandoned checkouts before reporting availability,
    // so a stalled payment cannot keep a slot blocked indefinitely.
    await expireStaleHolds();

    const availability = await getAvailability(params);
    return apiSuccess(availability);
  } catch (error) {
    return handleApiError(error, 'availability');
  }
}
