import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import type { UserRole } from '@/types';

/**
 * Sessions are stateless signed JWTs stored in an httpOnly cookie.
 *
 * `jose` is used rather than a Node-only library because middleware runs on
 * the Edge runtime, where `crypto` from Node is unavailable.
 *
 * The token carries only identity — never permissions. Permissions are
 * resolved from the database on every privileged request, so revoking a role
 * takes effect immediately instead of at token expiry.
 */

export const SESSION_COOKIE = 'noc_session';

export interface SessionPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  /** Bumped on the user record to invalidate all outstanding sessions. */
  v: number;
}

/** The shortest secret worth signing with. */
const MIN_SECRET_LENGTH = 16;

/**
 * Whether sessions can be issued at all.
 *
 * Separate from `getSecret()` so callers can check *before* doing work that
 * would otherwise be half-finished. Registration used to write the user, their
 * profile and their consent record and only then discover it could not sign
 * them in: the account existed, the request 500'd, and every retry reported
 * "an account already exists" — unrecoverable from the UI.
 */
export function isSessionConfigured(): boolean {
  const secret = process.env.AUTH_SECRET;
  return Boolean(secret) && String(secret).length >= MIN_SECRET_LENGTH;
}

/**
 * The deployment is misconfigured, not the request. Mentioning .env.local here
 * was actively misleading on a hosted deployment, where that file does not
 * exist — it is gitignored and never deployed, so every variable has to be set
 * in the host's own environment settings.
 */
export const SESSION_CONFIG_ERROR =
  'AUTH_SECRET is missing or shorter than 16 characters. Set it in your hosting ' +
  "provider's environment variables (or .env.local when running locally) to a " +
  'long random value, e.g. `openssl rand -base64 32`.';

function getSecret(): Uint8Array {
  if (!isSessionConfigured()) throw new Error(SESSION_CONFIG_ERROR);
  return new TextEncoder().encode(process.env.AUTH_SECRET);
}

export function sessionMaxAge(): number {
  const parsed = Number(process.env.AUTH_SESSION_MAX_AGE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 7;
}

export async function signSession(payload: Omit<SessionPayload, 'iat' | 'exp'>): Promise<string> {
  const maxAge = sessionMaxAge();
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('nurseoncall')
    .setAudience('nurseoncall-app')
    .setExpirationTime(`${maxAge}s`)
    .sign(getSecret());
}

/** Returns null for any invalid, expired or tampered token — never throws. */
export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'nurseoncall',
      audience: 'nurseoncall-app',
    });
    if (!payload.sub || !payload.role) return null;
    return payload as SessionPayload;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: sessionMaxAge(),
  };
}
