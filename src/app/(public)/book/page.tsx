import type { Metadata } from 'next';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { BookingWizard } from './booking-wizard';
import { Button } from '@/components/ui/button';
import { getCurrentUser } from '@/lib/auth/current-user';
import { connectDB } from '@/lib/db/connect';
import { PatientProfile } from '@/models';
import { getPublishedServices } from '@/lib/queries/public';
import { getSettings } from '@/lib/settings';
import { EmptyState } from '@/components/ui/feedback';

export const metadata: Metadata = {
  title: 'Book a Service',
  description:
    'Book home nursing, a doctor consultation, physiotherapy, lab tests or medication delivery ' +
    'with live availability and secure online payment.',
  alternates: { canonical: '/book' },
};

export default async function BookPage({
  searchParams,
}: {
  searchParams: Promise<{ service?: string }>;
}) {
  const [{ service: preselectedSlug }, user, services, bookingSettings] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getPublishedServices(),
    getSettings('booking'),
  ]);

  if (services.length === 0) {
    return (
      <div className="container py-20">
        <EmptyState
          title="Booking is temporarily unavailable"
          description="Our service catalogue is being updated. Please call 0800 123 4567 and we'll book you in directly."
          action={{ label: 'Contact us', href: '/contact' }}
        />
      </div>
    );
  }

  /* Pre-fill the contact step for a signed-in patient so they retype nothing. */
  const prefill = user?.role === 'patient' ? await patientPrefill(user.id, user.name, user.email) : null;

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50/60 to-background">
        <div className="container py-10 md:py-12">
          <p className="eyebrow">Book a Service</p>
          <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Let&apos;s get you booked in
          </h1>
          <p className="mt-3 max-w-2xl text-base text-muted-foreground">
            Availability below is live. Anything you can select is genuinely free.
          </p>

          {!user && (
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-card sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-muted-foreground">
                Already have an account? Sign in and we&apos;ll fill in your details for you.
              </p>
              <Button asChild variant="outline" size="sm">
                <Link href="/login?next=/book">
                  <LogIn className="size-4" />
                  Sign in
                </Link>
              </Button>
            </div>
          )}
        </div>
      </section>

      <section className="section pt-10">
        <div className="container">
          <BookingWizard
            services={services}
            preselectedSlug={preselectedSlug}
            isSignedIn={Boolean(user && user.role === 'patient')}
            prefill={prefill}
            cancellationPolicy={bookingSettings.cancellationPolicy}
            maximumAdvanceDays={bookingSettings.maximumAdvanceDays}
          />
        </div>
      </section>
    </>
  );
}

async function patientPrefill(userId: string, name: string, email: string) {
  try {
    await connectDB();
    const profile = await PatientProfile.findOne({ user: userId }).lean();
    const { User } = await import('@/models');
    const account = await User.findById(userId).select('phone').lean();

    return {
      name,
      email,
      phone: account?.phone ?? '',
      dateOfBirth: profile?.dateOfBirth ? profile.dateOfBirth.toISOString().slice(0, 10) : '',
      gender: profile?.gender ?? '',
      address: {
        street: profile?.address?.street ?? '',
        area: profile?.address?.area ?? '',
        city: profile?.address?.city ?? 'Port Harcourt',
        state: profile?.address?.state ?? 'Rivers',
        landmark: profile?.address?.landmark ?? '',
      },
      emergencyContact: {
        name: profile?.emergencyContact?.name ?? '',
        phone: profile?.emergencyContact?.phone ?? '',
        relationship: profile?.emergencyContact?.relationship ?? '',
      },
    };
  } catch {
    return { name, email, phone: '' };
  }
}

export type BookingPrefill = Awaited<ReturnType<typeof patientPrefill>>;
