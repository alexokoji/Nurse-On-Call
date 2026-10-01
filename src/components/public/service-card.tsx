import Link from 'next/link';
import Image from 'next/image';
import { cloudinaryVariant } from '@/lib/storage/image-url';
import { Clock, MapPin, Star } from 'lucide-react';
import { ServiceIcon } from './service-icon';
import { Button } from '@/components/ui/button';
import { formatNaira } from '@/lib/utils';
import { LABELS, type ServiceType } from '@/types';
import type { PublicService } from '@/lib/queries/public';

export function ServiceCard({ service }: { service: PublicService }) {
  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift">
      {/* A service only shows a photo once one has been uploaded; without it
          the card keeps its icon-led layout rather than a grey placeholder. */}
      {service.image && (
        <Link href={`/services/${service.slug}`} className="relative block aspect-[16/10]">
          <Image
            src={cloudinaryVariant(service.image, 'c_fill,w_600,h_375,q_auto,f_auto')}
            alt=""
            fill
            sizes="(min-width: 1024px) 24rem, (min-width: 640px) 45vw, 90vw"
            className="object-cover"
          />
        </Link>
      )}

      <div className="flex flex-1 flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <ServiceIcon icon={service.icon} accent={service.category?.accent ?? 'crimson'} />
        {service.reviewCount > 0 && (
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
            {service.averageRating.toFixed(1)}
            <span className="sr-only">out of 5, from {service.reviewCount} reviews</span>
            <span aria-hidden>({service.reviewCount})</span>
          </span>
        )}
      </div>

      <h3 className="mt-4 text-base font-semibold text-navy-800">
        <Link href={`/services/${service.slug}`} className="hover:text-primary">
          {/* Stretches the link over the card without breaking the nested button. */}
          {service.name}
        </Link>
      </h3>

      {service.category && (
        <p className="mt-1 text-xs font-medium text-crimson-600">{service.category.name}</p>
      )}

      <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
        {service.shortDescription}
      </p>

      <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Duration</dt>
          <Clock className="size-3.5" aria-hidden />
          <dd>{service.durationMinutes} mins</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Where it&apos;s delivered</dt>
          <MapPin className="size-3.5" aria-hidden />
          <dd>{LABELS.serviceType[service.serviceType as ServiceType]}</dd>
        </div>
      </dl>

      <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-lg font-bold text-navy-800">{formatNaira(service.priceKobo)}</p>
          {service.homeVisitSurchargeKobo > 0 && (
            <p className="text-[11px] text-muted-foreground">
              +{formatNaira(service.homeVisitSurchargeKobo)} for home visits
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button asChild size="sm" variant="outline">
            <Link href={`/services/${service.slug}`}>Details</Link>
          </Button>
          <Button asChild size="sm">
            <Link href={`/book?service=${service.slug}`}>Book</Link>
          </Button>
        </div>
      </div>
      </div>
    </article>
  );
}
