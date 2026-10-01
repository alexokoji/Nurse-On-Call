import type { Metadata } from 'next';
import { PatientShell } from '@/components/patient/patient-shell';
import { requirePatient } from '@/lib/auth/guards';
import { unreadCount } from '@/lib/notifications/service';

export const metadata: Metadata = {
  title: { default: 'Patient Portal', template: '%s | NurseOnCall' },
  robots: { index: false, follow: false },
};

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatient('/patient/dashboard');
  const unread = await unreadCount(user.id);

  return (
    <PatientShell
      user={{ name: user.name, email: user.email, avatar: user.avatar }}
      unreadCount={unread}
    >
      {children}
    </PatientShell>
  );
}
