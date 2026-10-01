import type { Metadata } from 'next';
import { SettingsForms } from './settings-forms';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getSettings } from '@/lib/settings';
import { availableProviders } from '@/lib/payments/service';
import { emailTransportStatus } from '@/lib/notifications/transports';
import { isStorageConfigured } from '@/lib/storage/cloudinary';
import { Alert } from '@/components/ui/feedback';

export const metadata: Metadata = { title: 'Settings' };

export default async function AdminSettingsPage() {
  const user = await requireAdmin('settings.view');

  const [general, booking, payments, notifications, seo, security, configured] = await Promise.all([
    getSettings('general'),
    getSettings('booking'),
    getSettings('payments'),
    getSettings('notifications'),
    getSettings('seo'),
    getSettings('security'),
    availableProviders(),
  ]);

  // Read from the environment, so the screen shows what is actually
  // deliverable rather than what the settings claim.
  const email = emailTransportStatus();
  const storageReady = isStorageConfigured();

  const canEdit = userCan(user, 'settings.manage');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These control how booking, payment and notifications behave across the whole platform.
        </p>
      </div>

      {!canEdit && (
        <Alert variant="info" title="Read-only">
          You can view these settings but not change them. Ask a super admin if something needs
          updating.
        </Alert>
      )}

      <SettingsForms
        canEdit={canEdit}
        general={general}
        booking={booking}
        payments={payments}
        notifications={notifications}
        seo={seo}
        security={security}
        configuredProviders={configured}
        emailStatus={email}
        storageConfigured={storageReady}
      />
    </div>
  );
}
