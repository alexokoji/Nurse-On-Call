'use server';

import { revalidatePath } from 'next/cache';
import { apiRequirePermission, AuthError } from '@/lib/auth/guards';
import { saveSettings } from '@/lib/settings';
import {
  bookingSettingsSchema,
  generalSettingsSchema,
  notificationSettingsSchema,
  paymentSettingsSchema,
  securitySettingsSchema,
  seoSettingsSchema,
} from '@/lib/validations/admin';
import { recordAudit } from '@/lib/audit';
import type { SettingGroup } from '@/models/Setting';
import type { ActionResult } from '@/types';

/**
 * Settings are saved one group at a time, so two people editing different
 * sections cannot clobber each other. Secrets (gateway keys, SMTP passwords)
 * are never accepted here — those stay in environment variables.
 */

const SCHEMAS = {
  general: generalSettingsSchema,
  booking: bookingSettingsSchema,
  payments: paymentSettingsSchema,
  notifications: notificationSettingsSchema,
  seo: seoSettingsSchema,
  security: securitySettingsSchema,
} as const;

export async function saveSettingsAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  try {
    const user = await apiRequirePermission('settings.manage');

    const group = String(formData.get('group') ?? '') as SettingGroup;
    const schema = SCHEMAS[group as keyof typeof SCHEMAS];
    if (!schema) return { ok: false, message: 'Unknown settings section.' };

    const raw = buildPayload(group, formData);
    const parsed = schema.safeParse(raw);

    if (!parsed.success) {
      return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
    }

    await saveSettings(group, parsed.data as never, user.id);

    await recordAudit({
      actor: user,
      action: 'settings.update',
      entity: 'Setting',
      entityId: group,
      summary: `${group[0].toUpperCase() + group.slice(1)} settings updated`,
      after: parsed.data as Record<string, unknown>,
    });

    // Settings shape the public site as well as the admin panel.
    revalidatePath('/admin/settings');
    revalidatePath('/', 'layout');

    return { ok: true, message: 'Settings saved.' };
  } catch (error) {
    if (error instanceof AuthError) return { ok: false, message: error.message };
    console.error('[admin:settings]', error);
    return { ok: false, message: 'We could not save those settings.' };
  }
}

/** Turns the flat FormData into the shape each group's schema expects. */
function buildPayload(group: SettingGroup, formData: FormData): Record<string, unknown> {
  const value = (name: string) => formData.get(name) ?? undefined;
  const checked = (name: string) => formData.get(name) === 'on';
  const list = (name: string) =>
    String(formData.get(name) ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

  switch (group) {
    case 'general':
      return {
        organisationName: value('organisationName'),
        tagline: value('tagline'),
        logo: value('logo') ?? '',
        phone: value('phone'),
        supportEmail: value('supportEmail'),
        address: value('address'),
        website: value('website') ?? '',
      };

    case 'booking':
      return {
        minimumNoticeHours: value('minimumNoticeHours'),
        maximumAdvanceDays: value('maximumAdvanceDays'),
        defaultDurationMinutes: value('defaultDurationMinutes'),
        slotIntervalMinutes: value('slotIntervalMinutes'),
        paymentHoldMinutes: value('paymentHoldMinutes'),
        cancellationWindowHours: value('cancellationWindowHours'),
        cancellationPolicy: value('cancellationPolicy'),
        allowSameDayBooking: checked('allowSameDayBooking'),
      };

    case 'payments':
      return {
        defaultProvider: value('defaultProvider'),
        currency: value('currency') ?? 'NGN',
        enabledProviders: formData.getAll('enabledProviders').map(String),
        allowPayAtVisit: checked('allowPayAtVisit'),
      };

    case 'notifications':
      return {
        emailEnabled: checked('emailEnabled'),
        smsEnabled: checked('smsEnabled'),
        reminderHoursBefore: value('reminderHoursBefore'),
        sendBookingConfirmation: checked('sendBookingConfirmation'),
        sendPaymentReceipt: checked('sendPaymentReceipt'),
      };

    case 'seo':
      return {
        siteTitle: value('siteTitle'),
        siteDescription: value('siteDescription'),
        keywords: list('keywords'),
        socialImage: value('socialImage') ?? '',
      };

    case 'security':
      return {
        sessionTimeoutMinutes: value('sessionTimeoutMinutes'),
        maxFailedLogins: value('maxFailedLogins'),
        lockoutMinutes: value('lockoutMinutes'),
        requireEmailVerification: checked('requireEmailVerification'),
      };

    default:
      return {};
  }
}
