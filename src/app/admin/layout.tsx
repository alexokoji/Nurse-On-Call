import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdmin } from '@/lib/auth/guards';
import { connectDB } from '@/lib/db/connect';
import { Refund, Review, SupportTicket } from '@/models';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s | NurseOnCall Admin' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const badges = await sidebarBadges();

  return (
    <AdminShell
      user={{ name: user.name, email: user.email, role: user.role, avatar: user.avatar }}
      permissions={user.permissions}
      badges={badges}
    >
      {children}
    </AdminShell>
  );
}

/** Counts of things actually waiting on someone — not decoration. */
async function sidebarBadges(): Promise<Record<string, number>> {
  try {
    await connectDB();
    const [refunds, reviews, tickets] = await Promise.all([
      Refund.countDocuments({ status: 'requested' }),
      Review.countDocuments({ status: 'pending' }),
      SupportTicket.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
    ]);
    return { refunds, reviews, notifications: tickets };
  } catch {
    return {};
  }
}
