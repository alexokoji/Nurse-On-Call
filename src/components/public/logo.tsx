import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { cloudinaryVariant } from '@/lib/storage/image-url';

/**
 * NurseOnCall wordmark.
 *
 * Redrawn from the brand mark: a red heart enclosing a blue medical cross and
 * a house, with a stethoscope curling around it — home healthcare, in one
 * glyph. "NURSE" sits in navy and "ONCALL" in red, exactly as the logo does.
 *
 * It is inline SVG rather than an image file so it stays crisp at any size,
 * inherits the surrounding colour on the dark sidebar, and costs no extra
 * request. Swap in the supplied artwork by replacing `LogoMark` alone —
 * nothing else references the paths.
 */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 44"
      className={className}
      fill="none"
      role="img"
      aria-label="NurseOnCall"
    >
      {/* Heart outline — the brand red. */}
      <path
        d="M24 40.5S4.5 28.8 4.5 15.9C4.5 9.6 9.4 5 15.3 5c3.6 0 6.8 1.8 8.7 4.6C25.9 6.8 29.1 5 32.7 5c5.9 0 10.8 4.6 10.8 10.9C43.5 28.8 24 40.5 24 40.5Z"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinejoin="round"
        className="text-crimson-600"
        vectorEffect="non-scaling-stroke"
      />

      {/* Medical cross — the brand blue. */}
      <path
        d="M20.6 13.4h6.8v4.4h4.4v6.8h-4.4v4.4h-6.8v-4.4h-4.4v-6.8h4.4v-4.4Z"
        fill="currentColor"
        className="text-brand-700"
      />

      {/* House roof, tucked to the lower right as in the mark. */}
      <path
        d="M28.4 27.8 34 23l5.6 4.8v6.4h-4v-4h-3.2v4h-4v-6.4Z"
        fill="currentColor"
        className="text-crimson-600"
      />

      {/* Stethoscope tubing sweeping under the heart. */}
      <path
        d="M13.5 22.5v4.2a5.4 5.4 0 0 0 10.8 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        className="text-crimson-600"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="13.5" cy="21" r="2.1" fill="currentColor" className="text-crimson-600" />
    </svg>
  );
}

export function Logo({
  href = '/',
  variant = 'dark',
  subtitle,
  showTagline = true,
  /** Uploaded artwork from Settings → General. Replaces the drawn mark. */
  imageUrl,
  organisationName,
  className,
}: {
  href?: string;
  /** "dark" = dark text on a light background; "light" = the inverse. */
  variant?: 'dark' | 'light';
  /** Overrides the tagline, e.g. "Admin Panel" or "Patient Portal". */
  subtitle?: string;
  showTagline?: boolean;
  imageUrl?: string;
  organisationName?: string;
  className?: string;
}) {
  const light = variant === 'light';

  /* An uploaded logo stands alone: real artwork already contains its own
     wordmark, so repeating ours beside it would read as two logos. */
  if (imageUrl) {
    return (
      <Link
        href={href}
        className={cn(
          'inline-flex items-center rounded-lg focus-visible:ring-2 focus-visible:ring-ring',
          className,
        )}
      >
        <Image
          src={cloudinaryVariant(imageUrl, 'c_fit,h_96,q_auto,f_auto')}
          alt={organisationName ?? 'NurseOnCall'}
          width={180}
          height={48}
          priority
          className="h-10 w-auto object-contain"
        />
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-2.5 rounded-lg focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      <LogoMark
        className={cn('size-9 shrink-0', light && '[&>*]:!text-white')}
      />

      <span className="flex flex-col leading-none">
        <span className="font-display text-[17px] font-extrabold tracking-tight">
          {/* The two-tone wordmark is the most recognisable part of the brand. */}
          <span className={light ? 'text-white' : 'text-navy-800'}>NURSE</span>
          <span className={light ? 'text-crimson-300' : 'text-crimson-600'}>ONCALL</span>
        </span>

        {showTagline && (
          <span
            className={cn(
              'mt-1 text-[10px] font-medium tracking-wide',
              light ? 'text-white/60' : 'text-muted-foreground',
            )}
          >
            {subtitle ?? 'Your Health, Our Priority'}
          </span>
        )}
      </span>
    </Link>
  );
}
