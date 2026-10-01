import 'server-only';
import { timingSafeEqual } from 'crypto';
import type {
  InitializeParams,
  InitializeResult,
  PaymentGateway,
  RefundParams,
  RefundResult,
  VerifyResult,
  WebhookVerification,
} from '../types';

const API = 'https://api.flutterwave.com/v3';

/**
 * Flutterwave quotes amounts in *major* units (naira), unlike Paystack.
 * All conversion is contained in this adapter so the rest of the system keeps
 * working in kobo.
 */
export class FlutterwaveProvider implements PaymentGateway {
  readonly name = 'flutterwave' as const;

  private get secret() {
    return process.env.FLUTTERWAVE_SECRET_KEY ?? '';
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
    if (!this.isConfigured()) return { ok: false, error: 'Flutterwave is not configured.' };

    try {
      const response = await fetch(`${API}/payments`, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          tx_ref: params.reference,
          amount: params.amountKobo / 100,
          currency: params.currency,
          redirect_url: params.callbackUrl,
          customer: {
            email: params.email,
            name: params.name,
            phonenumber: params.phone,
          },
          meta: params.metadata,
          customizations: {
            title: 'NurseOnCall',
            description: 'Healthcare appointment payment',
          },
        }),
      });

      const payload = (await response.json()) as {
        status: string;
        message?: string;
        data?: { link: string };
      };

      if (!response.ok || payload.status !== 'success' || !payload.data) {
        return { ok: false, error: payload.message ?? 'Unable to start the payment.', raw: payload };
      }

      return { ok: true, authorizationUrl: payload.data.link, raw: payload };
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
        error: 'Flutterwave is not configured.',
      };
    }

    try {
      // verify_by_reference looks the charge up by *our* tx_ref.
      const response = await fetch(
        `${API}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`,
        { headers: this.headers(), cache: 'no-store' },
      );

      const payload = (await response.json()) as {
        status: string;
        message?: string;
        data?: {
          status: string;
          amount: number;
          currency: string;
          id: number;
          payment_type?: string;
          app_fee?: number;
          created_at?: string;
        };
      };

      if (!response.ok || payload.status !== 'success' || !payload.data) {
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
        successful: data.status === 'successful',
        amountKobo: Math.round(data.amount * 100),
        currency: data.currency,
        providerReference: String(data.id),
        channel: data.payment_type,
        fees: data.app_fee ? Math.round(data.app_fee * 100) : undefined,
        paidAt: data.created_at ? new Date(data.created_at) : undefined,
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
    if (!this.isConfigured()) return { ok: false, error: 'Flutterwave is not configured.' };

    try {
      const response = await fetch(
        `${API}/transactions/${encodeURIComponent(params.providerReference)}/refund`,
        {
          method: 'POST',
          headers: this.headers(),
          body: JSON.stringify({ amount: params.amountKobo / 100, comments: params.reason }),
        },
      );

      const payload = (await response.json()) as {
        status: string;
        message?: string;
        data?: { id: number; status: string };
      };

      if (!response.ok || payload.status !== 'success') {
        return { ok: false, error: payload.message ?? 'Refund request failed.', raw: payload };
      }

      return {
        ok: true,
        providerReference: payload.data ? String(payload.data.id) : undefined,
        pending: payload.data?.status !== 'completed',
        raw: payload,
      };
    } catch (error) {
      return { ok: false, error: toMessage(error) };
    }
  }

  /**
   * Flutterwave sends a shared secret verbatim in `verif-hash` rather than a
   * signature over the body. It is compared in constant time all the same.
   */
  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification {
    const provided = headers.get('verif-hash');
    const expected = process.env.FLUTTERWAVE_WEBHOOK_HASH;

    if (!provided || !expected || !safeEqual(provided, expected)) return { valid: false };

    try {
      const payload = JSON.parse(rawBody) as {
        event?: string;
        data?: { tx_ref?: string; status?: string; amount?: number; id?: number };
      };

      const status = payload.data?.status;
      return {
        valid: true,
        event: payload.event,
        reference: payload.data?.tx_ref,
        status:
          status === 'successful'
            ? 'successful'
            : status === 'failed'
              ? 'failed'
              : status === 'pending'
                ? 'pending'
                : 'unknown',
        amountKobo: payload.data?.amount ? Math.round(payload.data.amount * 100) : undefined,
        providerReference: payload.data?.id ? String(payload.data.id) : undefined,
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
