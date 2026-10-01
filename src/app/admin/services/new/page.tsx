import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ServiceForm } from '../service-form';
import { requireAdmin } from '@/lib/auth/guards';
import { getCategories } from '@/lib/queries/admin';
import { Alert } from '@/components/ui/feedback';

export const metadata: Metadata = { title: 'New service' };

export default async function NewServicePage() {
  await requireAdmin('services.create');
  const categories = await getCategories();

  return (
    <div className="space-y-5">
      <Link
        href="/admin/services"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
      >
        <ArrowLeft className="size-4" aria-hidden />
        All services
      </Link>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          Create a service
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Save it as a draft first if you are not ready for patients to book it.
        </p>
      </div>

      {categories.length === 0 ? (
        <Alert variant="warning" title="No categories yet">
          Every service belongs to a category.{' '}
          <Link href="/admin/services/categories" className="font-semibold underline">
            Create one first
          </Link>
          .
        </Alert>
      ) : (
        <ServiceForm
          service={null}
          categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}
