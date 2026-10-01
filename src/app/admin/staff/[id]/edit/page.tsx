import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { StaffForm } from '../../staff-form';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminServices, getStaffMember } from '@/lib/queries/admin';
import type { Weekday } from '@/types';

export const metadata: Metadata = { title: 'Edit staff member' };

export default async function EditStaffPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('staff.manage');
  const { id } = await params;

  const [staff, services] = await Promise.all([
    getStaffMember(id),
    getAdminServices({ pageSize: 100 }),
  ]);

  if (!staff) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/admin/staff/${id}`}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to profile
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Edit {staff.name}
        </h2>
        <p className="mt-1 font-mono text-sm text-muted-foreground">{staff.staffNumber}</p>
      </div>

      <StaffForm
        staff={{
          id: staff.id,
          name: staff.name,
          email: staff.email,
          phone: staff.phone,
          avatar: staff.avatar,
          title: staff.title,
          department: staff.department,
          bio: staff.bio,
          qualifications: staff.qualifications,
          specialisations: staff.specialisations,
          licenceNumber: staff.licenceNumber,
          yearsOfExperience: staff.yearsOfExperience,
          isActive: staff.isActive,
          isPubliclyVisible: staff.isPubliclyVisible,
          maxConcurrentAppointments: staff.maxConcurrentAppointments,
          services: staff.services.map((service) => ({ id: service.id })),
          workingHours: staff.workingHours.map((day) => ({
            day: day.day as Weekday,
            enabled: day.enabled,
            start: day.start,
            end: day.end,
            breakStart: day.breakStart,
            breakEnd: day.breakEnd,
          })),
        }}
        services={services.data.map((service) => ({
          id: service.id,
          name: service.name,
          categoryName: service.categoryName,
        }))}
      />
    </div>
  );
}
