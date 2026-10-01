'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNaira, formatNumber } from '@/lib/utils';

/**
 * Chart wrappers.
 *
 * All of them use ResponsiveContainer inside a fixed-height parent, which is
 * what makes them resize correctly on a phone. Colours come from one palette
 * so a status means the same thing in every chart.
 */

const SERIES = {
  completed: '#059669',
  pending: '#d97706',
  cancelled: '#dc2626',
  primary: '#2563eb',
  accent: '#14a085',
};

const PIE_COLOURS = ['#14a085', '#2563eb', '#7c3aed', '#d97706', '#0891b2', '#94a3b8'];

const AXIS = {
  stroke: '#94a3b8',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
};

function TooltipBox({
  active,
  payload,
  label,
  currency,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number; color?: string; dataKey?: string }[];
  label?: string;
  currency?: boolean;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 shadow-lift">
      {label && <p className="text-xs font-semibold text-navy-800">{label}</p>}
      <ul className="mt-1 space-y-0.5">
        {payload.map((entry, index) => (
          <li key={index} className="flex items-center gap-2 text-xs">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="capitalize text-muted-foreground">{entry.name ?? entry.dataKey}</span>
            <span className="ml-auto font-medium text-navy-800">
              {currency ? formatNaira(entry.value ?? 0) : formatNumber(entry.value ?? 0)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Sparkline for the KPI cards ──────────────────────────────────── */

export function Sparkline({ data, colour = SERIES.primary }: { data: { x: string; y: number }[]; colour?: string }) {
  if (data.length === 0) return <div className="h-10" aria-hidden />;

  return (
    <div className="h-10 w-24" aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="y"
            stroke={colour}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ── Appointments overview ────────────────────────────────────────── */

export function AppointmentChart({
  data,
  range,
}: {
  data: { label: string; completed: number; pending: number; cancelled: number }[];
  range: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setRange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('range', next);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          {(['completed', 'pending', 'cancelled'] as const).map((key) => (
            <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: SERIES[key] }}
                aria-hidden
              />
              <span className="capitalize">{key}</span>
            </span>
          ))}
        </div>

        <select
          value={range}
          onChange={(event) => setRange(event.target.value)}
          aria-label="Chart range"
          className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
          <option value="year">This Year</option>
        </select>
      </div>

      <div className="mt-5 h-64 w-full sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -18 }}>
            <defs>
              {(['completed', 'pending', 'cancelled'] as const).map((key) => (
                <linearGradient key={key} id={`fill-${key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[key]} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={SERIES[key]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>

            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
            <YAxis {...AXIS} allowDecimals={false} width={40} />
            <Tooltip content={<TooltipBox />} cursor={{ stroke: '#cbd5e1' }} />

            {(['completed', 'pending', 'cancelled'] as const).map((key) => (
              <Area
                key={key}
                type="monotone"
                dataKey={key}
                stroke={SERIES[key]}
                strokeWidth={2}
                fill={`url(#fill-${key})`}
                dot={{ r: 2.5, strokeWidth: 0, fill: SERIES[key] }}
                activeDot={{ r: 4 }}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/* ── Revenue by service (donut) ───────────────────────────────────── */

export function RevenueDonut({ data }: { data: { name: string; value: number }[] }) {
  const total = data.reduce((sum, entry) => sum + entry.value, 0);

  if (total === 0) {
    return (
      <p className="py-10 text-center text-sm text-muted-foreground">
        No revenue recorded yet.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <div className="h-44 w-full shrink-0 sm:w-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
            >
              {data.map((_, index) => (
                <Cell key={index} fill={PIE_COLOURS[index % PIE_COLOURS.length]} />
              ))}
            </Pie>
            <Tooltip content={<TooltipBox currency />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="min-w-0 flex-1 space-y-2">
        {data.map((entry, index) => (
          <li key={entry.name} className="flex items-center gap-2 text-sm">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: PIE_COLOURS[index % PIE_COLOURS.length] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-muted-foreground">{entry.name}</span>
            <span className="shrink-0 font-medium text-navy-800">
              {formatNaira(entry.value, { compact: entry.value >= 1_000_000_00 })}
            </span>
            <span className="w-12 shrink-0 text-right text-xs text-muted-foreground">
              {((entry.value / total) * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Simple bar chart, used by reports ────────────────────────────── */

export function SimpleBarChart({
  data,
  currency = false,
  colour = SERIES.primary,
}: {
  data: { label: string; value: number }[];
  currency?: boolean;
  colour?: string;
}) {
  if (data.length === 0) {
    return <p className="py-10 text-center text-sm text-muted-foreground">No data for this period.</p>;
  }

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -12 }}>
          <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
          <YAxis
            {...AXIS}
            width={currency ? 60 : 40}
            tickFormatter={(value: number) =>
              currency ? formatNaira(value, { compact: true }) : String(value)
            }
          />
          <Tooltip content={<TooltipBox currency={currency} />} cursor={{ fill: '#f1f5f9' }} />
          <Bar dataKey="value" fill={colour} radius={[4, 4, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
