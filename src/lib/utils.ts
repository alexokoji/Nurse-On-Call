import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format an amount stored in kobo (minor units) as Naira. */
export function formatNaira(kobo: number, opts: { compact?: boolean } = {}) {
  const naira = kobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: naira % 1 === 0 ? 0 : 2,
    notation: opts.compact ? 'compact' : 'standard',
  }).format(naira);
}

/** Naira (major units) -> kobo (minor units), the canonical storage unit. */
export function toKobo(naira: number) {
  return Math.round(naira * 100);
}

export function formatNumber(value: number) {
  return new Intl.NumberFormat('en-NG').format(value);
}

export function formatPercent(value: number, fractionDigits = 1) {
  return `${value >= 0 ? '+' : ''}${value.toFixed(fractionDigits)}%`;
}

/** Percentage change between two periods; guards divide-by-zero. */
export function percentChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return ((current - previous) / previous) * 100;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function truncate(input: string, max = 120) {
  return input.length <= max ? input : `${input.slice(0, max - 1).trimEnd()}…`;
}

/** Normalise Nigerian numbers to +234XXXXXXXXXX. */
export function normalisePhone(input: string) {
  const digits = input.replace(/\D/g, '');
  if (digits.startsWith('234')) return `+${digits}`;
  if (digits.startsWith('0')) return `+234${digits.slice(1)}`;
  if (digits.length === 10) return `+234${digits}`;
  return input.startsWith('+') ? input : `+${digits}`;
}

export function displayPhone(input: string) {
  const normalised = normalisePhone(input);
  if (!normalised.startsWith('+234')) return input;
  const local = `0${normalised.slice(4)}`;
  return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`.trim();
}

/** Build a querystring, dropping empty values. */
export function buildQuery(params: Record<string, string | number | undefined | null>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

export function calculateAge(dateOfBirth: Date | string) {
  const dob = new Date(dateOfBirth);
  const diff = Date.now() - dob.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
}

/** Convert "HH:mm" to minutes since midnight. */
export function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + (minutes || 0);
}

/** Convert minutes since midnight back to "HH:mm". */
export function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Present "14:30" as "02:30 PM". */
export function formatTimeLabel(time: string) {
  const [h, m] = time.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/** "2025-05-20" in a fixed timezone-stable form (no UTC drift). */
export function toDateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: string) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
