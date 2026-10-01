import type { Metadata } from 'next';
import { format } from 'date-fns';
import { notFound } from 'next/navigation';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientProfile, profileCompletion } from '@/lib/queries/patient';
import { formatNaira } from '@/lib/utils';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';

export const metadata: Metadata = { title: 'My Profile' };

export default async function PatientProfilePage() {
  const user = await requirePatient();
  const profile = await getPatientProfile(user.id);

  if (!profile) notFound();

  const completion = profileCompletion(profile);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">My profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Keep this current so our team has what they need when they attend you.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div className="space-y-6">
          <ProfileForm profile={profile} />
          <PasswordForm />
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-semibold text-navy-800">Profile completeness</p>
            <p className="mt-3 font-display text-3xl font-bold text-navy-800">{completion}%</p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-crimson-500 transition-all"
                style={{ width: `${completion}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {completion === 100
                ? 'Everything we need is here — thank you.'
                : 'Adding your address and emergency contact means less typing at every booking.'}
            </p>
          </div>

          <dl className="rounded-xl border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-semibold text-navy-800">Account</p>
            <div className="mt-4 space-y-3 text-sm">
              <Row label="Patient number" value={profile.patientNumber} mono />
              <Row label="Email" value={profile.email} />
              <Row
                label="Member since"
                value={format(new Date(profile.memberSince), 'MMMM yyyy')}
              />
              <Row label="Appointments" value={String(profile.totalAppointments)} />
              <Row label="Total spent" value={formatNaira(profile.totalSpentKobo)} />
            </div>
            <p className="mt-4 border-t border-border pt-4 text-xs text-muted-foreground">
              Your email address is your sign-in identity. Contact support if you need it changed.
            </p>
          </dl>
        </aside>
      </div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={`text-right font-medium text-navy-800 ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </dd>
    </div>
  );
}
