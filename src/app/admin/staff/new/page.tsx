import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { StaffForm } from '../staff-form';
import { requireAdmin } from '@/lib/auth/guards';
import { getAdminServices } from '@/lib/queries/admin';

export const metadata: Metadata = { title: 'New staff member' };

export default async function NewStaffPage() {
  await requireAdmin('staff.manage');
  const services = await getAdminServices({ pageSize: 100 });

  return (
    <div className="space-y-5">
      <Link
        href="/admin/staff"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All staff
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Add a staff member
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Staff accounts are created here — clinicians never register themselves.
        </p>
      </div>

      <StaffForm
        staff={null}
        services={services.data.map((service) => ({
          id: service.id,
          name: service.name,
          categoryName: service.categoryName,
        }))}
      />
    </div>
  );
}
