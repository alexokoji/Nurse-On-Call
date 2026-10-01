import type { Metadata } from 'next';
import Link from 'next/link';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your NurseOnCall account to manage appointments, payments and receipts.',
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; registered?: string }>;
}) {
  const params = await searchParams;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">Welcome back</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Sign in to manage your appointments, payments and health records.
      </p>

      <LoginForm next={params.next} />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New to NurseOnCall?{' '}
        <Link href="/register" className="font-semibold text-primary hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
