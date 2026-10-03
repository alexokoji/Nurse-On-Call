import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  HeartHandshake,
  Phone,
  ShieldCheck,
  Sparkles,
  Star,
  UserRoundCheck,
  Users,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ServiceIcon } from '@/components/public/service-icon';
import { formatNaira, formatNumber } from '@/lib/utils';
import { LABELS } from '@/types';
import type { ServiceType } from '@/types';
import {
  getFeaturedServices,
  getServiceCategories,
  getPublicStats,
  getTestimonials,
  getPublicTeam,
} from '@/lib/queries/public';
import { getContactDetails, type ContactDetails } from '@/lib/settings/contact';

export const metadata: Metadata = {
  title: 'Quality Healthcare, When You Need It',
  description:
    'Book professional nursing, doctor consultations, physiotherapy, lab tests and medication ' +
    'delivery at home, in our Port Harcourt clinic, or online.',
  alternates: { canonical: '/' },
};

export default async function HomePage() {
  const contact = await getContactDetails();
  const [services, categories, stats, testimonials, team] = await Promise.all([
    getFeaturedServices(5),
    getServiceCategories(),
    getPublicStats(),
    getTestimonials(3),
    getPublicTeam(4),
  ]);

  return (
    <>
      <Hero stats={stats} />
      {categories.length > 0 && <Categories categories={categories} />}
      {services.length > 0 && <FeaturedServices services={services} />}
      <WhyChooseUs />
      <HowItWorks />
      {team.length > 0 && <TeamStrip team={team} />}
      {testimonials.length > 0 && <Testimonials testimonials={testimonials} stats={stats} />}
      <FinalCta contact={contact} />
    </>
  );
}

/* ── Hero ─────────────────────────────────────────────────────────── */

function Hero({ stats }: { stats: Awaited<ReturnType<typeof getPublicStats>> }) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/70 via-background to-background">
      {/* Decorative wash — hidden from assistive tech. */}
      <div
        className="pointer-events-none absolute -right-40 -top-40 size-[34rem] rounded-full bg-crimson-100/40 blur-3xl"
        aria-hidden
      />
      <div className="container relative grid gap-12 py-16 md:py-24 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-crimson-200 bg-crimson-50 px-3 py-1 text-xs font-semibold text-crimson-700">
            <Sparkles className="size-3.5" aria-hidden />
            Trusted care across Nigeria
          </span>

          <h1 className="mt-5 text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-navy-800 sm:text-5xl lg:text-6xl">
            Quality Healthcare,{' '}
            <span className="text-crimson-600">When You Need It.</span>
          </h1>

          <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Professional, compassionate care delivered where it suits you — in the comfort of your
            home, at our Port Harcourt clinic, or online. Our own clinical team, never a
            marketplace of strangers.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/book">
                <CalendarCheck className="size-4" />
                Book a Service
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/services">
                Explore Services
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>

          <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
            <TrustStat
              icon={ShieldCheck}
              label="Verified & reliable"
              value="Trusted"
            />
            <TrustStat
              icon={Users}
              label="Trained & experienced"
              value={stats.staff > 0 ? `${stats.staff}+ staff` : 'Professional'}
            />
            <TrustStat icon={Clock} label="We're here anytime" value="24/7" />
          </dl>
        </div>

        {/* Hero photography, with two facts floated over it. */}
        <div
          className="relative animate-fade-up lg:justify-self-end"
          style={{ animationDelay: '120ms' }}
        >
          <div className="relative mx-auto w-full max-w-md">
            {/* Brand-tinted plate sitting behind the photo. */}
            <div
              className="absolute -right-4 -top-4 hidden h-full w-full rounded-3xl bg-crimson-100/60 sm:block"
              aria-hidden
            />

            <div className="relative overflow-hidden rounded-3xl shadow-lift ring-1 ring-black/5">
              <Image
                src="/images/hero-nurse-patient.jpg"
                alt="A NurseOnCall nurse in blue scrubs checking a patient's blood pressure"
                width={1600}
                height={2207}
                /* The hero image is the LCP element, so it is loaded eagerly
                   and given explicit sizes rather than being lazy-loaded. */
                priority
                sizes="(min-width: 1024px) 28rem, (min-width: 640px) 60vw, 90vw"
                className="h-[26rem] w-full object-cover object-top sm:h-[30rem] lg:h-[34rem]"
              />

              {/* Gradient so the overlaid card stays legible on any crop. */}
              <div
                className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-navy-950/60 to-transparent"
                aria-hidden
              />
            </div>

            {/* Trust badge — real completed-service count from the database. */}
            <div className="absolute -bottom-5 -left-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-lift sm:-left-6">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2 className="size-4" aria-hidden />
                </span>
                <span className="text-xs font-semibold text-navy-800">
                  {stats.appointments > 0
                    ? `${formatNumber(stats.appointments)} services completed`
                    : 'Care you can count on'}
                </span>
              </div>
            </div>

            {/* Availability badge. */}
            <div className="absolute -right-3 top-8 hidden rounded-2xl border border-border bg-card px-4 py-3 shadow-lift sm:block lg:-right-6">
              <div className="flex items-center gap-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-crimson-50 text-crimson-600">
                  <HeartHandshake className="size-4" aria-hidden />
                </span>
                <span className="text-xs">
                  <span className="block font-semibold text-navy-800">Home visits daily</span>
                  <span className="block text-muted-foreground">08:00 – 18:00</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function TrustStat({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div>
      <Icon className="size-5 text-brand-600" aria-hidden />
      <dt className="mt-2 text-sm font-semibold text-navy-800">{value}</dt>
      <dd className="text-xs text-muted-foreground">{label}</dd>
    </div>
  );
}

