'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Phone, X, ChevronDown, LayoutDashboard } from 'lucide-react';
import { Logo } from './logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useResetOnChange } from '@/hooks/use-synced-state';

interface NavItem {
  label: string;
  href: string;
  children?: { label: string; href: string; description?: string }[];
}

const NAV: NavItem[] = [
  { label: 'Home', href: '/' },
  {
    label: 'Services',
    href: '/services',
    children: [
      { label: 'All services', href: '/services', description: 'Browse the full catalogue' },
      { label: 'Home nursing', href: '/services?category=home-care', description: 'Skilled care at home' },
      { label: 'Doctor consultation', href: '/services?category=consultation', description: 'In clinic or online' },
      { label: 'Lab tests', href: '/services?category=diagnostics', description: 'Sample collection at home' },
    ],
  },
  { label: 'About Us', href: '/about' },
  { label: 'Our Team', href: '/team' },
  {
    label: 'Resources',
    href: '/health-resources',
    children: [
      { label: 'Health articles', href: '/health-resources' },
      { label: 'FAQs', href: '/faq' },
    ],
  },
  { label: 'Contact', href: '/contact' },
];

export interface HeaderContact {
  phone: string;
  phoneHref: string;
  email: string;
  emailHref: string;
  /** Town and state, derived from the configured address. May be empty. */
  locality?: string;
}

export function SiteHeader({
  session,
  branding,
  contact,
}: {
  /** Present when a visitor is signed in, so the CTA becomes a dashboard link. */
  session?: { name: string; role: string } | null;
  /** Uploaded logo and name from Settings → General. */
  branding?: { logo?: string; organisationName?: string };
  /**
   * Contact details from Settings → General, resolved in the layout.
   *
   * Passed in rather than read here because this is a client component: it
   * needs `usePathname` for the active nav state, so it cannot touch the
   * database itself.
   */
  contact: HeaderContact;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);

  // Route changes must close the drawer, or it stays open over the new page.
  useResetOnChange(pathname, () => {
    setMobileOpen(false);
    setOpenMenu(null);
  });

  // Prevent the page behind the drawer from scrolling.
  React.useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const dashboardHref = session?.role === 'patient' ? '/patient/dashboard' : '/admin';

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Utility strip */}
      <div className="hidden bg-navy-800 text-white lg:block">
        <div className="container flex h-9 items-center justify-between text-xs">
          <div className="flex items-center gap-5">
            <a href={contact.phoneHref} className="flex items-center gap-1.5 hover:text-white">
              <Phone className="size-3" aria-hidden /> {contact.phone}
            </a>
            <span className="text-white/60">24/7 support</span>
          </div>
          <div className="flex items-center gap-5 text-white/70">
            <a href={contact.emailHref} className="hover:text-white">
              {contact.email}
            </a>
            {contact.locality ? <span>{contact.locality}</span> : null}
          </div>
        </div>
      </div>

      <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="container flex h-16 items-center justify-between gap-4">
          <Logo imageUrl={branding?.logo} organisationName={branding?.organisationName} />

          {/* Desktop navigation */}
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
            {NAV.map((item) =>
              item.children ? (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => setOpenMenu(item.label)}
                  onMouseLeave={() => setOpenMenu(null)}
                >
                  <button
                    type="button"
                    aria-expanded={openMenu === item.label}
                    aria-haspopup="true"
                    onClick={() => setOpenMenu(openMenu === item.label ? null : item.label)}
                    className={cn(
                      'flex items-center gap-1 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive(item.href)
                        ? 'text-primary'
                        : 'text-muted-foreground hover:text-navy-800',
                    )}
                  >
                    {item.label}
                    <ChevronDown className="size-3.5" aria-hidden />
                  </button>

                  {openMenu === item.label && (
                    <div className="absolute left-0 top-full w-64 pt-2">
                      <div className="rounded-xl border border-border bg-popover p-2 shadow-lift">
                        {item.children.map((child) => (
                          <Link
                            key={child.href}
                            href={child.href}
                            className="block rounded-lg px-3 py-2 transition-colors hover:bg-secondary"
                          >
                            <span className="block text-sm font-medium text-navy-800">
                              {child.label}
                            </span>
                            {child.description && (
                              <span className="mt-0.5 block text-xs text-muted-foreground">
                                {child.description}
                              </span>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive(item.href) ? 'page' : undefined}
                  className={cn(
                    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                    isActive(item.href)
                      ? 'text-primary'
                      : 'text-muted-foreground hover:text-navy-800',
                  )}
                >
                  {item.label}
                </Link>
              ),
            )}
          </nav>

          <div className="flex items-center gap-2">
            {session ? (
              <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                <Link href={dashboardHref}>
                  <LayoutDashboard className="size-4" />
                  Dashboard
                </Link>
              </Button>
            ) : (
              <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
                <Link href="/login">Log in</Link>
              </Button>
            )}

            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/book">Book a Service</Link>
            </Button>

            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-lg text-navy-800 hover:bg-secondary lg:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              onClick={() => setMobileOpen((open) => !open)}
            >
              {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div
          id="mobile-nav"
          className="fixed inset-x-0 bottom-0 top-16 z-40 overflow-y-auto border-t border-border bg-background lg:hidden"
        >
          <nav className="container flex flex-col gap-1 py-4" aria-label="Mobile">
            {NAV.map((item) => (
              <div key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    'block rounded-lg px-3 py-3 text-base font-medium',
                    isActive(item.href) ? 'bg-brand-50 text-primary' : 'text-navy-800',
                  )}
                >
                  {item.label}
                </Link>
                {item.children && (
                  <div className="ml-3 border-l border-border pl-3">
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className="block rounded-lg px-3 py-2 text-sm text-muted-foreground"
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}

            <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
              <Button asChild size="lg">
                <Link href="/book">Book a Service</Link>
              </Button>
              <Button asChild variant="outline" size="lg">
                <Link href={session ? dashboardHref : '/login'}>
                  {session ? 'Go to dashboard' : 'Log in'}
                </Link>
              </Button>
              <a
                href={contact.phoneHref}
                className="mt-2 flex items-center justify-center gap-2 py-2 text-sm text-muted-foreground"
              >
                <Phone className="size-4" aria-hidden /> {contact.phone}
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
