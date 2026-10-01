'use client';

import { useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSyncedState } from '@/hooks/use-synced-state';

/**
 * URL-driven filter toolbar shared by every admin list.
 *
 * Filters live in the query string and the page re-renders on the server, so
 * a filtered view is shareable, survives a refresh, and never ships the whole
 * dataset to the browser to filter client-side.
 */

export interface SelectFilter {
  name: string;
  label: string;
  options: { value: string; label: string }[];
}

export function FilterBar({
  searchPlaceholder = 'Search…',
  filters = [],
  showDateRange = false,
  children,
}: {
  searchPlaceholder?: string;
  filters?: SelectFilter[];
  showDateRange?: boolean;
  /** Right-aligned actions (Export, New…). */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  // Mirrors ?q= — re-syncs when the URL changes from elsewhere ("Clear").
  const [query, setQuery] = useSyncedState(searchParams.get('q') ?? '');

  const update = (changes: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value === null || value === '' || value === 'all') params.delete(key);
      else params.set(key, value);
    }
    // Any filter change invalidates the current page number.
    params.delete('page');

    const qs = params.toString();
    startTransition(() => router.replace(`${pathname}${qs ? `?${qs}` : ''}`, { scroll: false }));
  };

  const activeCount = [...filters.map((f) => f.name), 'from', 'to', 'q'].filter((key) =>
    searchParams.get(key),
  ).length;

  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-card p-4 shadow-card transition-opacity',
        isPending && 'opacity-70',
      )}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <form
          className="relative min-w-0 flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            update({ q: query.trim() || null });
          }}
        >
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
          />
        </form>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((filter) => (
            <select
              key={filter.name}
              value={searchParams.get(filter.name) ?? 'all'}
              onChange={(event) => update({ [filter.name]: event.target.value })}
              aria-label={filter.label}
              className="h-10 min-w-[9rem] rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="all">{filter.label}</option>
              {filter.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          ))}

          {showDateRange && (
            <div className="flex items-center gap-1.5">
              <Input
                type="date"
                value={searchParams.get('from') ?? ''}
                onChange={(event) => update({ from: event.target.value || null })}
                aria-label="From date"
                className="h-10 w-[9.5rem]"
              />
              <span className="text-xs text-muted-foreground" aria-hidden>
                to
              </span>
              <Input
                type="date"
                value={searchParams.get('to') ?? ''}
                onChange={(event) => update({ to: event.target.value || null })}
                aria-label="To date"
                className="h-10 w-[9.5rem]"
              />
            </div>
          )}

          {activeCount > 0 && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => startTransition(() => router.replace(pathname, { scroll: false }))}
            >
              <X className="size-4" />
              Clear
            </Button>
          )}
        </div>

        {children && <div className="flex flex-wrap items-center gap-2 lg:ml-auto">{children}</div>}
      </div>
    </div>
  );
}
