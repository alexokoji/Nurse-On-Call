import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AdminBookingForm } from './booking-form';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminServices } from '@/lib/queries/admin';
import { connectDB } from '@/lib/db/connect';
import { User } from '@/models';
import { EmptyState } from '@/components/ui/feedback';

export const metadata: Metadata = { title: 'New appointment' };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string }>;
}) {
  await requireAdmin('appointments.create');
  const { patientId } = await searchParams;

  const services = await getAdminServices({ status: 'published', pageSize: 100 });

  /* Pre-fill the contact fields when booking for a known patient. */
  let prefill: { name: string; email: string; phone: string } | null = null;
  if (patientId) {
    await connectDB();
    const patient = await User.findOne({ _id: patientId, role: 'patient' })
      .select('name email phone')
      .lean();
    if (patient) {
      prefill = {
        name: patient.name,
        email: patient.email,
        phone: patient.phone ?? '',
      };
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        href="/admin/appointments"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All appointments
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Create an appointment
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          For phone and walk-in bookings. Availability is checked live, exactly as it is for
          patients booking themselves.
        </p>
      </div>

      {services.data.length === 0 ? (
        <EmptyState
          title="No published services"
          description="Publish at least one service before creating appointments."
          action={{ label: 'Manage services', href: '/admin/services' }}
        />
      ) : (
        <AdminBookingForm
          services={services.data.map((service) => ({
            id: service.id,
            name: service.name,
            serviceType: service.serviceType,
            priceKobo: service.priceKobo,
            homeVisitSurchargeKobo: service.homeVisitSurchargeKobo,
            durationMinutes: service.durationMinutes,
          }))}
          prefill={prefill}
        />
      )}
    </div>
  );
}
