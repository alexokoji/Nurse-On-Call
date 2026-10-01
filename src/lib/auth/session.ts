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

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET is missing or too short. Set a 32-byte random value in .env.local');
  }
  return new TextEncoder().encode(secret);
}

export function sessionMaxAge(): number {
  const parsed = Number(process.env.AUTH_SESSION_MAX_AGE);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 24 * 7;
}

export async function signSession(
  payload: Omit<SessionPayload, 'iat' | 'exp'>,
): Promise<string> {
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
