import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getGateway, verifyPayment } from '@/lib/payments/service';
import { PAYMENT_PROVIDERS, type PaymentProvider } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/payments/webhook/{paystack|flutterwave|korapay}
 *
 * The independent confirmation channel. A payment is only trusted once this
 * has fired *or* server-side verification has succeeded — the browser
 * redirect alone never confirms anything.
 *
 * Three rules matter here:
 *
 *   1. The raw request body is read as text and passed to the adapter
 *      untouched. Parsing and re-serialising JSON changes the bytes and
 *      breaks every HMAC signature check.
 *   2. An invalid signature returns 401 and does nothing. Anyone can POST to
 *      this URL; only the gateway can sign for it.
 *   3. We respond 200 to anything we have successfully received, even events
 *      we ignore. Gateways retry non-2xx responses aggressively, and a retry
 *      storm over an event we do not care about helps nobody.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> },
) {
  const { provider } = await params;

  if (!PAYMENT_PROVIDERS.includes(provider as PaymentProvider) || provider === 'manual') {
    return NextResponse.json({ error: 'Unknown provider' }, { status: 404 });
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: 'Unreadable body' }, { status: 400 });
  }

  const gateway = getGateway(provider as PaymentProvider);
  const verification = gateway.verifyWebhook(rawBody, request.headers);

  if (!verification.valid) {
    console.warn(`[webhook:${provider}] rejected an unsigned or mis-signed request`);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  if (!verification.reference) {
    // Signed, but not about a transaction we track (e.g. a settlement event).
    return NextResponse.json({ received: true, ignored: true });
  }

  try {
    if (verification.status === 'successful') {
      // Re-verify against the gateway API rather than trusting the payload's
      // amount — the signature proves origin, not that the body matches the
      // authoritative record.
      const outcome = await verifyPayment({
        reference: verification.reference,
        viaWebhook: true,
      });

      console.info(
        `[webhook:${provider}] ${verification.reference} settled as ${outcome.status}`,
      );
    } else {
      console.info(
        `[webhook:${provider}] ${verification.reference} reported as ${verification.status}`,
      );
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Log and still return 200: the payment is recoverable through the
    // verify endpoint, and retries would not change the outcome.
    console.error(`[webhook:${provider}] processing failed`, error);
    return NextResponse.json({ received: true, processed: false });
  }
}

/** Some gateways probe the endpoint with GET before enabling it. */
export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
