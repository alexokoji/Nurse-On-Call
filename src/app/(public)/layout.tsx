import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { getCurrentUser } from '@/lib/auth/current-user';
import { connectDB } from '@/lib/db/connect';
import { Service } from '@/models';
import { getSettings } from '@/lib/settings';
import { getContactDetails } from '@/lib/settings/contact';

/**
 * Shell for every public marketing page.
 *
 * The header needs the session (to swap "Log in" for "Dashboard") and the
 * footer lists live services, so both are resolved here once rather than in
 * each page.
 */
export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const services = await footerServices();
  const general = await getSettings('general');
  const contact = await getContactDetails();

  // An uploaded logo replaces the built-in wordmark everywhere at once.
  const branding = { logo: general.logo, organisationName: general.organisationName };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        session={user ? { name: user.name, role: user.role } : null}
        branding={branding}
        contact={{
          phone: contact.phone,
          phoneHref: contact.phoneHref,
          email: contact.email,
          emailHref: contact.emailHref,
          locality: locality(contact.address),
        }}
      />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter services={services} branding={branding} />
    </div>
  );
}

/** Never let a database hiccup take down the marketing site. */
async function footerServices() {
  try {
    await connectDB();
    return await Service.find({ status: 'published' })
      .select('name slug')
      .sort({ bookingCount: -1 })
      .limit(6)
      .lean<{ name: string; slug: string }[]>();
  } catch {
    return [];
  }
}

/**
 * The last two parts of the configured address — "Port Harcourt, Rivers State"
 * out of a full street address — because the header strip has room for a
 * locality but not for a building number.
 *
 * Returns the whole thing when it is already short, and nothing when no
 * address is set, so the strip simply omits it rather than showing a stray
 * separator.
 */
function locality(address: string): string | undefined {
  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) return undefined;
  return parts.slice(-2).join(', ');
}
