import {
  Stethoscope,
  HeartPulse,
  HousePlus,
  Pill,
  TestTube,
  Activity,
  Baby,
  Syringe,
  Brain,
  Bandage,
  UserRound,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Maps the `icon` string stored on a Service/Category to a real component.
 * Content editors pick from this vocabulary; anything unknown degrades to a
 * stethoscope rather than rendering nothing.
 */
const ICONS: Record<string, LucideIcon> = {
  stethoscope: Stethoscope,
  'heart-pulse': HeartPulse,
  home: HousePlus,
  'home-care': HousePlus,
  pill: Pill,
  medication: Pill,
  'test-tube': TestTube,
  lab: TestTube,
  activity: Activity,
  physiotherapy: Activity,
  baby: Baby,
  syringe: Syringe,
  vaccination: Syringe,
  brain: Brain,
  bandage: Bandage,
  'wound-care': Bandage,
  elderly: UserRound,
  shield: ShieldCheck,
};

/**
 * Accent tones a category can be given. `crimson` and `blue` are the two
 * brand colours; the rest are supporting tones so a long catalogue does not
 * become a wall of the same two swatches.
 *
 * `teal` is kept as an alias pointing at the brand red so categories seeded
 * before the rebrand still render correctly instead of falling back.
 */
const ACCENTS: Record<string, string> = {
  crimson: 'bg-crimson-50 text-crimson-600',
  blue: 'bg-brand-50 text-brand-600',
  navy: 'bg-navy-100 text-navy-700',
  purple: 'bg-violet-50 text-violet-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  teal: 'bg-crimson-50 text-crimson-600',
};

export function ServiceIcon({
  icon,
  accent = 'crimson',
  size = 'md',
  className,
}: {
  icon?: string;
  accent?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const Icon = ICONS[icon ?? ''] ?? Stethoscope;
  const tone = ACCENTS[accent] ?? ACCENTS.crimson;

  const box = { sm: 'size-9 rounded-lg', md: 'size-12 rounded-xl', lg: 'size-14 rounded-2xl' }[size];
  const glyph = { sm: 'size-4', md: 'size-5', lg: 'size-6' }[size];

  return (
    <span className={cn('inline-flex items-center justify-center', box, tone, className)} aria-hidden>
      <Icon className={glyph} strokeWidth={1.9} />
    </span>
  );
}

export const SERVICE_ICON_OPTIONS = Object.keys(ICONS);
/* `teal` is a legacy alias, so it is hidden from the picker. */
export const ACCENT_OPTIONS = Object.keys(ACCENTS).filter((key) => key !== 'teal');
