import type { Metadata } from 'next';
import Link from 'next/link';
import { ResetPasswordForm } from './reset-password-form';
import { Alert } from '@/components/ui/feedback';

export const metadata: Metadata = {
  title: 'Choose a new password',
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token) {
    return (
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">
          Reset link missing
        </h1>
        <Alert variant="error" className="mt-6">
          This page needs a valid reset link. Request a new one and use the link from your email.
        </Alert>
        <Link
          href="/forgot-password"
          className="mt-6 inline-block text-sm font-semibold text-primary hover:underline"
        >
          Request a new reset link
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">
        Choose a new password
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pick something you haven&apos;t used before. This link expires an hour after it was sent.
      </p>

      <ResetPasswordForm token={token} />
    </div>
  );
}
