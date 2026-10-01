import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';
import type {
  InitializeParams,
  InitializeResult,
  PaymentGateway,
  RefundParams,
  RefundResult,
  VerifyResult,
  WebhookVerification,
} from '../types';

const API = 'https://api.korapay.com/merchant/api/v1';

/** Korapay quotes amounts in major units and signs webhooks over `data`. */
export class KorapayProvider implements PaymentGateway {
  readonly name = 'korapay' as const;

  private get secret() {
    return process.env.KORAPAY_SECRET_KEY ?? '';
  }

  isConfigured() {
    return this.secret.length > 0;
  }

  private headers() {
    return {
      Authorization: `Bearer ${this.secret}`,
      'Content-Type': 'application/json',
    };
  }

  async initialize(params: InitializeParams): Promise<InitializeResult> {
    if (!this.isConfigured()) return { ok: false, error: 'Korapay is not configured.' };

    try {
      const response = await fetch(`${API}/charges/initialize`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          reference: params.reference,
          amount: params.amountKobo / 100,
          currency: params.currency,
          redirect_url: params.callbackUrl,
          notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/webhook/korapay`,
          customer: { email: params.email, name: params.name },
          merchant_bears_cost: true,
          metadata: params.metadata,
        }),
      });

      const payload = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: { checkout_url: string; reference: string };
      };

      if (!response.ok || !payload.status || !payload.data) {
        return { ok: false, error: payload.message ?? 'Unable to start the payment.', raw: payload };
      }

      return {
        ok: true,
        authorizationUrl: payload.data.checkout_url,
        providerReference: payload.data.reference,
        raw: payload,
      };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  }

  async verify(reference: string): Promise<VerifyResult> {
    if (!this.isConfigured()) {
      return {
        ok: false,
        successful: false,
        amountKobo: 0,
        currency: 'NGN',
        error: 'Korapay is not configured.',
      };
    }

    try {
      const response = await fetch(`${API}/charges/${encodeURIComponent(reference)}`, {
        headers: this.headers(),
        cache: 'no-store',
      });

      const payload = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: {
          status: string;
          amount: number | string;
          currency: string;
          reference: string;
          payment_method?: string;
          fee?: number | string;
          paid_at?: string;
        };
      };

      if (!response.ok || !payload.status || !payload.data) {
        return {
          ok: false,
          successful: false,
          amountKobo: 0,
          currency: 'NGN',
          error: payload.message ?? 'Verification failed.',
          raw: payload,
        };
      }

      const data = payload.data;
      return {
        ok: true,
        successful: data.status === 'success',
        amountKobo: Math.round(Number(data.amount) * 100),
        currency: data.currency,
        providerReference: data.reference,
        channel: data.payment_method,
        fees: data.fee ? Math.round(Number(data.fee) * 100) : undefined,
        paidAt: data.paid_at ? new Date(data.paid_at) : undefined,
        raw: payload,
      };
    } catch (error) {
      return {
        ok: false,
        successful: false,
        amountKobo: 0,
        currency: 'NGN',
        error: toMessage(error),
      };
    }
  }

  async refund(params: RefundParams): Promise<RefundResult> {
    if (!this.isConfigured()) return { ok: false, error: 'Korapay is not configured.' };

    try {
      const response = await fetch(`${API}/charges/refund`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          transaction_reference: params.providerReference || params.reference,
          amount: params.amountKobo / 100,
          reason: params.reason,
        }),
      });

      const payload = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: { reference?: string; status?: string };
      };

      if (!response.ok || !payload.status) {
        return { ok: false, error: payload.message ?? 'Refund request failed.', raw: payload };
      }

      return {
        ok: true,
        providerReference: payload.data?.reference,
        pending: payload.data?.status !== 'success',
        raw: payload,
      };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  }

  /** HMAC-SHA256 of the JSON-encoded `data` object, using the secret key. */
  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification {
    const signature = headers.get('x-korapay-signature');
    if (!signature || !this.isConfigured()) return { valid: false };

    try {
      const payload = JSON.parse(rawBody) as {
        event?: string;
        data?: {
          reference?: string;
          status?: string;
          amount?: number | string;
          transaction_reference?: string;
        };
      };

      const expected = createHmac('sha256', this.secret)
        .update(JSON.stringify(payload.data ?? {}))
        .digest('hex');

      if (!safeEqual(expected, signature)) return { valid: false };

      const event = payload.event ?? '';
      const status = payload.data?.status;

      return {
        valid: true,
        event,
        reference: payload.data?.reference,
        status:
          event === 'charge.success' || status === 'success'
            ? 'successful'
            : event === 'charge.failed' || status === 'failed'
              ? 'failed'
              : 'unknown',
        amountKobo: payload.data?.amount ? Math.round(Number(payload.data.amount) * 100) : undefined,
        providerReference: payload.data?.transaction_reference,
        raw: payload,
      };
    } catch {
      return { valid: false };
    }
  }
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unexpected payment gateway error.';
}
