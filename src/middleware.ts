import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth/session';
import { ADMIN_ROLES } from '@/types';

/**
 * Edge middleware performs a *cheap* gate: is there a valid, unexpired token,
 * and is its role in the right family for this section?
 *
 * It is not the authorisation boundary. Fine-grained permission checks and
 * the account-status/session-version checks require the database and live in
 * `lib/auth/guards.ts`, which every page and route handler calls.
 */

const PATIENT_PREFIX = '/patient';
const ADMIN_PREFIX = '/admin';
/** Signed-in users have no reason to see these. */
const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);

  const isAdminArea = pathname.startsWith(ADMIN_PREFIX);
  const isPatientArea = pathname.startsWith(PATIENT_PREFIX);
  const isAuthPage = AUTH_PAGES.some((page) => pathname.startsWith(page));

  if (isAuthPage && session) {
    const home = ADMIN_ROLES.includes(session.role) ? '/admin' : '/patient/dashboard';
    return NextResponse.redirect(new URL(home, request.url));
  }

  if ((isAdminArea || isPatientArea) && !session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    const response = NextResponse.redirect(loginUrl);
    // Clear a stale cookie so the browser stops sending it.
    if (token) response.cookies.delete(SESSION_COOKIE);
    return response;
  }

  if (isAdminArea && session && !ADMIN_ROLES.includes(session.role)) {
    return NextResponse.redirect(new URL('/patient/dashboard', request.url));
  }

  if (isPatientArea && session && session.role !== 'patient') {
    return NextResponse.redirect(new URL('/admin', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except static assets, image optimisation, the favicon and
     * API routes — API routes guard themselves so they can return JSON 401s
     * rather than redirect.
     */
    '/((?!api|_next/static|_next/image|favicon.ico|images|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
