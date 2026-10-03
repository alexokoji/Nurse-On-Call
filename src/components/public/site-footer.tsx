import Link from 'next/link';
import { Mail, MapPin, Phone, Clock } from 'lucide-react';
import { Logo } from './logo';
import { getContactDetails } from '@/lib/settings/contact';

const QUICK_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'Services', href: '/services' },
  { label: 'About Us', href: '/about' },
  { label: 'Our Team', href: '/team' },
  { label: 'Health Resources', href: '/health-resources' },
  { label: 'Contact', href: '/contact' },
];

const SUPPORT_LINKS = [
  { label: 'FAQs', href: '/faq' },
  { label: 'Book a Service', href: '/book' },
  { label: 'Patient Login', href: '/login' },
  { label: 'Create Account', href: '/register' },
];

export async function SiteFooter({
  services = [],
  branding,
}: {
  services?: { name: string; slug: string }[];
  branding?: { logo?: string; organisationName?: string };
}) {
  const year = new Date().getFullYear();

  /* Read here rather than taken as a prop: this is a server component, so it
     can reach Settings → General itself, and `getSettings` is request-cached
     so the header's copy costs no second query. */
  const contact = await getContactDetails();

  return (
    <footer className="mt-auto bg-navy-900 text-white/70">
      <div className="container py-14">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <Logo
              variant="light"
              href="/"
              imageUrl={branding?.logo}
              organisationName={branding?.organisationName}
            />
            <p className="mt-4 max-w-sm text-sm leading-relaxed">
              Delivering quality healthcare to your home, our clinic and your screen — with
              compassion, professionalism and excellence, across Port Harcourt and Rivers State.
            </p>
          </div>

          <FooterColumn title="Quick Links" links={QUICK_LINKS} />

          <FooterColumn title="Support" links={SUPPORT_LINKS} />

          <FooterColumn
            title="Services"
            links={
              services.length > 0
                ? services.slice(0, 6).map((service) => ({
                    label: service.name,
                    href: `/services/${service.slug}`,
                  }))
                : [{ label: 'View all services', href: '/services' }]
            }
          />

          <div>
            <h3 className="text-sm font-semibold text-white">Contact Us</h3>
            <ul className="mt-4 space-y-3 text-sm">
              {contact.phone ? (
                <li className="flex gap-2.5">
                  <Phone className="mt-0.5 size-4 shrink-0 text-crimson-400" aria-hidden />
                  <a href={contact.phoneHref} className="hover:text-white">
                    {contact.phone}
                  </a>
                </li>
              ) : null}
              {contact.email ? (
                <li className="flex gap-2.5">
                  <Mail className="mt-0.5 size-4 shrink-0 text-crimson-400" aria-hidden />
                  <a href={contact.emailHref} className="hover:text-white">
                    {contact.email}
                  </a>
                </li>
              ) : null}
              {contact.address ? (
                <li className="flex gap-2.5">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-crimson-400" aria-hidden />
                  <span>{contact.address}</span>
                </li>
              ) : null}
              <li className="flex gap-2.5">
                <Clock className="mt-0.5 size-4 shrink-0 text-crimson-400" aria-hidden />
                <span>Mon – Sun, 24/7</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-white/10 pt-6 text-xs sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {contact.organisationName}. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            <Link href="/privacy" className="hover:text-white">
              Privacy Policy
            </Link>
            <Link href="/terms" className="hover:text-white">
              Terms of Service
            </Link>
            <Link href="/faq" className="hover:text-white">
              Refund Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((link) => (
          <li key={`${link.href}-${link.label}`}>
            <Link href={link.href} className="transition-colors hover:text-white">
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
