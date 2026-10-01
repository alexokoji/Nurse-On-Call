import type { Metadata } from 'next';
import Link from 'next/link';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'The terms on which NurseOnCall provides healthcare services, takes bookings and handles ' +
    'payments, cancellations and refunds.',
  alternates: { canonical: '/terms' },
};

export default async function TermsPage() {
  const [general, booking] = await Promise.all([getSettings('general'), getSettings('booking')]);

  return (
    <div className="section">
      <div className="container max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Terms of Service
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated {new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <Section title="1. About these terms">
            <p>
              These terms govern your use of {general.organisationName} and the services we
              provide. By booking with us you agree to them. If you do not agree, please do not
              use the service.
            </p>
          </Section>

          <Section title="2. Who provides your care">
            <p>
              All care is delivered by clinicians employed by {general.organisationName} — we are
              not a marketplace and we do not connect you to independent practitioners. Every nurse,
              doctor, physiotherapist, pharmacist and technician who attends you is on our staff,
              holds a current professional licence, and is supervised by our clinical lead.
            </p>
          </Section>

          <Section title="3. Booking an appointment">
            <ul className="space-y-2">
              <Bullet>
                Availability shown during booking is live. A slot is not reserved until your
                booking is created.
              </Bullet>
              <Bullet>
                The earliest bookable slot is {booking.minimumNoticeHours} hours ahead, and you can
                book up to {booking.maximumAdvanceDays} days in advance.
              </Bullet>
              <Bullet>
                An unpaid booking holds its slot for {booking.paymentHoldMinutes} minutes. After
                that the slot is released for other patients.
              </Bullet>
              <Bullet>
                You must give accurate information. Care decisions are made on what you tell us.
              </Bullet>
            </ul>
          </Section>

          <Section title="4. Payment">
            <ul className="space-y-2">
              <Bullet>
                The price shown before you pay is the full price. Home-visit surcharges are
                displayed separately and included in the total.
              </Bullet>
              <Bullet>
                Payment is taken by our payment partners. We never see or store your card details.
              </Bullet>
              <Bullet>
                A booking is confirmed only once payment is verified with your bank — a redirect
                back to our site is not itself confirmation.
              </Bullet>
              <Bullet>
                Where a service requires medication or laboratory consumables, those costs are
                confirmed with you separately before they are incurred.
              </Bullet>
            </ul>
          </Section>

          <Section title="5. Cancellations and refunds">
            <p>{booking.cancellationPolicy}</p>
            <p className="mt-3">
              You can cancel or reschedule from your dashboard at any time before the appointment
              starts. Approved refunds are submitted to the payment provider the same working day;
              your bank typically takes 3–10 working days to credit them.
            </p>
          </Section>

          <Section title="6. Home visits">
            <ul className="space-y-2">
              <Bullet>An adult aged 18 or over must be present at the address.</Bullet>
              <Bullet>
                You must provide a safe environment for our staff. We may end a visit and leave if
                a member of staff is threatened or at risk.
              </Bullet>
              <Bullet>
                If we cannot reach you and nobody is present, the appointment is recorded as a
                no-show and is not refundable.
              </Bullet>
            </ul>
          </Section>

          <Section title="7. Clinical limitations">
            <p>
              Our services do not replace emergency care. If someone is seriously unwell or in
              immediate danger, call our line or go to the nearest emergency department. Some
              conditions require an in-person examination; where a virtual consultation is not
              clinically adequate, our clinician will tell you and help you book an in-person
              appointment.
            </p>
          </Section>

          <Section title="8. Your account">
            <p>
              You are responsible for keeping your password confidential and for activity on your
              account. Tell us immediately if you believe someone else has access. We may suspend
              an account we reasonably believe is being misused.
            </p>
          </Section>

          <Section title="9. Your information">
            <p>
              How we handle your personal and health information is set out in our{' '}
              <Link href="/privacy" className="font-medium text-primary hover:underline">
                Privacy Policy
              </Link>
              , which forms part of these terms.
            </p>
          </Section>

          <Section title="10. Complaints">
            <p>
              If something goes wrong, tell us. Raise it from your dashboard under Support, email{' '}
              {general.supportEmail}, or call {general.phone}. Because our clinicians are employed
              rather than contracted, we can act on complaints directly.
            </p>
          </Section>

          <Section title="11. Changes to these terms">
            <p>
              We may update these terms. Material changes will be communicated before they take
              effect, and the terms that applied when you booked continue to govern that booking.
            </p>
          </Section>

          <Section title="12. Governing law">
            <p>
              These terms are governed by the laws of the Federal Republic of Nigeria, and the
              courts of Rivers State have jurisdiction over any dispute.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-crimson-500" aria-hidden />
      <span>{children}</span>
    </li>
  );
}
