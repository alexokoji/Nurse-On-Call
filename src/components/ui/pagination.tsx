'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Server-side pagination control.
 *
 * Renders real links that carry the current filters, so a paginated view is
 * shareable, bookmarkable and works without JavaScript.
 */

export interface PaginationProps {
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  /** Noun shown in the summary, e.g. "appointments". */
  label?: string;
}

export function Pagination({ page, totalPages, total, pageSize, label = 'results' }: PaginationProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (total === 0) return null;

  const hrefFor = (target: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (target <= 1) params.delete('page');
    else params.set('page', String(target));
    const qs = params.toString();
    return `${pathname}${qs ? `?${qs}` : ''}`;
  };

  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"
    >
      <p className="text-sm text-muted-foreground">
        Showing <span className="font-medium text-navy-800">{from}</span> to{' '}
        <span className="font-medium text-navy-800">{to}</span> of{' '}
        <span className="font-medium text-navy-800">{total}</span> {label}
      </p>

      <div className="flex items-center gap-1">
        <PageLink
          href={hrefFor(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="px-2"
        >
          <ChevronLeft className="size-4" />
        </PageLink>

        {pageRange(page, totalPages).map((entry, index) =>
          entry === 'ellipsis' ? (
            <span key={`gap-${index}`} className="px-2 text-sm text-muted-foreground" aria-hidden>
              …
            </span>
          ) : (
            <PageLink
              key={entry}
              href={hrefFor(entry)}
              active={entry === page}
              aria-label={`Page ${entry}`}
              aria-current={entry === page ? 'page' : undefined}
            >
              {entry}
            </PageLink>
          ),
        )}

        <PageLink
          href={hrefFor(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="px-2"
        >
          <ChevronRight className="size-4" />
        </PageLink>
      </div>
    </nav>
  );
}

function PageLink({
  href,
  active,
  disabled,
  className,
  children,
  ...props
}: {
  href: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.AnchorHTMLAttributes<HTMLAnchorElement>) {
  const classes = cn(
    'inline-flex h-9 min-w-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors',
    active
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-secondary hover:text-navy-800',
    disabled && 'pointer-events-none opacity-40',
    className,
  );

  if (disabled) {
    return (
      <span className={classes} aria-disabled {...props}>
        {children}
      </span>
    );
  }

  return (
    <Link href={href} className={classes} {...props}>
      {children}
    </Link>
  );
}

/** Compact page list: 1 … 4 [5] 6 … 31 */
function pageRange(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | 'ellipsis')[] = [1];

  if (current > 3) pages.push('ellipsis');

  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) {
    pages.push(p);
  }

  if (current < total - 2) pages.push('ellipsis');
  pages.push(total);

  return pages;
}
