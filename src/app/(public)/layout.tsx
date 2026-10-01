import { SiteHeader } from '@/components/public/site-header';
import { SiteFooter } from '@/components/public/site-footer';
import { getCurrentUser } from '@/lib/auth/current-user';
import { connectDB } from '@/lib/db/connect';
import { Service } from '@/models';
import { getSettings } from '@/lib/settings';

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

  // An uploaded logo replaces the built-in wordmark everywhere at once.
  const branding = { logo: general.logo, organisationName: general.organisationName };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        session={user ? { name: user.name, role: user.role } : null}
        branding={branding}
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
