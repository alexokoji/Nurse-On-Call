'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  CalendarDays,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Receipt,
  Star,
  User,
  X,
} from 'lucide-react';
import { Logo } from '@/components/public/logo';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/misc';
import { cn, initials } from '@/lib/utils';
import { logoutAction } from '@/app/(auth)/actions';
import { useResetOnChange } from '@/hooks/use-synced-state';

const NAV = [
  { label: 'Dashboard', href: '/patient/dashboard', icon: LayoutDashboard },
  { label: 'Appointments', href: '/patient/appointments', icon: CalendarDays },
  { label: 'Payments', href: '/patient/payments', icon: CreditCard },
  { label: 'Receipts', href: '/patient/receipts', icon: Receipt },
  { label: 'Reviews', href: '/patient/reviews', icon: Star },
  { label: 'Notifications', href: '/patient/notifications', icon: Bell },
  { label: 'Support', href: '/patient/support', icon: LifeBuoy },
  { label: 'Profile', href: '/patient/profile', icon: User },
];

export function PatientShell({
  user,
  unreadCount,
  children,
}: {
  user: { name: string; email: string; avatar?: string };
  unreadCount: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // A route change must close the drawer, or it covers the new page.
  useResetOnChange(pathname, () => setDrawerOpen(false));

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  const nav = (
    <nav className="flex flex-col gap-1" aria-label="Patient">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(item.href) ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
            isActive(item.href)
              ? 'bg-brand-50 text-primary'
              : 'text-muted-foreground hover:bg-secondary hover:text-navy-800',
          )}
        >
          <item.icon className="size-4 shrink-0" aria-hidden />
          <span className="flex-1">{item.label}</span>
          {item.href === '/patient/notifications' && unreadCount > 0 && (
            <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background">
        <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            className="inline-flex size-10 items-center justify-center rounded-lg text-navy-800 hover:bg-secondary lg:hidden"
            onClick={() => setDrawerOpen((open) => !open)}
            aria-expanded={drawerOpen}
            aria-controls="patient-nav"
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          >
            {drawerOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>

          <Logo href="/patient/dashboard" subtitle="Patient Portal" />

          <div className="ml-auto flex items-center gap-2">
            <Button asChild size="sm" className="hidden sm:inline-flex">
              <Link href="/book">Book a service</Link>
            </Button>

            <Link
              href="/patient/notifications"
              className="relative inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-navy-800"
              aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
            >
              <Bell className="size-5" />
              {unreadCount > 0 && (
                <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>

            <Avatar className="hidden sm:flex">
              {user.avatar && <AvatarImage src={user.avatar} alt="" />}
              <AvatarFallback>{initials(user.name)}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 border-r border-border bg-background p-4 lg:block">
          {nav}

          <div className="mt-6 border-t border-border pt-4">
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar>
                {user.avatar && <AvatarImage src={user.avatar} alt="" />}
                <AvatarFallback>{initials(user.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-navy-800">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>

            <form action={logoutAction}>
              <button
                type="submit"
                className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-navy-800"
              >
                <LogOut className="size-4" aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </aside>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div
            id="patient-nav"
            className="fixed inset-x-0 bottom-0 top-16 z-30 overflow-y-auto border-t border-border bg-background p-4 lg:hidden"
          >
            {nav}
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <Button asChild className="w-full">
                <Link href="/book">Book a service</Link>
              </Button>
              <form action={logoutAction}>
                <Button type="submit" variant="outline" className="w-full">
                  <LogOut className="size-4" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        )}

        <main id="main" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
