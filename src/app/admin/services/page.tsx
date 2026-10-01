import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { Plus, Star, Stethoscope } from 'lucide-react';
import { FilterBar } from '@/components/admin/filter-bar';
import { ServiceRowActions } from './service-actions';
import { ServiceIcon } from '@/components/public/service-icon';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { Button } from '@/components/ui/button';
import { EmptyState, TableSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminServices, getCategories } from '@/lib/queries/admin';
import { formatNaira } from '@/lib/utils';
import { LABELS, SERVICE_STATUSES, type ServiceType } from '@/types';

export const metadata: Metadata = { title: 'Services' };

const STATUS_VARIANT = {
  published: 'success',
  draft: 'warning',
  archived: 'neutral',
} as const;

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; categoryId?: string; page?: string }>;
}) {
  const user = await requireAdmin('services.view');
  const params = await searchParams;
  const categories = await getCategories();

  return (
    <div className="space-y-5">
      <FilterBar
        searchPlaceholder="Search services…"
        filters={[
          {
            name: 'status',
            label: 'All Status',
            options: SERVICE_STATUSES.map((status) => ({
              value: status,
              label: status[0].toUpperCase() + status.slice(1),
            })),
          },
          {
            name: 'categoryId',
            label: 'All Categories',
            options: categories.map((category) => ({
              value: category.id,
              label: category.name,
            })),
          },
        ]}
      >
        <Button asChild variant="outline">
          <Link href="/admin/services/categories">Categories</Link>
        </Button>
        {userCan(user, 'services.create') && (
          <Button asChild>
            <Link href="/admin/services/new">
              <Plus className="size-4" />
              New Service
            </Link>
          </Button>
        )}
      </FilterBar>

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={8} columns={7} />
          </div>
        }
      >
        <ServicesTable params={params} />
      </Suspense>
    </div>
  );
}

async function ServicesTable({
  params,
}: {
  params: { q?: string; status?: string; categoryId?: string; page?: string };
}) {
  const user = await requireAdmin('services.view');

  const result = await getAdminServices({
    q: params.q,
    status: params.status,
    categoryId: params.categoryId,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={Stethoscope}
          title="No services found"
          description="Create a service to make it bookable on the public site."
          action={
            userCan(user, 'services.create')
              ? { label: 'New service', href: '/admin/services/new' }
              : undefined
          }
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Service</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Delivered</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Duration</TableHead>
            <TableHead className="text-right">Bookings</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-12 text-right">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((service) => (
            <TableRow key={service.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <ServiceIcon icon={service.icon} accent={service.accent} size="sm" />
                  <div className="min-w-0">
                    <Link
                      href={`/admin/services/${service.id}`}
                      className="block truncate text-sm font-medium text-navy-800 hover:text-primary"
                    >
                      {service.name}
                      {service.isFeatured && (
                        <Star
                          className="ml-1.5 inline size-3 fill-amber-400 text-amber-400"
                          aria-label="Featured"
                        />
                      )}
                    </Link>
                    <span className="block font-mono text-xs text-muted-foreground">
                      /{service.slug}
                    </span>
                  </div>
                </div>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {service.categoryName}
                </span>
              </TableCell>

              <TableCell>
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {LABELS.serviceType[service.serviceType as ServiceType]}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <span className="whitespace-nowrap text-sm font-medium text-navy-800">
                  {formatNaira(service.priceKobo)}
                </span>
                {service.homeVisitSurchargeKobo > 0 && (
                  <span className="block whitespace-nowrap text-xs text-muted-foreground">
                    +{formatNaira(service.homeVisitSurchargeKobo)} home
                  </span>
                )}
              </TableCell>

              <TableCell className="text-right">
                <span className="whitespace-nowrap text-sm text-muted-foreground">
                  {service.durationMinutes} min
                </span>
              </TableCell>

              <TableCell className="text-right">
                <span className="text-sm font-medium text-navy-800">{service.bookingCount}</span>
                {service.reviewCount > 0 && (
                  <span className="block whitespace-nowrap text-xs text-muted-foreground">
                    ★ {service.averageRating.toFixed(1)} ({service.reviewCount})
                  </span>
                )}
              </TableCell>

              <TableCell>
                <Badge variant={STATUS_VARIANT[service.status as keyof typeof STATUS_VARIANT]}>
                  {service.status}
                </Badge>
              </TableCell>

              <TableCell className="text-right">
                <ServiceRowActions
                  serviceId={service.id}
                  slug={service.slug}
                  status={service.status}
                  canEdit={userCan(user, 'services.edit')}
                  canDelete={userCan(user, 'services.delete')}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="services"
      />
    </div>
  );
}
