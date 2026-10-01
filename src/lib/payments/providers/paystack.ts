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

const API = 'https://api.paystack.co';

/** Paystack transacts in kobo, matching our storage unit — no conversion. */
export class PaystackProvider implements PaymentGateway {
  readonly name = 'paystack' as const;

  private get secret() {
    return process.env.PAYSTACK_SECRET_KEY ?? '';
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
    if (!this.isConfigured()) return { ok: false, error: 'Paystack is not configured.' };

    try {
      const response = await fetch(`${API}/transaction/initialize`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          email: params.email,
          amount: params.amountKobo,
          currency: params.currency,
          reference: params.reference,
          callback_url: params.callbackUrl,
          metadata: {
            ...params.metadata,
            custom_fields: [
              { display_name: 'Patient', variable_name: 'patient', value: params.name ?? '' },
            ],
          },
        }),
      });

      const payload = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: { authorization_url: string; reference: string };
      };

      if (!response.ok || !payload.status || !payload.data) {
        return { ok: false, error: payload.message ?? 'Unable to start the payment.', raw: payload };
      }

      return {
        ok: true,
        authorizationUrl: payload.data.authorization_url,
        providerReference: payload.data.reference,
        raw: payload,
      };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  }

  async verify(reference: string): Promise<VerifyResult> {
    if (!this.isConfigured()) {
      return { ok: false, successful: false, amountKobo: 0, currency: 'NGN', error: 'Paystack is not configured.' };
    }

    try {
      const response = await fetch(`${API}/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: this.headers(),
        cache: 'no-store',
      });

      const payload = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: {
          status: string;
          amount: number;
          currency: string;
          reference: string;
          channel?: string;
          fees?: number;
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
        amountKobo: data.amount,
        currency: data.currency,
        providerReference: data.reference,
        channel: data.channel,
        fees: data.fees,
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
    if (!this.isConfigured()) return { ok: false, error: 'Paystack is not configured.' };

    try {
      const response = await fetch(`${API}/refund`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          transaction: params.providerReference || params.reference,
          amount: params.amountKobo,
          merchant_note: params.reason,
        }),
      });

      const payload = (await response.json()) as {
        status: boolean;
        message?: string;
        data?: { id: number; status: string };
      };

      if (!response.ok || !payload.status) {
        return { ok: false, error: payload.message ?? 'Refund request failed.', raw: payload };
      }

      return {
        ok: true,
        providerReference: payload.data ? String(payload.data.id) : undefined,
        // Paystack settles refunds asynchronously; the webhook confirms.
        pending: payload.data?.status !== 'processed',
        raw: payload,
      };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  }

  /**
   * Paystack signs the raw body with HMAC-SHA512 using the secret key.
   * The body must be the exact bytes received — re-serialising JSON changes
   * the digest and every event would be rejected.
   */
  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification {
    const signature = headers.get('x-paystack-signature');
    if (!signature || !this.isConfigured()) return { valid: false };

    const expected = createHmac('sha512', this.secret).update(rawBody).digest('hex');
    if (!safeEqual(expected, signature)) return { valid: false };

    try {
      const payload = JSON.parse(rawBody) as {
        event: string;
        data: { reference: string; status: string; amount: number; id?: number };
      };

      return {
        valid: true,
        event: payload.event,
        reference: payload.data?.reference,
        status: mapStatus(payload.event, payload.data?.status),
        amountKobo: payload.data?.amount,
        providerReference: payload.data?.id ? String(payload.data.id) : payload.data?.reference,
        raw: payload,
      };
    } catch {
      return { valid: false };
    }
  }
}

function mapStatus(event: string, status?: string): WebhookVerification['status'] {
  if (event === 'charge.success' || status === 'success') return 'successful';
  if (event.startsWith('refund')) return 'refunded';
  if (status === 'failed') return 'failed';
  if (status === 'pending' || status === 'ongoing') return 'pending';
  return 'unknown';
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
