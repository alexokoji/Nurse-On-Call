'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DEFAULT_SETTINGS } from '@/lib/settings/defaults';

/**
 * Root error boundary.
 *
 * The user is shown a plain apology and a way forward — never the error
 * message, which can leak internals. The digest is displayed because it is
 * the reference support needs to find the matching server log.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app] unhandled error', error);
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lift">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-red-50 text-red-600">
          <AlertTriangle className="size-7" aria-hidden />
        </span>

        <h1 className="mt-5 font-display text-xl font-bold tracking-tight text-navy-800">
          Something went wrong
        </h1>

        {/* The code-level default, not the configured number.

            This boundary renders when something has already failed — often the
            database itself — so it must not depend on a settings read. Every
            other page shows the number from Settings → General. */}
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          We hit an unexpected problem. Nothing you were doing has been lost — try again, and if it
          keeps happening, call us on {DEFAULT_SETTINGS.general.phone} and we will sort it out
          directly.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Reference: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button onClick={reset}>Try again</Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
