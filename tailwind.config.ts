import type { Config } from 'tailwindcss';
import animate from 'tailwindcss-animate';

const config: Config = {
  darkMode: ['class'],
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1rem', sm: '1.5rem', lg: '2rem' },
      screens: { '2xl': '1400px' },
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        /* ── NurseOnCall brand palette ──────────────────────────────
         * Taken from the logo: the deep navy of "NURSE" and the red of
         * "ONCALL", the heart and the stethoscope.
         *
         *   navy    — headings, the admin sidebar, body text
         *   brand   — the medical-cross blue; primary actions
         *   crimson — the heart red; accents, emphasis, the second CTA
         *
         * Status colours (emerald / amber / red) stay separate from these
         * on purpose: "confirmed" must never depend on a brand decision.
         */
        navy: {
          50: '#f2f5fa',
          100: '#e2e9f4',
          200: '#c6d5e9',
          300: '#9bb4d6',
          400: '#6a8dbe',
          500: '#476da5',
          600: '#365589',
          700: '#2c4570',
          800: '#1b3a6b',
          900: '#14294b',
          950: '#0c1a30',
        },
        brand: {
          50: '#eef5fd',
          100: '#d8e8fa',
          200: '#b6d4f4',
          300: '#86b8ec',
          400: '#5494e0',
          500: '#2f74cf',
          600: '#215bb0',
          700: '#1d498e',
          800: '#1b3f76',
          900: '#1a3662',
        },
        crimson: {
          50: '#fef3f2',
          100: '#fde4e3',
          200: '#fbcecc',
          300: '#f7aba8',
          400: '#f07b76',
          500: '#e35049',
          600: '#d22b2b',
          700: '#b01f21',
          800: '#921d20',
          900: '#7a1e21',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        xl: 'calc(var(--radius) + 4px)',
        '2xl': 'calc(var(--radius) + 8px)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'var(--font-sans)', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 1px 3px rgba(16,24,40,0.06)',
        soft: '0 4px 16px rgba(16,24,40,0.06)',
        lift: '0 12px 32px -8px rgba(16,24,40,0.14)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        shimmer: 'shimmer 1.6s infinite',
        'fade-up': 'fade-up 0.4s ease-out both',
      },
    },
  },
  plugins: [animate],
};

export default config;
