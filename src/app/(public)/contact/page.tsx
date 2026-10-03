import type { Metadata } from 'next';
import { Clock, Mail, MapPin, MessageSquare, Phone } from 'lucide-react';
import { ContactForm } from './contact-form';
import { getContactDetails } from '@/lib/settings/contact';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Reach NurseOnCall by phone, email or message. We are available 24/7 across Port Harcourt ' +
    'and Rivers State.',
  alternates: { canonical: '/contact' },
};

/**
 * Built per request from Settings → General rather than held in a module
 * constant, so changing the phone number in the admin changes it here.
 * Channels with nothing configured are dropped instead of shown empty.
 */
function channels(contact: Awaited<ReturnType<typeof getContactDetails>>) {
  return [
    contact.phone && {
      icon: Phone,
      label: 'Call us',
      value: contact.phone,
      href: contact.phoneHref,
      note: 'Someone answers, any hour.',
    },
    contact.email && {
      icon: Mail,
      label: 'Email us',
      value: contact.email,
      href: contact.emailHref,
      note: 'We reply within one working day.',
    },
    contact.address && {
      icon: MapPin,
      label: 'Visit the clinic',
      value: contact.address,
      note: undefined,
    },
    {
      icon: Clock,
      label: 'Opening hours',
      value: 'Monday – Sunday, 24 hours',
      note: 'Home visits 08:00 – 18:00 daily.',
    },
  ].filter(Boolean) as {
    icon: typeof Phone;
    label: string;
    value: string;
    href?: string;
    note?: string;
  }[];
}

export default async function ContactPage() {
  const contact = await getContactDetails();
  const CHANNELS = channels(contact);
  return (
    <>
      <section className="border-b border-border bg-gradient-to-b from-brand-50/60 to-background">
        <div className="container py-12 md:py-16">
          <p className="eyebrow">Contact Us</p>
          <h1 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Talk to a person, not a form
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground">
            If it&apos;s urgent, call. If it can wait, the form below reaches the same team.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container grid gap-10 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <div className="space-y-4">
            {CHANNELS.map((channel) => (
              <div
                key={channel.label}
                className="flex gap-4 rounded-2xl border border-border bg-card p-5 shadow-card"
              >
                <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600">
                  <channel.icon className="size-5" strokeWidth={1.9} aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {channel.label}
                  </p>
                  {channel.href ? (
                    <a
                      href={channel.href}
                      className="mt-1 block break-words text-sm font-semibold text-navy-800 hover:text-primary"
                    >
                      {channel.value}
                    </a>
                  ) : (
                    <p className="mt-1 text-sm font-semibold text-navy-800">{channel.value}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">{channel.note}</p>
                </div>
              </div>
            ))}

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <MessageSquare className="size-4" aria-hidden />
                Medical emergency?
              </p>
              <p className="mt-1.5 text-sm text-amber-800">
                This form is not monitored for emergencies. If someone is in immediate danger,
                call our line directly or go to the nearest emergency department.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8">
            <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
              Send us a message
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Tell us what you need and we&apos;ll come back to you.
            </p>
            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
