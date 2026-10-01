import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'How NurseOnCall collects, uses and protects your personal and health information, and the ' +
    'rights you have over it.',
  alternates: { canonical: '/privacy' },
};

export default async function PrivacyPage() {
  const general = await getSettings('general');

  return (
    <div className="section">
      <div className="container max-w-3xl">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Privacy Policy
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated {new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })}
        </p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-muted-foreground">
          <Section title="Who we are">
            <p>
              {general.organisationName} provides healthcare services at home, in clinic and
              online across Port Harcourt and Rivers State. We are the data controller for the
              information described here. You can reach us at {general.supportEmail} or{' '}
              {general.phone}.
            </p>
          </Section>

          <Section title="What we collect">
            <p>We collect only what we need to deliver care safely and to run the service:</p>
            <ul className="mt-3 space-y-2">
              <Bullet>
                <strong className="text-navy-800">Identity and contact details</strong> — your
                name, email address, phone number and, for home visits, your address.
              </Bullet>
              <Bullet>
                <strong className="text-navy-800">Health information</strong> — date of birth,
                allergies, ongoing conditions, and clinical notes recorded during your care.
              </Bullet>
              <Bullet>
                <strong className="text-navy-800">Appointment records</strong> — what you booked,
                when, where, and who attended you.
              </Bullet>
              <Bullet>
                <strong className="text-navy-800">Payment records</strong> — amounts, dates and
                the outcome of each transaction. We never receive or store your card number; that
                is handled entirely by our payment partners.
              </Bullet>
              <Bullet>
                <strong className="text-navy-800">Technical information</strong> — IP address and
                browser details, used for security and to investigate problems.
              </Bullet>
            </ul>
          </Section>

          <Section title="Why we use it">
            <ul className="space-y-2">
              <Bullet>To provide the care you have booked and to keep clinical records.</Bullet>
              <Bullet>To confirm appointments, send reminders and issue receipts.</Bullet>
              <Bullet>To take payment and process refunds.</Bullet>
              <Bullet>To answer your questions and handle complaints.</Bullet>
              <Bullet>
                To meet our legal and professional obligations, including record-keeping
                requirements for clinical care.
              </Bullet>
            </ul>
            <p className="mt-3">
              We do not sell your data, and we do not use your health information for marketing.
            </p>
          </Section>

          <Section title="Who can see it">
            <p>
              Access is restricted by role. The clinicians treating you see your clinical record;
              administrative staff see only what their role requires to run your appointment. Every
              administrative action on a record is written to an audit log showing who did what and
              when.
            </p>
            <p className="mt-3">
              We share data outside the organisation only with our payment providers (to take
              payment), our laboratory partner (to process your samples), and where the law
              requires it.
            </p>
          </Section>

          <Section title="How long we keep it">
            <p>
              Clinical records are retained in line with Nigerian professional record-keeping
              requirements. Payment and invoice records are retained as long as accounting rules
              require. When a retention period ends, records are deleted or irreversibly
              anonymised.
            </p>
          </Section>

          <Section title="How we protect it">
            <ul className="space-y-2">
              <Bullet>Passwords are hashed with bcrypt and are never stored or readable.</Bullet>
              <Bullet>Sessions are signed, expire automatically, and can be revoked.</Bullet>
              <Bullet>Access to records is enforced server-side on every request.</Bullet>
              <Bullet>Administrative changes are recorded in an audit trail.</Bullet>
              <Bullet>Repeated failed sign-ins lock an account temporarily.</Bullet>
            </ul>
          </Section>

          <Section title="Your rights">
            <p>You can ask us to:</p>
            <ul className="mt-3 space-y-2">
              <Bullet>Give you a copy of the information we hold about you.</Bullet>
              <Bullet>Correct anything inaccurate — much of this you can edit yourself.</Bullet>
              <Bullet>
                Delete your information, where we are not required to keep it for clinical or legal
                reasons.
              </Bullet>
              <Bullet>Stop sending you non-essential messages.</Bullet>
            </ul>
            <p className="mt-3">
              Email {general.supportEmail} and we will respond within 30 days. If you are not
              satisfied with our response, you may complain to the Nigeria Data Protection
              Commission.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              We use a single essential cookie to keep you signed in. It contains no advertising or
              tracking identifiers, and we do not use third-party analytics or advertising cookies.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              If we change this policy materially we will tell you before the change takes effect,
              by email or a notice in your dashboard.
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
