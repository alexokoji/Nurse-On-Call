import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { ServiceForm } from '../service-form';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth/guards';
import { getCategories, getServiceForEdit } from '@/lib/queries/admin';

export const metadata: Metadata = { title: 'Edit service' };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin('services.edit');
  const { id } = await params;

  const [service, categories] = await Promise.all([getServiceForEdit(id), getCategories()]);
  if (!service) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/services"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-navy-800"
        >
          <ArrowLeft className="size-4" aria-hidden />
          All services
        </Link>

        {service.status === 'published' && (
          <Button asChild variant="outline" size="sm">
            <Link href={`/services/${service.slug}`} target="_blank">
              <ExternalLink className="size-4" />
              View public page
            </Link>
          </Button>
        )}
      </div>

      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
          {service.name}
        </h2>
        <p className="mt-1 font-mono text-sm text-muted-foreground">/services/{service.slug}</p>
      </div>

      <ServiceForm
        service={service}
        categories={categories.map((category) => ({ id: category.id, name: category.name }))}
      />
    </div>
  );
}
