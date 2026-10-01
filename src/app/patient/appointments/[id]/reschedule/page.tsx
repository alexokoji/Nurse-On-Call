import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientBooking } from '@/lib/queries/patient';
import { connectDB } from '@/lib/db/connect';
import { Booking } from '@/models';
import { getSettings } from '@/lib/settings';
import { RescheduleForm } from './reschedule-form';

export const metadata: Metadata = { title: 'Reschedule appointment' };

export default async function ReschedulePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePatient();
  const { id } = await params;

  const booking = await getPatientBooking(user.id, id);
  if (!booking) notFound();

  // Only a live booking can move; anything else goes back to the detail page.
  if (!['pending_payment', 'confirmed'].includes(booking.status)) {
    redirect(`/patient/appointments/${id}`);
  }

  // The wizard needs the service id, which the read model does not expose.
  await connectDB();
  const raw = await Booking.findById(id).select('service locationType').lean();
  if (!raw) notFound();

  const bookingSettings = await getSettings('booking');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/patient/appointments/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to appointment
      </Link>

      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">
          Reschedule your appointment
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {booking.serviceName} · currently {booking.dateKey} at {booking.startTime}
        </p>
      </div>

      <RescheduleForm
        bookingId={id}
        serviceId={String(raw.service)}
        locationType={raw.locationType}
        currentDateKey={booking.dateKey}
        maximumAdvanceDays={bookingSettings.maximumAdvanceDays}
      />
    </div>
  );
}
