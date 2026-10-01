import type { Metadata } from 'next';
import Link from 'next/link';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Create an account',
  description: 'Create a NurseOnCall account to book services and manage your care in one place.',
  robots: { index: false, follow: false },
};

export default function RegisterPage() {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">
        Create your account
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        It takes a minute, and you only have to enter your details once.
      </p>

      <RegisterForm />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
