import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Info,
  MapPin,
  Star,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cloudinaryVariant } from '@/lib/storage/image-url';
import { ServiceIcon } from '@/components/public/service-icon';
import { ServiceCard } from '@/components/public/service-card';
import { formatNaira } from '@/lib/utils';
import { LABELS, type ServiceType } from '@/types';
import { locationsForService } from '@/lib/bookings/availability';
import {
  getServiceBySlug,
  getPublishedServices,
  getServiceReviews,
} from '@/lib/queries/public';
import { getContactDetails } from '@/lib/settings/contact';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);

  if (!service) return { title: 'Service not found' };

  return {
    title: service.seo?.title ?? service.name,
    description: service.seo?.description ?? service.shortDescription,
    alternates: { canonical: `/services/${service.slug}` },
    openGraph: {
      title: service.name,
      description: service.shortDescription,
      type: 'article',
      images: service.image ? [service.image] : undefined,
    },
  };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);

  if (!service) notFound();

  const [reviews, allServices, contact] = await Promise.all([
    getServiceReviews(service.id, 5),
    getPublishedServices(),
    getContactDetails(),
  ]);

  const related = allServices
    .filter((s) => s.id !== service.id && s.category?.id === service.category?.id)
    .slice(0, 3);

  const locations = locationsForService(service.serviceType);

  /* Structured data helps this page surface for local healthcare searches. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'MedicalProcedure',
    name: service.name,
    description: service.shortDescription,
    provider: {
      '@type': 'MedicalOrganization',
      name: 'NurseOnCall',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Port Harcourt',
        addressRegion: 'Rivers',
        addressCountry: 'NG',
      },
    },
    ...(service.reviewCount > 0 && {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: service.averageRating,
        reviewCount: service.reviewCount,
      },
    }),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero */}
      <section className="border-b border-border bg-gradient-to-b from-brand-50/60 to-background">
        <div className="container py-10 md:py-14">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-navy-800">
                  Home
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li>
                <Link href="/services" className="hover:text-navy-800">
                  Services
                </Link>
              </li>
              <li aria-hidden>/</li>
              <li className="font-medium text-navy-800">{service.name}</li>
            </ol>
          </nav>

          {/* A wide banner when the service has a photo; otherwise the icon
              below carries the identity on its own. */}
          {service.image && (
            <div className="relative mt-6 aspect-[21/9] overflow-hidden rounded-2xl shadow-soft">
              <Image
                src={cloudinaryVariant(service.image, 'c_fill,w_1400,h_600,q_auto,f_auto')}
                alt={service.name}
                fill
                priority
                sizes="(min-width: 1280px) 72rem, 95vw"
                className="object-cover"
              />
            </div>
          )}

          <div className="mt-6 grid gap-8 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <div>
              <ServiceIcon
                icon={service.icon}
                accent={service.category?.accent ?? 'crimson'}
                size="lg"
              />

              <h1 className="mt-5 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
                {service.name}
              </h1>

              {service.category && (
                <p className="mt-2 text-sm font-medium text-crimson-600">{service.category.name}</p>
              )}

              <p className="mt-4 max-w-2xl text-base text-muted-foreground">
                {service.shortDescription}
              </p>

              <dl className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" aria-hidden />
                  <dt className="sr-only">Duration</dt>
                  <dd className="font-medium text-navy-800">{service.durationMinutes} minutes</dd>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="size-4 text-muted-foreground" aria-hidden />
                  <dt className="sr-only">Where it&apos;s delivered</dt>
                  <dd className="font-medium text-navy-800">
                    {LABELS.serviceType[service.serviceType as ServiceType]}
                  </dd>
                </div>
                {service.reviewCount > 0 && (
                  <div className="flex items-center gap-2">
                    <Star className="size-4 fill-amber-400 text-amber-400" aria-hidden />
                    <dt className="sr-only">Rating</dt>
                    <dd className="font-medium text-navy-800">
                      {service.averageRating.toFixed(1)}
                      <span className="ml-1 font-normal text-muted-foreground">
                        ({service.reviewCount} reviews)
                      </span>
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Booking card — sticky on desktop so the CTA never scrolls away. */}
            <aside className="rounded-2xl border border-border bg-card p-6 shadow-lift lg:sticky lg:top-28">
              <p className="text-sm text-muted-foreground">From</p>
              <p className="mt-1 font-display text-3xl font-bold text-navy-800">
                {formatNaira(service.priceKobo)}
              </p>

              {service.homeVisitSurchargeKobo > 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Home visits add {formatNaira(service.homeVisitSurchargeKobo)}
                </p>
              )}

              <ul className="mt-5 space-y-2 border-t border-border pt-5 text-sm">
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  {service.durationMinutes}-minute appointment
                </li>
                {locations.map((location) => (
                  <li key={location} className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                    Available as a {LABELS.locationType[location].toLowerCase()}
                  </li>
                ))}
                <li className="flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600" aria-hidden />
                  Free cancellation up to 24 hours before
                </li>
              </ul>

              <Button asChild size="lg" className="mt-6 w-full">
                <Link href={`/book?service=${service.slug}`}>
                  <CalendarCheck className="size-4" />
                  Book this service
                </Link>
              </Button>

              <p className="mt-3 text-center text-xs text-muted-foreground">
                Live availability · Secure online payment
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* Body */}
      <section className="section">
        <div className="container">
          <div className="grid gap-12 lg:grid-cols-[1.6fr_1fr] lg:items-start">
            <div className="space-y-10">
              <Block title="About this service">
                <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
                  {service.description.split('\n\n').map((paragraph, i) => (
                    <p key={i}>{paragraph}</p>
                  ))}
                </div>
              </Block>

              {service.whatsIncluded.length > 0 && (
                <Block title="What's included">
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {service.whatsIncluded.map((item) => (
                      <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
                        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              {service.requirements.length > 0 && (
                <Block title="What you'll need" icon={ClipboardList}>
                  <ul className="space-y-2.5">
                    {service.requirements.map((item) => (
                      <li key={item} className="flex gap-2.5 text-sm text-muted-foreground">
                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" aria-hidden />
                        {item}
                      </li>
                    ))}
                  </ul>
                </Block>
              )}

              {service.preparation.length > 0 && (
                <Block title="How to prepare" icon={Info}>
                  <ol className="space-y-3">
                    {service.preparation.map((item, index) => (
                      <li key={item} className="flex gap-3 text-sm text-muted-foreground">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700">
                          {index + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </Block>
              )}

              {service.faqs.length > 0 && (
                <Block title="Frequently asked questions">
                  <div className="divide-y divide-border rounded-xl border border-border">
                    {service.faqs.map((faq) => (
                      <details key={faq.question} className="group px-5 py-4">
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-navy-800">
                          {faq.question}
                          <span
                            className="shrink-0 text-muted-foreground transition-transform group-open:rotate-45"
                            aria-hidden
                          >
                            +
                          </span>
                        </summary>
                        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                          {faq.answer}
                        </p>
                      </details>
                    ))}
                  </div>
                </Block>
              )}

              {reviews.length > 0 && (
                <Block title="What patients say">
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <figure
                        key={review.id}
                        className="rounded-xl border border-border bg-card p-5 shadow-card"
                      >
                        <div
                          className="flex gap-0.5"
                          aria-label={`${review.rating} out of 5 stars`}
                        >
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={
                                i < review.rating
                                  ? 'size-4 fill-amber-400 text-amber-400'
                                  : 'size-4 text-slate-200'
                              }
                              aria-hidden
                            />
                          ))}
                        </div>
                        <blockquote className="mt-3 text-sm leading-relaxed text-navy-800">
                          “{review.comment}”
                        </blockquote>
                        <figcaption className="mt-3 text-xs text-muted-foreground">
                          {review.author} ·{' '}
                          <time dateTime={review.createdAt}>
                            {new Date(review.createdAt).toLocaleDateString('en-NG', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric',
                            })}
                          </time>
                        </figcaption>
                        {review.response && (
                          <p className="mt-3 rounded-lg bg-secondary/60 p-3 text-xs text-muted-foreground">
                            <span className="font-semibold text-navy-800">
                              NurseOnCall replied:
                            </span>{' '}
                            {review.response}
                          </p>
                        )}
                      </figure>
                    ))}
                  </div>
                </Block>
              )}
            </div>

            <aside className="space-y-4">
              <div className="rounded-2xl bg-navy-800 p-6 text-white">
                <h2 className="font-display text-lg font-bold">Not sure this is right?</h2>
                <p className="mt-2 text-sm text-white/75">
                  Call us and we&apos;ll help you pick the service that actually fits — even if
                  that means booking nothing today.
                </p>
                <Button asChild variant="accent" className="mt-5 w-full">
                  <a href={contact.phoneHref}>Call {contact.phone}</a>
                </Button>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section bg-secondary/40">
          <div className="container">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow">Related</p>
                <h2 className="mt-2 font-display text-2xl font-bold tracking-tight sm:text-3xl">
                  You might also need
                </h2>
              </div>
              <Button asChild variant="ghost" className="hidden sm:inline-flex">
                <Link href="/services">
                  All services
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <ServiceCard key={item.id} service={item} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function Block({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
        {Icon && <Icon className="size-5 text-crimson-600" aria-hidden />}
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </div>
  );
}
