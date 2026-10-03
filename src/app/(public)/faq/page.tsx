import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { getSettings } from '@/lib/settings';
import { getContactDetails } from '@/lib/settings/contact';

export const metadata: Metadata = {
  title: 'Frequently Asked Questions',
  description:
    'Answers on booking, payment, cancellations, refunds, home visits and privacy at ' +
    'NurseOnCall.',
  alternates: { canonical: '/faq' },
};

interface FaqGroup {
  heading: string;
  items: { question: string; answer: string }[];
}

export default async function FaqPage() {
  const contact = await getContactDetails();
  const booking = await getSettings('booking');

  const groups: FaqGroup[] = [
    {
      heading: 'Booking',
      items: [
        {
          question: 'How do I book an appointment?',
          answer:
            'Choose a service, pick where you want it delivered, then select a date and time ' +
            'from the live availability calendar. Add your details, pay securely, and you are ' +
            'booked. The whole flow usually takes under two minutes.',
        },
        {
          question: 'How far ahead can I book?',
          answer:
            `You can book up to ${booking.maximumAdvanceDays} days ahead. The earliest slot ` +
            `available is ${booking.minimumNoticeHours} hours from now, which gives us time to ` +
            `assign the right person and get them to you.`,
        },
        {
          question: 'Can I choose which nurse or doctor attends?',
          answer:
            'Yes. During booking you can pick from the professionals qualified for that ' +
            'service. If you do not choose, we assign whoever is free and least loaded that day.',
        },
        {
          question: 'Why is my preferred time greyed out?',
          answer:
            'A greyed slot means every qualified professional is already committed at that ' +
            'time, or it falls inside a break, leave or closure. The calendar shows real ' +
            'availability — nothing is held back.',
        },
      ],
    },
    {
      heading: 'Payment',
      items: [
        {
          question: 'How do I pay?',
          answer:
            'Securely online at the end of booking, by card, bank transfer or USSD, through ' +
            'our payment partners. We never see or store your card details.',
        },
        {
          question: 'Is the price shown the full price?',
          answer:
            'Yes. The service price is shown up front, and any home-visit surcharge is added ' +
            'and displayed before you pay. There are no fees added afterwards.',
        },
        {
          question: 'When does my slot get confirmed?',
          answer:
            `Your slot is held while you pay, and confirms the moment your payment is verified ` +
            `with the bank. If payment is not completed within ${booking.paymentHoldMinutes} ` +
            `minutes, the slot is released for someone else.`,
        },
        {
          question: 'Do you send receipts?',
          answer:
            'A receipt is generated automatically for every successful payment and is ' +
            'available in your dashboard under Receipts, as well as being emailed to you.',
        },
      ],
    },
    {
      heading: 'Changes, cancellations and refunds',
      items: [
        {
          question: 'Can I reschedule?',
          answer:
            'Yes, from your dashboard, as long as the appointment has not started. You will ' +
            'see live availability again and can move to any open slot at no extra cost.',
        },
        {
          question: 'What is the cancellation policy?',
          answer: booking.cancellationPolicy,
        },
        {
          question: 'How long do refunds take?',
          answer:
            'Once approved, refunds are submitted to the payment provider the same working ' +
            'day. Depending on your bank, the money usually appears within 3–10 working days.',
        },
      ],
    },
    {
      heading: 'Home visits',
      items: [
        {
          question: 'Which areas do you cover?',
          answer:
            'We cover Port Harcourt and the surrounding Rivers State area, including GRA, ' +
            'Rumuola, D/Line, Woji, Trans-Amadi, Eliozu, Choba and Rumuokoro. If you are ' +
            'unsure about your area, call us before booking.',
        },
        {
          question: 'What should I prepare before a home visit?',
          answer:
            'Clear a well-lit space, have any medication and recent results to hand, and make ' +
            'sure an adult is present. Each service page lists anything specific to that visit.',
        },
        {
          question: 'What if nobody is home when the professional arrives?',
          answer:
            'We will call the number on your booking. If we cannot reach you, the appointment ' +
            'is recorded as a no-show, which is not refundable under our policy.',
        },
      ],
    },
    {
      heading: 'Privacy and safety',
      items: [
        {
          question: 'Who can see my health information?',
          answer:
            'Only the clinical staff treating you and the administrators who need it to run ' +
            'your appointment. Access is controlled by role, and every administrative action ' +
            'on your record is logged.',
        },
        {
          question: 'Are your staff licensed?',
          answer:
            'Yes. Every clinician is licensed with their professional body, employed directly ' +
            'by us, and supervised by our clinical lead. We are not a marketplace of ' +
            'independent contractors.',
        },
        {
          question: 'What if I am unhappy with a visit?',
          answer:
            'Tell us. Raise it from your dashboard under Support or call us. Because our staff ' +
            'are employed rather than contracted, we can act on it directly.',
        },
      ],
    },
  ];

  /* FAQ structured data, so these answers can surface directly in search. */
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: groups.flatMap((group) =>
      group.items.map((item) => ({
        '@type': 'Question',
        name: item.question,
        acceptedAnswer: { '@type': 'Answer', text: item.answer },
      })),
    ),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <section className="border-b border-border bg-gradient-to-b from-brand-50/60 to-background">
        <div className="container py-12 md:py-16">
          <p className="eyebrow">Help Centre</p>
          <h1 className="mt-3 max-w-2xl text-balance font-display text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Frequently asked questions
          </h1>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground">
            If your question isn&apos;t here, call us on {contact.phone} — we would rather answer
            it than have you guess.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container max-w-3xl space-y-12">
          {groups.map((group) => (
            <div key={group.heading}>
              <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">
                {group.heading}
              </h2>

              <div className="mt-4 divide-y divide-border rounded-xl border border-border bg-card">
                {group.items.map((item) => (
                  <details key={item.question} className="group px-5 py-4">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium text-navy-800">
                      {item.question}
                      <span
                        className="shrink-0 text-lg leading-none text-muted-foreground transition-transform group-open:rotate-45"
                        aria-hidden
                      >
                        +
                      </span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                      {item.answer}
                    </p>
                  </details>
                ))}
              </div>
            </div>
          ))}

          <div className="rounded-2xl border border-border bg-secondary/50 p-8 text-center">
            <h2 className="font-display text-lg font-bold text-navy-800">Still stuck?</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
              Our team is available around the clock.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
              <Button asChild>
                <Link href="/contact">Send us a message</Link>
              </Button>
              <Button asChild variant="outline">
                <a href={contact.phoneHref}>Call {contact.phone}</a>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