/* ── Categories ───────────────────────────────────────────────────── */

function Categories({
  categories,
}: {
  categories: Awaited<ReturnType<typeof getServiceCategories>>;
}) {
  return (
    <section className="section">
      <div className="container">
        <SectionHeading
          eyebrow="Our Services"
          title="Comprehensive Care Services"
          description="A full range of healthcare services tailored to your needs — professional care, right where you are."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/services?category=${category.slug}`}
              className="group rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lift"
            >
              <ServiceIcon icon={category.icon} accent={category.accent} />
              <h3 className="mt-4 text-base font-semibold text-navy-800">{category.name}</h3>
              {category.description && (
                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">
                  {category.description}
                </p>
              )}
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                Learn more
                <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── Featured services ────────────────────────────────────────────── */

function FeaturedServices({
  services,
}: {
  services: Awaited<ReturnType<typeof getFeaturedServices>>;
}) {
  return (
    <section className="section bg-secondary/40">
      <div className="container">
        <SectionHeading
          eyebrow="Most Booked"
          title="Care Our Patients Rely On"
          description="Transparent pricing, no hidden fees. Every price below is what you pay."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <article
              key={service.id}
              className="flex flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-shadow hover:shadow-lift"
            >
              <div className="flex items-start justify-between gap-3">
                <ServiceIcon icon={service.icon} accent={service.category?.accent ?? 'crimson'} />
                {service.reviewCount > 0 && (
                  <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                    <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden />
                    {service.averageRating.toFixed(1)}
                    <span className="sr-only">out of 5 from {service.reviewCount} reviews</span>
                  </span>
                )}
              </div>

              <h3 className="mt-4 text-base font-semibold text-navy-800">{service.name}</h3>
              <p className="mt-2 line-clamp-2 flex-1 text-sm text-muted-foreground">
                {service.shortDescription}
              </p>

              <dl className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5" aria-hidden />
                  <dd>{service.durationMinutes} mins</dd>
                </div>
                <div className="flex items-center gap-1.5">
                  <UserRoundCheck className="size-3.5" aria-hidden />
                  <dd>{LABELS.serviceType[service.serviceType as ServiceType]}</dd>
                </div>
              </dl>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <div>
                  <p className="text-lg font-bold text-navy-800">{formatNaira(service.priceKobo)}</p>
                  <p className="text-[11px] text-muted-foreground">per session</p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/book?service=${service.slug}`}>Book now</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Button asChild variant="outline" size="lg">
            <Link href="/services">
              View all services
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ── Why choose us ────────────────────────────────────────────────── */

const REASONS = [
  {
    icon: ShieldCheck,
    title: 'Safe & Secure',
    body: 'Your health information is encrypted and handled under strict confidentiality by our own staff.',
  },
  {
    icon: Users,
    title: 'Experienced Team',
    body: 'Licensed nurses, doctors and therapists we employ, train and supervise directly.',
  },
  {
    icon: CalendarCheck,
    title: 'Convenient & Flexible',
    body: 'Real availability, shown live. Book, reschedule or cancel around your own schedule.',
  },
  {
    icon: Wallet,
    title: 'Affordable Care',
    body: 'Clear pricing before you commit. Pay securely online with the method you prefer.',
  },
];

function WhyChooseUs() {
  return (
    <section className="section">
      <div className="container">
        <SectionHeading
          eyebrow="Why Choose Us"
          title="Your Health, Our Priority"
          description="We are committed to exceptional healthcare delivered with compassion and excellence."
        />

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {REASONS.map((reason) => (
            <div key={reason.title} className="text-center sm:text-left">
              <span className="inline-flex size-12 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600">
                <reason.icon className="size-5" strokeWidth={1.9} aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-navy-800">{reason.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{reason.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── How it works ─────────────────────────────────────────────────── */

const STEPS = [
  { title: 'Book a Service', body: 'Choose a service and pick a date and time that suits you.' },
  { title: 'We Confirm', body: 'We confirm your booking and assign the right care professional.' },
  { title: 'We Come to You', body: 'Your professional arrives at your location, or you join online.' },
  { title: 'You Feel Better', body: 'Receive quality care and focus on what matters — your health.' },
];

function HowItWorks() {
  return (
    <section className="section bg-navy-800 text-white">
      <div className="container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-crimson-400">
            How It Works
          </p>
          <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Simple Steps to Get Care
          </h2>
        </div>

        <ol className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="relative rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <span className="flex size-9 items-center justify-center rounded-full bg-crimson-500 text-sm font-bold text-navy-900">
                {index + 1}
              </span>
              <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/70">{step.body}</p>
            </li>
          ))}
        </ol>

        <div className="mt-12 text-center">
          <Button asChild size="lg" variant="accent">
            <Link href="/book">Book Your Service Now</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ── Team ─────────────────────────────────────────────────────────── */

function TeamStrip({ team }: { team: Awaited<ReturnType<typeof getPublicTeam>> }) {
  return (
    <section className="section">
      <div className="container">
        <SectionHeading
          eyebrow="Our Team"
          title="Care From People You Can Name"
          description="Every professional here is part of our own clinical team — employed, trained and accountable to us."
        />

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {team.map((member) => (
            <div key={member.id} className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
              <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand-50 text-lg font-bold text-brand-700">
                {member.name
                  .split(' ')
                  .slice(0, 2)
                  .map((part) => part[0])
                  .join('')}
              </span>
              <h3 className="mt-4 text-sm font-semibold text-navy-800">{member.name}</h3>
              <p className="text-xs text-muted-foreground">
                {LABELS.staffRole[member.title as keyof typeof LABELS.staffRole]}
              </p>
              {member.yearsOfExperience > 0 && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {member.yearsOfExperience} years&apos; experience
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 text-center">
          <Button asChild variant="ghost">
            <Link href="/team">
              Meet the full team
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ── Testimonials ─────────────────────────────────────────────────── */

function Testimonials({
  testimonials,
  stats,
}: {
  testimonials: Awaited<ReturnType<typeof getTestimonials>>;
  stats: Awaited<ReturnType<typeof getPublicStats>>;
}) {
  return (
    <section className="section bg-secondary/40">
      <div className="container">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow">Trusted by families</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              What Our Patients Say
            </h2>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {testimonials.map((testimonial) => (
                <figure
                  key={testimonial.id}
                  className="rounded-2xl border border-border bg-card p-6 shadow-card"
                >
                  <div className="flex gap-0.5" aria-label={`${testimonial.rating} out of 5 stars`}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={
                          i < testimonial.rating
                            ? 'size-4 fill-amber-400 text-amber-400'
                            : 'size-4 text-slate-200'
                        }
                        aria-hidden
                      />
                    ))}
                  </div>
                  <blockquote className="mt-3 text-sm leading-relaxed text-navy-800">
                    “{testimonial.comment}”
                  </blockquote>
                  <figcaption className="mt-4 text-xs text-muted-foreground">
                    <span className="font-semibold text-navy-800">{testimonial.author}</span>
                    {testimonial.service && <> · {testimonial.service}</>}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>

          <dl className="grid grid-cols-2 gap-4">
            <StatTile
              icon={Users}
              value={stats.patients > 0 ? `${formatNumber(stats.patients)}+` : '—'}
              label="Patients cared for"
            />
            <StatTile
              icon={CheckCircle2}
              value={stats.appointments > 0 ? `${formatNumber(stats.appointments)}+` : '—'}
              label="Services completed"
            />
            <StatTile
              icon={UserRoundCheck}
              value={stats.staff > 0 ? `${stats.staff}` : '—'}
              label="Care professionals"
            />
            <StatTile icon={Clock} value="24/7" label="Support available" />
          </dl>
        </div>
      </div>
    </section>
  );
}

function StatTile({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-card">
      <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-crimson-50 text-crimson-600">
        <Icon className="size-5" aria-hidden />
      </span>
      <dt className="mt-3 font-display text-2xl font-bold text-navy-800">{value}</dt>
      <dd className="mt-1 text-xs text-muted-foreground">{label}</dd>
    </div>
  );
}

/* ── Final CTA ────────────────────────────────────────────────────── */

function FinalCta({ contact }: { contact: ContactDetails }) {
  return (
    <section className="pb-16 md:pb-24">
      <div className="container">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-navy-800 px-6 py-12 text-center shadow-lift sm:px-12 sm:text-left">
          <div className="flex flex-col items-center gap-8 sm:flex-row sm:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
                Need Care? We&apos;re Here to Help.
              </h2>
              <p className="mt-3 text-sm text-white/80 sm:text-base">
                Book a service now, or call us for immediate assistance. Someone answers, any hour.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
              <Button asChild size="lg" className="bg-white text-brand-700 hover:bg-white/90">
                <Link href="/book">
                  <CalendarCheck className="size-4" />
                  Book a Service
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <a href={contact.phoneHref}>
                  <Phone className="size-4" />
                  {contact.phone}
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── Shared ───────────────────────────────────────────────────────── */

function SectionHeading({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-3 text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl">
        {title}
      </h2>
      {description && (
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
