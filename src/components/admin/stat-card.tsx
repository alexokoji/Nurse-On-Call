import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import { Sparkline } from './charts';
import { cn, formatNaira, formatNumber, formatPercent } from '@/lib/utils';

/**
 * KPI card. The change indicator is deliberately neutral when the movement is
 * under half a percent — a dashboard that shouts "+0.2%" in green trains
 * people to ignore it.
 */
export function StatCard({
  label,
  value,
  change,
  comparison,
  trend,
  format = 'number',
  icon: Icon,
  accent = 'bg-brand-50 text-brand-600',
}: {
  label: string;
  value: number;
  change: number;
  comparison: string;
  trend: { x: string; y: number }[];
  format?: 'number' | 'currency';
  icon?: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  const flat = Math.abs(change) < 0.5;
  const up = change > 0;

  const TrendIcon = flat ? Minus : up ? TrendingUp : TrendingDown;
  const trendTone = flat ? 'text-muted-foreground' : up ? 'text-emerald-600' : 'text-red-600';

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start justify-between gap-3">
        {Icon && (
          <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', accent)}>
            <Icon className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight text-navy-800">
            {format === 'currency'
              ? formatNaira(value, { compact: value >= 10_000_000_00 })
              : formatNumber(value)}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className={cn('flex items-center gap-0.5 font-semibold', trendTone)}>
            <TrendIcon className="size-3.5" aria-hidden />
            {flat ? 'No change' : formatPercent(change)}
          </span>
          <span className="text-muted-foreground">{comparison}</span>
        </p>

        {trend.length > 0 && <Sparkline data={trend} />}
      </div>
    </div>
  );
}

/** Compact summary tile used above admin tables. */
export function SummaryTile({
  label,
  value,
  icon: Icon,
  accent = 'bg-brand-50 text-brand-600',
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-card">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', accent)}>
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="font-display text-xl font-bold text-navy-800">
          {typeof value === 'number' ? formatNumber(value) : value}
        </p>
      </div>
    </div>
  );
}
