import Link from 'next/link';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/public/logo';

/**
 * Split layout for the auth pages: form on the left, reassurance on the
 * right. The panel is hidden below `lg` so mobile users get the form
 * immediately rather than scrolling past marketing copy.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <div className="flex w-full flex-col px-4 py-8 sm:px-8 lg:w-1/2 lg:px-16">
        <header className="flex items-center justify-between">
          <Logo />
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-navy-800"
          >
            ← Back to site
          </Link>
        </header>

        <main id="main" className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">{children}</div>
        </main>

        <footer className="text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} NurseOnCall · Port Harcourt, Rivers State
        </footer>
      </div>

      <aside
        className="relative hidden w-1/2 overflow-hidden bg-gradient-to-br from-navy-800 to-brand-800 lg:flex lg:flex-col lg:justify-center lg:px-16"
        aria-hidden
      >
        <div className="absolute -right-24 -top-24 size-96 rounded-full bg-crimson-500/20 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 size-96 rounded-full bg-brand-400/20 blur-3xl" />

        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-crimson-300">
            <ShieldCheck className="size-3.5" />
            Your data stays private
          </span>

          <h2 className="mt-6 max-w-md font-display text-3xl font-bold leading-tight text-white">
            Healthcare that comes to you — at home, in clinic, or online.
          </h2>

          <ul className="mt-8 space-y-4">
            {[
              'Book in under two minutes with live availability',
              'Care from our own nurses, doctors and therapists',
              'Transparent pricing — no surprises at the end',
              'Every appointment, receipt and result in one place',
            ].map((point) => (
              <li key={point} className="flex items-start gap-3 text-sm text-white/85">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
                {point}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
