import type { Metadata } from 'next';
import Link from 'next/link';
import {
  Award,
  CalendarCheck,
  HeartHandshake,
  ShieldCheck,
  Target,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatNumber } from '@/lib/utils';
import { getPublicStats } from '@/lib/queries/public';

export const metadata: Metadata = {
  title: 'About Us',
  description:
    'NurseOnCall delivers professional healthcare at home, in clinic and online across Port ' +
    'Harcourt and Rivers State — with our own employed clinical team, not a marketplace.',
  alternates: { canonical: '/about' },
};

const VALUES = [
  {
    icon: HeartHandshake,
    title: 'Compassion first',
    body: 'Clinical skill without kindness is only half the job. We hire for both and we let people go for the absence of either.',
  },
  {
    icon: ShieldCheck,
    title: 'Accountability',
    body: 'Every professional here is on our staff — trained, supervised and answerable to us. There is no one to pass blame to.',
  },
  {
    icon: Award,
    title: 'Clinical excellence',
    body: 'Licensed practitioners, documented protocols, and a clinical lead who reviews abnormal results before they reach you.',
  },
  {
    icon: Target,
    title: 'Honest pricing',
    body: 'The price on the page is the price you pay. Surcharges are shown before you commit, never after.',
  },
];

export default async function AboutPage() {
  const stats = await getPublicStats();

  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50/60 to-background">
        <div className="container py-12 md:py-20">
          <p className="eyebrow">About Us</p>
          <h1 className="mt-3 max-w-3xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Healthcare that shows up — where you are, when you need it
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            NurseOnCall was built around a simple observation: for a great deal of care, the
            hospital journey is the hardest part. The traffic, the queue, the waiting room, the
            day off work. For a nurse&apos;s visit, a follow-up consultation or a blood sample,
            none of that is clinically necessary.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container grid gap-12 lg:grid-cols-2 lg:items-start">
          <div className="space-y-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
            <h2 className="font-display text-2xl font-bold tracking-tight text-navy-800">
              Our story
            </h2>
            <p>
              We started in Port Harcourt with a small team of nurses making home visits for
              patients discharged after surgery. The demand was immediate and it was not
              subtle — families were managing complex wound care and medication schedules with
              no clinical support between hospital appointments.
            </p>
            <p>
              We grew deliberately rather than quickly. Each new service — doctor consultations,
              physiotherapy, laboratory work, pharmacy delivery — was added only once we had
              employed the right people to run it properly.
            </p>
            <p>
              That is why we are not a marketplace. We do not connect you to independent
              providers and take a cut. Every nurse, doctor, physiotherapist, pharmacist and
              technician who attends you is on our payroll, carries our training, and is
              supervised by our clinical lead. If something goes wrong, there is exactly one
              organisation responsible for putting it right.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              icon={Users}
              value={stats.patients > 0 ? `${formatNumber(stats.patients)}+` : '—'}
              label="Patients cared for"
            />
            <StatCard
              icon={CalendarCheck}
              value={stats.appointments > 0 ? `${formatNumber(stats.appointments)}+` : '—'}
              label="Services completed"
            />
            <StatCard
              icon={HeartHandshake}
              value={stats.staff > 0 ? String(stats.staff) : '—'}
              label="Care professionals"
            />
            <StatCard
              icon={Award}
              value={stats.services > 0 ? String(stats.services) : '—'}
              label="Services offered"
            />
          </div>
        </div>
      </section>

      <section className="section bg-secondary/40">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <p className="eyebrow">What we stand for</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Four things we will not compromise on
            </h2>
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {VALUES.map((value) => (
              <div key={value.title} className="rounded-2xl border border-border bg-card p-6 shadow-card">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600">
                  <value.icon className="size-5" strokeWidth={1.9} aria-hidden />
                </span>
                <h3 className="mt-4 text-base font-semibold text-navy-800">{value.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{value.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="rounded-3xl bg-gradient-to-br from-brand-600 to-navy-800 px-6 py-12 text-center sm:px-12">
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              Ready when you are
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-white/80 sm:text-base">
              Browse what we offer, or speak to someone first. Both are fine.
            </p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild size="lg" className="bg-white text-brand-700 hover:bg-white/90">
                <Link href="/book">Book a service</Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="border-white/40 bg-transparent text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/contact">Talk to us</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <Icon className="size-5 text-brand-600" aria-hidden />
      <p className="mt-3 font-display text-2xl font-bold text-navy-800">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
