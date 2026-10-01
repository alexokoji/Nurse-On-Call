import type { PaymentProvider } from '@/types';

/**
 * The contract every gateway adapter implements.
 *
 * The booking system talks only to `PaymentService`, which talks only to this
 * interface — no Paystack/Flutterwave/Korapay specifics leak upward. Adding a
 * provider means writing one file and registering it.
 */

export interface InitializeParams {
  /** Our internal transaction reference; the gateway echoes it back. */
  reference: string;
  amountKobo: number;
  currency: string;
  email: string;
  name?: string;
  phone?: string;
  /** Where the gateway returns the user after payment. */
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}

export interface InitializeResult {
  ok: boolean;
  /** Hosted checkout URL to redirect the patient to. */
  authorizationUrl?: string;
  providerReference?: string;
  error?: string;
  raw?: unknown;
}

export interface VerifyResult {
  ok: boolean;
  /** True only when the gateway reports a completed, successful charge. */
  successful: boolean;
  /** Amount actually captured, in kobo, as reported by the gateway. */
  amountKobo: number;
  currency: string;
  providerReference?: string;
  channel?: string;
  fees?: number;
  paidAt?: Date;
  error?: string;
  raw?: unknown;
}

export interface RefundParams {
  /** The original transaction's provider reference. */
  providerReference: string;
  /** Our internal payment reference, for providers that key on it. */
  reference: string;
  amountKobo: number;
  reason?: string;
}

export interface RefundResult {
  ok: boolean;
  providerReference?: string;
  /** Some gateways settle refunds asynchronously. */
  pending?: boolean;
  error?: string;
  raw?: unknown;
}

export interface WebhookVerification {
  /** False when the signature does not match — the request must be rejected. */
  valid: boolean;
  event?: string;
  /** Our reference, extracted from the payload. */
  reference?: string;
  status?: 'successful' | 'failed' | 'pending' | 'refunded' | 'unknown';
  amountKobo?: number;
  providerReference?: string;
  raw?: unknown;
}

export interface PaymentGateway {
  readonly name: PaymentProvider;
  /** False when the provider's keys are absent, so it can be hidden in the UI. */
  isConfigured(): boolean;
  initialize(params: InitializeParams): Promise<InitializeResult>;
  verify(reference: string): Promise<VerifyResult>;
  refund(params: RefundParams): Promise<RefundResult>;
  /** Validates the signature and normalises the payload. */
  verifyWebhook(rawBody: string, headers: Headers): WebhookVerification;
}
