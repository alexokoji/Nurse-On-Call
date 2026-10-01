/**
 * Startup configuration check.
 *
 * Next calls `register()` once per server instance, before the first request.
 * The point is to make a misconfigured deployment announce itself in the boot
 * log, rather than letting the first visitor discover it as a 500 on sign-up.
 *
 * It only warns. Refusing to boot would also take down the public pages, which
 * work perfectly well without email, storage or a scheduler — and on a hosted
 * platform a crash loop is considerably harder to diagnose than a log line.
 */

export async function register() {
  /* Secrets must never reach the browser, so this file must stay server-side.
     The Edge runtime also runs this hook; it has no business checking server
     configuration, and `process.env` there carries only what was inlined. */
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const missing: string[] = [];
  const warnings: string[] = [];

  if (!process.env.MONGODB_URI) {
    missing.push('MONGODB_URI — no database; every page that reads data will fail');
  } else if (!/mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(process.env.MONGODB_URI)) {
    /* A URI with no path component silently lands in the driver's default
       database ("test" on Atlas), which looks exactly like an empty site. */
    warnings.push(
      'MONGODB_URI has no database name (…mongodb.net/?… instead of …mongodb.net/nurseoncall?…), ' +
        'so the driver will use its default database',
    );
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    missing.push('AUTH_SECRET — nobody can sign in or register');
  } else if (secret.length < 16) {
    missing.push('AUTH_SECRET is shorter than 16 characters — nobody can sign in or register');
  }

  if (process.env.NODE_ENV === 'production') {
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      warnings.push(
        'NEXT_PUBLIC_APP_URL is not set — payment callbacks and email links will be wrong',
      );
    }
    if (!process.env.CRON_SECRET) {
      warnings.push(
        'CRON_SECRET is not set — /api/cron refuses to run, so reminders are never sent',
      );
    }
    if (!process.env.EMAIL_PROVIDER || process.env.EMAIL_PROVIDER === 'console') {
      warnings.push(
        'EMAIL_PROVIDER is console — no email is delivered, so password reset cannot work',
      );
    }
  }

  if (missing.length > 0) {
    console.error('\n[config] This deployment is missing required environment variables:');
    for (const item of missing) console.error(`  ✗ ${item}`);
    console.error(
      "\n  Set them in your hosting provider's environment settings. .env.local is " +
        'gitignored and never deployed, so it has no effect on a hosted deployment.\n',
    );
  }

  for (const warning of warnings) {
    console.warn(`[config] ${warning}`);
  }
}
