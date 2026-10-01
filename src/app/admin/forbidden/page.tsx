import type { Metadata } from 'next';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requireAdmin } from '@/lib/auth/guards';
import { LABELS } from '@/types';

export const metadata: Metadata = { title: 'Access denied' };

/**
 * Where `requireAdmin(permission)` sends someone whose role does not cover
 * the section they tried to open. It names the role rather than the missing
 * permission — that is what they can actually act on.
 */
export default async function ForbiddenPage() {
  const user = await requireAdmin();

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-card">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-amber-50 text-amber-600">
          <ShieldAlert className="size-7" aria-hidden />
        </span>

        <h2 className="mt-5 font-display text-xl font-bold tracking-tight text-navy-800">
          You don&apos;t have access to that section
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          Your role is <strong className="text-navy-800">{LABELS.userRole[user.role]}</strong>,
          which doesn&apos;t include this area. If you need it for your work, ask a super admin to
          adjust your role.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/admin">Back to dashboard</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/messages">Contact an administrator</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
