'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  RotateCcw,
  Settings,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
  UsersRound,
} from 'lucide-react';
import { Logo } from '@/components/public/logo';
import { cn, initials } from '@/lib/utils';
import { logoutAction } from '@/app/(auth)/actions';
import { LABELS } from '@/types';
import type { Permission } from '@/lib/permissions/catalogue';
import type { UserRole } from '@/types';

/**
 * Navigation is filtered by permission, so an operator never sees a section
 * they cannot open. The pages themselves re-check — this only removes dead
 * ends from the UI.
 */
export interface NavEntry {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  permission: Permission;
  badgeKey?: 'notifications' | 'reviews' | 'refunds';
}

export const ADMIN_NAV: NavEntry[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, permission: 'dashboard.view' },
  {
    label: 'Appointments',
    href: '/admin/appointments',
    icon: CalendarDays,
    permission: 'appointments.view',
  },
  { label: 'Patients', href: '/admin/patients', icon: Users, permission: 'patients.view' },
  { label: 'Services', href: '/admin/services', icon: Stethoscope, permission: 'services.view' },
  { label: 'Staff', href: '/admin/staff', icon: UsersRound, permission: 'staff.view' },
  { label: 'Schedule', href: '/admin/schedule', icon: CalendarRange, permission: 'staff.schedule' },
  { label: 'Payments', href: '/admin/payments', icon: CreditCard, permission: 'payments.view' },
  {
    label: 'Refunds',
    href: '/admin/refunds',
    icon: RotateCcw,
    permission: 'refunds.view',
    badgeKey: 'refunds',
  },
  {
    label: 'Reviews',
    href: '/admin/reviews',
    icon: Star,
    permission: 'reviews.view',
    badgeKey: 'reviews',
  },
  { label: 'Messages', href: '/admin/messages', icon: MessageSquare, permission: 'support.view' },
  {
    label: 'Notifications',
    href: '/admin/notifications',
    icon: Bell,
    permission: 'notifications.view',
  },
  { label: 'Content', href: '/admin/content', icon: FileText, permission: 'content.view' },
  { label: 'Reports', href: '/admin/reports', icon: BarChart3, permission: 'reports.view' },
  { label: 'Settings', href: '/admin/settings', icon: Settings, permission: 'settings.view' },
  { label: 'Users & Roles', href: '/admin/users', icon: ShieldCheck, permission: 'users.view' },
  { label: 'Audit Logs', href: '/admin/audit-logs', icon: ClipboardList, permission: 'audit.view' },
];

export function AdminSidebar({
  user,
  permissions,
  badges,
  onNavigate,
}: {
  user: { name: string; email: string; role: UserRole; avatar?: string };
  permissions: string[];
  badges: Record<string, number>;
  /** Lets the mobile drawer close itself when a link is followed. */
  onNavigate?: () => void;
}) {
  const pathname = usePathname();

  const visible = ADMIN_NAV.filter(
    (entry) => user.role === 'super_admin' || permissions.includes(entry.permission),
  );

  const isActive = (href: string) =>
    href === '/admin' ? pathname === '/admin' : pathname.startsWith(href);

  return (
    <div className="flex h-full flex-col bg-navy-900">
      <div className="flex h-16 shrink-0 items-center border-b border-white/10 px-5">
        <Logo href="/admin" variant="light" subtitle="Admin Panel" />
      </div>

      <nav
        className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4 scrollbar-thin"
        aria-label="Admin"
      >
        {visible.map((entry) => {
          const count = entry.badgeKey ? (badges[entry.badgeKey] ?? 0) : 0;

          return (
            <Link
              key={entry.href}
              href={entry.href}
              onClick={onNavigate}
              aria-current={isActive(entry.href) ? 'page' : undefined}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive(entry.href)
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'text-white/65 hover:bg-white/10 hover:text-white',
              )}
            >
              <entry.icon className="size-[18px] shrink-0" aria-hidden />
              <span className="flex-1 truncate">{entry.label}</span>
              {count > 0 && (
                <span className="rounded-full bg-destructive px-1.5 py-0.5 text-[11px] font-semibold text-white">
                  {count > 99 ? '99+' : count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-3">
        <div className="flex items-center gap-3 rounded-lg bg-white/5 px-3 py-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white">
            {initials(user.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">{user.name}</p>
            <p className="truncate text-xs text-white/55">{LABELS.userRole[user.role]}</p>
          </div>
        </div>

        <form action={logoutAction}>
          <button
            type="submit"
            className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-white/65 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="size-[18px]" aria-hidden />
            Sign out
          </button>
        </form>
      </div>
    </div>
  );
}
