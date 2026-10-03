/**
 * Settings shapes and their code-level defaults.
 *
 * Deliberately free of `server-only` and of any database import, so the seed
 * script, tests and client components can all read the defaults. Anything
 * that touches Mongo lives in ./index.ts.
 */

export interface GeneralSettings {
  organisationName: string;
  tagline: string;
  logo: string;
  phone: string;
  supportEmail: string;
  address: string;
  website: string;
}

export interface BookingSettings {
  minimumNoticeHours: number;
  maximumAdvanceDays: number;
  defaultDurationMinutes: number;
  slotIntervalMinutes: number;
  paymentHoldMinutes: number;
  cancellationWindowHours: number;
  cancellationPolicy: string;
  allowSameDayBooking: boolean;
}

export interface BankTransferSettings {
  enabled: boolean;
  bankName: string;
  accountName: string;
  accountNumber: string;
  /** Shown to the patient alongside the account details. */
  instructions: string;
  /** How long the slot is held while the transfer is made and confirmed. */
  holdHours: number;
}

export interface PaymentSettings {
  defaultProvider: 'paystack' | 'flutterwave' | 'korapay';
  currency: string;
  enabledProviders: ('paystack' | 'flutterwave' | 'korapay')[];
  allowPayAtVisit: boolean;
  bankTransfer: BankTransferSettings;
}

export interface NotificationSettings {
  emailEnabled: boolean;
  smsEnabled: boolean;
  reminderHoursBefore: number;
  sendBookingConfirmation: boolean;
  sendPaymentReceipt: boolean;
}

export interface SeoSettings {
  siteTitle: string;
  siteDescription: string;
  keywords: string[];
  socialImage: string;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  maxFailedLogins: number;
  lockoutMinutes: number;
  requireEmailVerification: boolean;
}

export interface SettingsMap {
  general: GeneralSettings;
  booking: BookingSettings;
  payments: PaymentSettings;
  notifications: NotificationSettings;
  seo: SeoSettings;
  security: SecuritySettings;
}

export const DEFAULT_SETTINGS: SettingsMap = {
  general: {
    organisationName: 'NurseOnCall',
    tagline: 'Your Health, Our Priority',
    logo: '',
    phone: '0800 123 4567',
    supportEmail: 'care@nurseoncall.ng',
    address: '14 Aba Road, GRA Phase 2, Port Harcourt, Rivers State',
    website: 'https://nurseoncall.ng',
  },
  booking: {
    minimumNoticeHours: 4,
    maximumAdvanceDays: 90,
    defaultDurationMinutes: 60,
    slotIntervalMinutes: 30,
    paymentHoldMinutes: 30,
    cancellationWindowHours: 24,
    cancellationPolicy:
      'Appointments cancelled at least 24 hours before the scheduled time are refunded in full. ' +
      'Cancellations inside 24 hours are refunded at 50%. No-shows are not refunded.',
    allowSameDayBooking: true,
  },
  payments: {
    defaultProvider:
      (process.env.PAYMENT_DEFAULT_PROVIDER as PaymentSettings['defaultProvider']) ?? 'paystack',
    currency: 'NGN',
    enabledProviders: ['paystack', 'flutterwave', 'korapay'],
    allowPayAtVisit: false,
    /* Off until an administrator fills in the account, since an empty account
       number offered at checkout is worse than no option at all. */
    bankTransfer: {
      enabled: false,
      bankName: '',
      accountName: '',
      accountNumber: '',
      instructions:
        'Use your booking reference as the transfer narration so we can match your payment.',
      holdHours: 24,
    },
  },
  notifications: {
    emailEnabled: true,
    smsEnabled: false,
    reminderHoursBefore: 24,
    sendBookingConfirmation: true,
    sendPaymentReceipt: true,
  },
  seo: {
    siteTitle: 'NurseOnCall — Quality Healthcare, When You Need It',
    siteDescription:
      'Professional nursing, doctor consultations, physiotherapy, lab tests and medication ' +
      'delivery at home, in clinic or online across Port Harcourt and Rivers State.',
    keywords: [
      'home nursing Port Harcourt',
      'doctor consultation Nigeria',
      'physiotherapy Rivers State',
      'home lab tests',
      'medication delivery Port Harcourt',
    ],
    socialImage: '',
  },
  security: {
    sessionTimeoutMinutes: 10080,
    maxFailedLogins: 5,
    lockoutMinutes: 15,
    requireEmailVerification: false,
  },
};
