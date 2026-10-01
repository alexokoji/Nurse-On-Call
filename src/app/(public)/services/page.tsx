import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Stethoscope } from 'lucide-react';
import { ServiceCard } from '@/components/public/service-card';
import { ServiceFilters } from './service-filters';
import { EmptyState, CardSkeleton } from '@/components/ui/feedback';
import { getPublishedServices, getServiceCategories } from '@/lib/queries/public';

export const metadata: Metadata = {
  title: 'Our Services',
  description:
    'Browse home nursing, doctor consultations, physiotherapy, lab tests, medication delivery ' +
    'and more. Clear pricing, live availability, care in Port Harcourt and Rivers State.',
  alternates: { canonical: '/services' },
};

interface SearchParams {
  q?: string;
  category?: string;
  type?: string;
  price?: string;
}

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50/60 to-background">
        <div className="container py-12 md:py-16">
          <p className="eyebrow">Our Services</p>
          <h1 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Comprehensive care, priced clearly
          </h1>
          <p className="mt-4 max-w-2xl text-base text-muted-foreground">
            Every service below is delivered by our own clinical team. The price you see is the
            price you pay — home-visit surcharges, where they apply, are shown up front.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <Suspense fallback={<CardSkeleton count={3} />}>
            <ServicesResults params={params} />
          </Suspense>
        </div>
      </section>
    </>
  );
}

async function ServicesResults({ params }: { params: SearchParams }) {
  const [allServices, categories] = await Promise.all([
    getPublishedServices(),
    getServiceCategories(),
  ]);

  const services = filterServices(allServices, params);

  return (
    <>
      <Suspense fallback={<div className="h-24 rounded-2xl border border-border bg-card" />}>
        <ServiceFilters
          categories={categories.map((c) => ({ slug: c.slug, name: c.name }))}
          resultCount={services.length}
        />
      </Suspense>

      {services.length === 0 ? (
        <EmptyState
          className="mt-8"
          icon={Stethoscope}
          title="No services match those filters"
          description="Try widening your search, or browse the full catalogue."
          action={{ label: 'Clear filters', href: '/services' }}
        />
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard key={service.id} service={service} />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Filtering happens here rather than in Mongo because the published catalogue
 * is small (tens of rows, cached per request) and this keeps the filter logic
 * in one readable place. If the catalogue grows into the hundreds, move this
 * into the query as an aggregation.
 */
function filterServices(
  services: Awaited<ReturnType<typeof getPublishedServices>>,
  params: SearchParams,
) {
  let result = services;

  if (params.category) {
    result = result.filter((service) => service.category?.slug === params.category);
  }

  if (params.type) {
    // "hybrid" services are genuinely offered at clinic and home, so they
    // must appear under both filters, not only under "hybrid".
    result = result.filter(
      (service) =>
        service.serviceType === params.type ||
        (service.serviceType === 'hybrid' &&
          (params.type === 'clinic' || params.type === 'home')),
    );
  }

  if (params.price) {
    const [min, max] = params.price.split('-');
    const minKobo = min ? Number(min) * 100 : 0;
    const maxKobo = max ? Number(max) * 100 : Number.POSITIVE_INFINITY;
    result = result.filter(
      (service) => service.priceKobo >= minKobo && service.priceKobo <= maxKobo,
    );
  }

  if (params.q) {
    const needle = params.q.toLowerCase();
    result = result.filter(
      (service) =>
        service.name.toLowerCase().includes(needle) ||
        service.shortDescription.toLowerCase().includes(needle) ||
        service.category?.name.toLowerCase().includes(needle),
    );
  }

  return result;
}
