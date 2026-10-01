'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { subDays, subMonths, startOfMonth, startOfYear } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toDateKey } from '@/lib/utils';

/**
 * Date-range control for reports. Presets cover the ranges people actually
 * ask for; the two date inputs handle everything else.
 */
export function ReportRange() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const apply = (from: Date, to: Date) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', toDateKey(from));
    params.set('to', toDateKey(to));
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const setField = (key: 'from' | 'to', value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const today = new Date();

  const presets = [
    { label: '7 days', from: subDays(today, 6) },
    { label: '30 days', from: subDays(today, 29) },
    { label: '3 months', from: subMonths(today, 3) },
    { label: 'This month', from: startOfMonth(today) },
    { label: 'This year', from: startOfYear(today) },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-wrap gap-1">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="ghost"
            size="sm"
            onClick={() => apply(preset.from, today)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={searchParams.get('from') ?? ''}
          onChange={(event) => setField('from', event.target.value)}
          aria-label="Report start date"
          className="h-9 w-[9.5rem]"
        />
        <span className="text-xs text-muted-foreground" aria-hidden>
          to
        </span>
        <Input
          type="date"
          value={searchParams.get('to') ?? ''}
          onChange={(event) => setField('to', event.target.value)}
          aria-label="Report end date"
          className="h-9 w-[9.5rem]"
        />
      </div>
    </div>
  );
}
