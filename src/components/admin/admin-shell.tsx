'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bell, HelpCircle, Menu, Search, X } from 'lucide-react';
import { AdminSidebar, ADMIN_NAV } from './admin-sidebar';
import { Input } from '@/components/ui/input';
import { cn, initials } from '@/lib/utils';
import { LABELS, type UserRole } from '@/types';
import { useResetOnChange } from '@/hooks/use-synced-state';

/**
 * Admin chrome: fixed dark sidebar on desktop, drawer on smaller screens,
 * with a sticky header carrying search, notifications and the profile.
 */
export function AdminShell({
  user,
  permissions,
  badges,
  children,
}: {
  user: { name: string; email: string; role: UserRole; avatar?: string };
  permissions: string[];
  badges: Record<string, number>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A route change must close the drawer, or it covers the new page.
  useResetOnChange(pathname, () => setDrawerOpen(false));

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  /* Breadcrumb from the nav entry that matches the current path. */
  const current = ADMIN_NAV.filter((entry) =>
    entry.href === '/admin' ? pathname === '/admin' : pathname.startsWith(entry.href),
  ).at(-1);

  return (
    <div className="min-h-screen bg-secondary/40">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">
        <AdminSidebar user={user} permissions={permissions} badges={badges} />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-navy-950/50 lg:hidden"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside
            id="admin-nav"
            className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] lg:hidden"
          >
            <AdminSidebar
              user={user}
              permissions={permissions}
              badges={badges}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-border bg-background">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-lg text-navy-800 hover:bg-secondary lg:hidden"
              onClick={() => setDrawerOpen((open) => !open)}
              aria-expanded={drawerOpen}
              aria-controls="admin-nav"
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            >
              {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            <div className="min-w-0 flex-1">
              <h1 className="truncate font-display text-lg font-bold tracking-tight text-navy-800">
                {current?.label ?? 'Admin'}
              </h1>
              <nav aria-label="Breadcrumb" className="hidden text-xs text-muted-foreground sm:block">
                <ol className="flex items-center gap-1.5">
                  <li>
                    <Link href="/admin" className="hover:text-navy-800">
                      Home
                    </Link>
                  </li>
                  {current && current.href !== '/admin' && (
                    <>
                      <li aria-hidden>•</li>
                      <li className="text-navy-800">{current.label}</li>
                    </>
                  )}
                </ol>
              </nav>
            </div>

            <form action="/admin/appointments" className="relative hidden md:block">
              <Search
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                name="q"
                placeholder="Search appointments…"
                aria-label="Search appointments"
                className="w-56 pl-9 lg:w-72"
              />
            </form>

            <Link
              href="/admin/notifications"
              className="relative inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-navy-800"
              aria-label="Notifications"
            >
              <Bell className="size-5" />
              {badges.notifications > 0 && (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {badges.notifications > 9 ? '9+' : badges.notifications}
                </span>
              )}
            </Link>

            <div className="hidden items-center gap-2.5 border-l border-border pl-3 sm:flex">
              <span className="flex size-9 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
                {initials(user.name)}
              </span>
              <div className="hidden lg:block">
                <p className="text-sm font-medium leading-tight text-navy-800">{user.name}</p>
                <p className="text-xs text-muted-foreground">{LABELS.userRole[user.role]}</p>
              </div>
            </div>
          </div>
        </header>

        <main id="main" className={cn('p-4 sm:p-6 lg:p-8')}>
          {children}
        </main>
      </div>

      {/* Help affordance, matching the reference design. */}
      <Link
        href="/admin/messages"
        className="fixed bottom-5 right-5 z-20 hidden items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lift transition-transform hover:-translate-y-0.5 lg:inline-flex"
      >
        <HelpCircle className="size-4" aria-hidden />
        Help
      </Link>
    </div>
  );
}
