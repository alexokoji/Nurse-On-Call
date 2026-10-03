'use client';

import { useActionState } from 'react';
import { AlertTriangle, Check } from 'lucide-react';
import { saveSettingsAction } from '../actions/settings';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Input, Textarea } from '@/components/ui/input';
import { Checkbox, Switch, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/misc';
import { Alert } from '@/components/ui/feedback';
import { Badge } from '@/components/ui/badge';
import { ImageUpload } from '@/components/forms/image-upload';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import type { ActionResult, PaymentProvider } from '@/types';
import type {
  BookingSettings,
  GeneralSettings,
  NotificationSettings,
  PaymentSettings,
  SecuritySettings,
  SeoSettings,
} from '@/lib/settings/defaults';

const INITIAL: ActionResult = { ok: false };

export function SettingsForms({
  canEdit,
  general,
  booking,
  payments,
  notifications,
  seo,
  security,
  configuredProviders,
  emailStatus,
  storageConfigured,
}: {
  canEdit: boolean;
  general: GeneralSettings;
  booking: BookingSettings;
  payments: PaymentSettings;
  notifications: NotificationSettings;
  seo: SeoSettings;
  security: SecuritySettings;
  configuredProviders: PaymentProvider[];
  emailStatus: { provider: string; configured: boolean; reason?: string };
  storageConfigured: boolean;
}) {
  return (
    <Tabs defaultValue="general">
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="booking">Booking</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="seo">SEO</TabsTrigger>
        <TabsTrigger value="security">Security</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <SettingsSection
          group="general"
          title="Organisation details"
          description="Shown across the public site, receipts and outgoing messages."
          canEdit={canEdit}
        >
          {(errors) => (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Organisation name" required error={errors?.organisationName?.[0]}>
                  <Input name="organisationName" defaultValue={general.organisationName} required />
                </Field>
                <Field label="Tagline" error={errors?.tagline?.[0]}>
                  <Input name="tagline" defaultValue={general.tagline} />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Phone number" required error={errors?.phone?.[0]}>
                  <Input name="phone" defaultValue={general.phone} required />
                </Field>
                <Field label="Support email" required error={errors?.supportEmail?.[0]}>
                  <Input
                    name="supportEmail"
                    type="email"
                    defaultValue={general.supportEmail}
                    required
                  />
                </Field>
              </div>

              <Field label="Address" required error={errors?.address?.[0]}>
                <Textarea name="address" defaultValue={general.address} rows={2} required />
              </Field>

              {!storageConfigured && (
                <Alert variant="warning" title="Image upload is not configured">
                  Add the Cloudinary keys to the environment to upload files. Until then, use the
                  &ldquo;Use a URL instead&rdquo; option on any image field.
                </Alert>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <ImageUpload
                  name="logo"
                  folder="branding"
                  label="Logo"
                  defaultValue={general.logo}
                  description="Replaces the built-in wordmark across the site. A transparent PNG works best."
                />
                <Field label="Website" error={errors?.website?.[0]}>
                  <Input name="website" type="url" defaultValue={general.website} />
                </Field>
              </div>
            </>
          )}
        </SettingsSection>
      </TabsContent>

      <TabsContent value="booking">
        <SettingsSection
          group="booking"
          title="Booking rules"
          description="These directly control which slots patients are offered."
          canEdit={canEdit}
        >
          {(errors) => (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Minimum notice (hours)"
                  description="How far ahead the earliest bookable slot must be."
                  error={errors?.minimumNoticeHours?.[0]}
                >
                  <Input
                    name="minimumNoticeHours"
                    type="number"
                    min={0}
                    max={720}
                    defaultValue={booking.minimumNoticeHours}
                  />
                </Field>

                <Field
                  label="Maximum advance (days)"
                  description="How far into the future the calendar opens."
                  error={errors?.maximumAdvanceDays?.[0]}
                >
                  <Input
                    name="maximumAdvanceDays"
                    type="number"
                    min={1}
                    max={365}
                    defaultValue={booking.maximumAdvanceDays}
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Slot interval (minutes)"
                  description="Spacing of the times shown, e.g. 30 gives 09:00, 09:30…"
                  error={errors?.slotIntervalMinutes?.[0]}
                >
                  <Input
                    name="slotIntervalMinutes"
                    type="number"
                    min={5}
                    max={120}
                    step={5}
                    defaultValue={booking.slotIntervalMinutes}
                  />
                </Field>

                <Field
                  label="Default duration (minutes)"
                  description="Used when a service does not set its own."
                  error={errors?.defaultDurationMinutes?.[0]}
                >
                  <Input
                    name="defaultDurationMinutes"
                    type="number"
                    min={5}
                    max={480}
                    step={5}
                    defaultValue={booking.defaultDurationMinutes}
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Payment hold (minutes)"
                  description="How long an unpaid booking keeps its slot before it is released."
                  error={errors?.paymentHoldMinutes?.[0]}
                >
                  <Input
                    name="paymentHoldMinutes"
                    type="number"
                    min={5}
                    max={1440}
                    defaultValue={booking.paymentHoldMinutes}
                  />
                </Field>

                <Field
                  label="Free cancellation window (hours)"
                  description="Cancellations earlier than this are refunded in full."
                  error={errors?.cancellationWindowHours?.[0]}
                >
                  <Input
                    name="cancellationWindowHours"
                    type="number"
                    min={0}
                    max={720}
                    defaultValue={booking.cancellationWindowHours}
                  />
                </Field>
              </div>

              <Field
                label="Cancellation policy"
                description="Shown to patients before they pay and on the FAQ page."
                error={errors?.cancellationPolicy?.[0]}
              >
                <Textarea
                  name="cancellationPolicy"
                  defaultValue={booking.cancellationPolicy}
                  rows={4}
                />
              </Field>

              <ToggleRow
                name="allowSameDayBooking"
                label="Allow same-day booking"
                description="Turn off to require at least one day's notice."
                defaultChecked={booking.allowSameDayBooking}
              />
            </>
          )}
        </SettingsSection>
      </TabsContent>

      <TabsContent value="payments">
        <SettingsSection
          group="payments"
          title="Payment gateways"
          description="API keys live in environment variables and are never stored here."
          canEdit={canEdit}
        >
          {(errors) => (
            <>
              {configuredProviders.length === 0 && (
                <Alert variant="warning" title="No gateway is configured">
                  Online payment is unavailable until API keys are set in the environment. Bookings
                  can still be taken and settled with a manually recorded payment.
                </Alert>
              )}

              <Field label="Default gateway" required error={errors?.defaultProvider?.[0]}>
                <select
                  name="defaultProvider"
                  defaultValue={payments.defaultProvider}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="paystack">Paystack</option>
                  <option value="flutterwave">Flutterwave</option>
                  <option value="korapay">Korapay</option>
                </select>
              </Field>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-navy-800">Enabled gateways</legend>
                {(['paystack', 'flutterwave', 'korapay'] as const).map((provider) => {
                  const ready = configuredProviders.includes(provider);
                  return (
                    <label
                      key={provider}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <span className="flex items-center gap-2.5">
                        <Checkbox
                          name="enabledProviders"
                          value={provider}
                          defaultChecked={payments.enabledProviders.includes(provider)}
                        />
                        <span className="text-sm font-medium capitalize text-navy-800">
                          {provider}
                        </span>
                      </span>

                      {ready ? (
                        <Badge variant="success">
                          <Check className="size-3" aria-hidden />
                          Keys configured
                        </Badge>
                      ) : (
                        <Badge variant="warning">
                          <AlertTriangle className="size-3" aria-hidden />
                          No API keys
                        </Badge>
                      )}
                    </label>
                  );
                })}
              </fieldset>

              <Field label="Currency" error={errors?.currency?.[0]}>
                <Input name="currency" defaultValue={payments.currency} maxLength={3} />
              </Field>

              <ToggleRow
                name="allowPayAtVisit"
                label="Allow pay at visit"
                description="Lets a booking be confirmed before payment, settled manually afterwards."
                defaultChecked={payments.allowPayAtVisit}
              />

              <div className="rounded-xl border border-border p-4">
                <ToggleRow
                  name="bankTransferEnabled"
                  label="Offer bank transfer"
                  description="Patients see your account details at checkout and the slot is held until you confirm the transfer."
                  defaultChecked={payments.bankTransfer.enabled}
                />

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field label="Bank name" error={errors?.bankName?.[0]}>
                    <Input
                      name="bankName"
                      defaultValue={payments.bankTransfer.bankName}
                      placeholder="Guaranty Trust Bank"
                      maxLength={120}
                    />
                  </Field>

                  <Field label="Account name" error={errors?.accountName?.[0]}>
                    <Input
                      name="accountName"
                      defaultValue={payments.bankTransfer.accountName}
                      placeholder="NurseOnCall Limited"
                      maxLength={120}
                    />
                  </Field>

                  <Field
                    label="Account number"
                    description="10 digits"
                    error={errors?.accountNumber?.[0]}
                  >
                    <Input
                      name="accountNumber"
                      defaultValue={payments.bankTransfer.accountNumber}
                      placeholder="0123456789"
                      inputMode="numeric"
                      maxLength={20}
                    />
                  </Field>

                  <Field
                    label="Hold the slot for"
                    description="Hours to wait for the transfer before the slot is released"
                    error={errors?.holdHours?.[0]}
                  >
                    <Input
                      name="transferHoldHours"
                      type="number"
                      min={1}
                      max={168}
                      defaultValue={payments.bankTransfer.holdHours}
                    />
                  </Field>
                </div>

                <div className="mt-4">
                  <Field
                    label="Instructions for the patient"
                    description="Shown with the account details. The booking reference is added automatically."
                    error={errors?.instructions?.[0]}
                  >
                    <Textarea
                      name="transferInstructions"
                      rows={2}
                      defaultValue={payments.bankTransfer.instructions}
                      maxLength={600}
                    />
                  </Field>
                </div>
              </div>
            </>
          )}
        </SettingsSection>
      </TabsContent>

      <TabsContent value="notifications">
        <SettingsSection
          group="notifications"
          title="Notifications"
          description="Transport credentials are configured through environment variables."
          canEdit={canEdit}
        >
          {(errors) => (
            <>
              {/* The toggles below only decide whether we *try* to send.
                  This says whether a send would actually reach anyone. */}
              {emailStatus.configured ? (
                <Alert variant="success" title={`Email is live via ${emailStatus.provider}`}>
                  Confirmations, receipts and password resets are being delivered.
                </Alert>
              ) : (
                <Alert variant="error" title="Email is not being delivered">
                  {emailStatus.reason}. Password reset links will not reach patients until an email
                  provider is configured — set <code>EMAIL_PROVIDER</code> and its keys in the
                  environment.
                </Alert>
              )}

              <ToggleRow
                name="emailEnabled"
                label="Send email notifications"
                defaultChecked={notifications.emailEnabled}
              />
              <ToggleRow
                name="smsEnabled"
                label="Send SMS notifications"
                description="Requires an SMS provider to be configured."
                defaultChecked={notifications.smsEnabled}
              />
              <ToggleRow
                name="sendBookingConfirmation"
                label="Send booking confirmations"
                defaultChecked={notifications.sendBookingConfirmation}
              />
              <ToggleRow
                name="sendPaymentReceipt"
                label="Send payment receipts"
                defaultChecked={notifications.sendPaymentReceipt}
              />

              <Field
                label="Reminder lead time (hours)"
                description="How long before an appointment the reminder is sent."
                error={errors?.reminderHoursBefore?.[0]}
              >
                <Input
                  name="reminderHoursBefore"
                  type="number"
                  min={1}
                  max={168}
                  defaultValue={notifications.reminderHoursBefore}
                />
              </Field>
            </>
          )}
        </SettingsSection>
      </TabsContent>

      <TabsContent value="seo">
        <SettingsSection
          group="seo"
          title="Search engine listing"
          description="Defaults used when a page does not define its own metadata."
          canEdit={canEdit}
        >
          {(errors) => (
            <>
              <Field label="Site title" required error={errors?.siteTitle?.[0]}>
                <Input name="siteTitle" defaultValue={seo.siteTitle} maxLength={70} required />
              </Field>

              <Field
                label="Meta description"
                required
                description="Up to 160 characters."
                error={errors?.siteDescription?.[0]}
              >
                <Textarea
                  name="siteDescription"
                  defaultValue={seo.siteDescription}
                  rows={3}
                  maxLength={160}
                  required
                />
              </Field>

              <Field label="Keywords" description="Separate with commas.">
                <Input name="keywords" defaultValue={seo.keywords.join(', ')} />
              </Field>

              <Field
                label="Social sharing image"
                description="Used as the Open Graph image. 1200×630 works best."
                error={errors?.socialImage?.[0]}
              >
                <Input name="socialImage" type="url" defaultValue={seo.socialImage} />
              </Field>
            </>
          )}
        </SettingsSection>
      </TabsContent>

      <TabsContent value="security">
        <SettingsSection
          group="security"
          title="Security"
          description="Applies to patient and staff accounts alike."
          canEdit={canEdit}
        >
          {(errors) => (
            <>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label="Failed logins before lockout"
                  error={errors?.maxFailedLogins?.[0]}
                >
                  <Input
                    name="maxFailedLogins"
                    type="number"
                    min={3}
                    max={20}
                    defaultValue={security.maxFailedLogins}
                  />
                </Field>

                <Field label="Lockout duration (minutes)" error={errors?.lockoutMinutes?.[0]}>
                  <Input
                    name="lockoutMinutes"
                    type="number"
                    min={1}
                    max={1440}
                    defaultValue={security.lockoutMinutes}
                  />
                </Field>
              </div>

              <Field
                label="Session timeout (minutes)"
                description="How long a signed-in session stays valid."
                error={errors?.sessionTimeoutMinutes?.[0]}
              >
                <Input
                  name="sessionTimeoutMinutes"
                  type="number"
                  min={15}
                  max={20160}
                  defaultValue={security.sessionTimeoutMinutes}
                />
              </Field>

              {/* The login check for this flag exists, but nothing yet sends a
                  verification email or handles the confirmation link. Turning
                  it on would therefore lock every new patient out, so it stays
                  disabled until that flow is built. */}
              <label className="flex items-center justify-between gap-4 rounded-lg border border-dashed border-border bg-secondary/40 p-3 opacity-70">
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-navy-800">
                    Require email verification
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Not available yet — the verification email and confirmation link still need to
                    be built. Enabling this now would lock new patients out of their accounts.
                  </span>
                </span>
                <Switch name="requireEmailVerification" checked={false} disabled />
              </label>

              <Alert variant="info">
                Passwords are hashed with bcrypt and never stored or displayed in plain text. The
                minimum strength rule is enforced in code and cannot be weakened from here.
              </Alert>
            </>
          )}
        </SettingsSection>
      </TabsContent>
    </Tabs>
  );
}

/* ── Shared section wrapper ───────────────────────────────────────── */

function SettingsSection({
  group,
  title,
  description,
  canEdit,
  children,
}: {
  group: string;
  title: string;
  description: string;
  canEdit: boolean;
  children: (errors: Record<string, string[]> | undefined) => React.ReactNode;
}) {
  const [state, formAction] = useActionState(saveSettingsAction, INITIAL);

  useActionFeedback(state);

  return (
    <form action={formAction} className="rounded-xl border border-border bg-card shadow-card">
      <input type="hidden" name="group" value={group} />

      <div className="border-b border-border px-6 py-4">
        <h3 className="text-sm font-semibold text-navy-800">{title}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>

      <fieldset disabled={!canEdit} className="space-y-5 p-6">
        {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}
        {children(state.fieldErrors)}
      </fieldset>

      {canEdit && (
        <div className="flex justify-end border-t border-border px-6 py-4">
          <SubmitButton pendingLabel="Saving…">Save changes</SubmitButton>
        </div>
      )}
    </form>
  );
}

function ToggleRow({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-navy-800">{label}</span>
        {description && (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        )}
      </span>
      <Switch name={name} defaultChecked={defaultChecked} />
    </label>
  );
}
