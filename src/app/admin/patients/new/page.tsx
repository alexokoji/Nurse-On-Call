import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PatientForm } from './patient-form';
import { requireAdmin } from '@/lib/auth/guards';

export const metadata: Metadata = { title: 'New patient' };

export default async function NewPatientPage() {
  await requireAdmin('patients.create');

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/admin/patients"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All patients
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Add a patient
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          For patients who book by phone or walk in. Leave the password blank and they can set one
          themselves with “forgot password”.
        </p>
      </div>

      <PatientForm />
    </div>
  );
}
