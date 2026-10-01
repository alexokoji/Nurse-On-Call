import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-lift">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <Compass className="size-7" aria-hidden />
        </span>

        <p className="mt-5 font-display text-4xl font-bold text-navy-800">404</p>

        <h1 className="mt-2 font-display text-xl font-bold tracking-tight text-navy-800">
          We couldn&apos;t find that page
        </h1>

        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          The link may be out of date, or the page may have moved. Everything we offer is listed
          under Services.
        </p>

        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button asChild>
            <Link href="/services">Browse services</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
