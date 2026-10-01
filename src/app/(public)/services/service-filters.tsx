'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { SERVICE_TYPES, LABELS } from '@/types';
import { useSyncedState } from '@/hooks/use-synced-state';

/**
 * Filters write to the URL, and the page re-renders on the server from those
 * params. That keeps the result set shareable and back-button friendly, and
 * means filtering works with JavaScript disabled once the form is submitted.
 */

const PRICE_BANDS = [
  { label: 'Under ₦10,000', value: '0-10000' },
  { label: '₦10,000 – ₦25,000', value: '10000-25000' },
  { label: '₦25,000 – ₦50,000', value: '25000-50000' },
  { label: 'Over ₦50,000', value: '50000-' },
];

export function ServiceFilters({
  categories,
  resultCount,
}: {
  categories: { slug: string; name: string }[];
  resultCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [panelOpen, setPanelOpen] = useState(false);
  // Mirrors ?q= — re-syncs when the URL changes from elsewhere ("Clear all").
  const [search, setSearch] = useSyncedState(searchParams.get('q') ?? '');

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === null || value === '') params.delete(key);
    else params.set(key, value);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  const activeFilters = ['category', 'type', 'price'].filter((key) => searchParams.get(key));
  const hasFilters = activeFilters.length > 0 || Boolean(searchParams.get('q'));

  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <form
          className="relative flex-1"
          onSubmit={(event) => {
            event.preventDefault();
            setParam('q', search.trim() || null);
          }}
        >
          <Search
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search services…"
            className="pl-9"
            aria-label="Search services"
          />
        </form>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setPanelOpen((open) => !open)}
            aria-expanded={panelOpen}
            className="flex-1 sm:flex-none"
          >
            <SlidersHorizontal className="size-4" />
            Filters
            {activeFilters.length > 0 && (
              <span className="ml-1 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {activeFilters.length}
              </span>
            )}
          </Button>

          {hasFilters && (
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
      </div>

      {panelOpen && (
        <div className="mt-4 grid gap-4 border-t border-border pt-4 sm:grid-cols-3">
          <FilterGroup label="Category">
            <select
              value={searchParams.get('category') ?? ''}
              onChange={(event) => setParam('category', event.target.value || null)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Delivered">
            <select
              value={searchParams.get('type') ?? ''}
              onChange={(event) => setParam('type', event.target.value || null)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Anywhere</option>
              {SERVICE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {LABELS.serviceType[type]}
                </option>
              ))}
            </select>
          </FilterGroup>

          <FilterGroup label="Price">
            <select
              value={searchParams.get('price') ?? ''}
              onChange={(event) => setParam('price', event.target.value || null)}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Any price</option>
              {PRICE_BANDS.map((band) => (
                <option key={band.value} value={band.value}>
                  {band.label}
                </option>
              ))}
            </select>
          </FilterGroup>
        </div>
      )}

      <p
        className={cn(
          'mt-3 text-sm text-muted-foreground transition-opacity',
          isPending && 'opacity-50',
        )}
        aria-live="polite"
      >
        {resultCount} {resultCount === 1 ? 'service' : 'services'} available
      </p>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
