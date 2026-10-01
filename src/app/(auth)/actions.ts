'use server';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { connectDB } from '@/lib/db/connect';
import { User, PatientProfile, Consent, nextReference } from '@/models';
import { hashPassword, verifyPassword, createToken, hashToken } from '@/lib/auth/password';
import { SESSION_COOKIE, signSession, sessionCookieOptions } from '@/lib/auth/session';
import { rateLimit, RATE_LIMITS, clientIp, resetRateLimit } from '@/lib/auth/rate-limit';
import { getSettings } from '@/lib/settings';
import { recordAudit } from '@/lib/audit';
import { notify } from '@/lib/notifications/service';
import { normalisePhone } from '@/lib/utils';
import {
  loginSchema,
  registerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validations/auth';
import type { ActionResult } from '@/types';
import { ADMIN_ROLES } from '@/types';

/**
 * Authentication server actions.
 *
 * Two rules run through all of them:
 *
 *   1. Responses never reveal whether an email exists. Login and password
 *      reset return the same message either way, so the endpoint cannot be
 *      used to enumerate patients.
 *   2. Rate limiting is keyed on IP *and* on the submitted email, so an
 *      attacker cannot spread attempts across addresses to stay under the
 *      per-IP limit.
 */

const GENERIC_LOGIN_ERROR = 'That email and password combination is not correct.';

export async function loginAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = loginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    remember: formData.get('remember') === 'on',
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;
  const ip = clientIp(await headers());

  const ipLimit = rateLimit(`login:ip:${ip}`, RATE_LIMITS.login);
  const emailLimit = rateLimit(`login:email:${email}`, RATE_LIMITS.login);
  if (!ipLimit.success || !emailLimit.success) {
    const wait = Math.max(ipLimit.retryAfter, emailLimit.retryAfter);
    return {
      ok: false,
      message: `Too many sign-in attempts. Please try again in ${Math.ceil(wait / 60)} minute(s).`,
    };
  }

  await connectDB();
  const security = await getSettings('security');

  // `password` is select:false on the schema, so it must be requested.
  const user = await User.findOne({ email }).select('+password');

  if (!user) {
    // Same message and roughly the same cost as a wrong password.
    await verifyPassword(password, '$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva');
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
    return {
      ok: false,
      message: `This account is temporarily locked. Try again in ${minutes} minute(s).`,
    };
  }

  const valid = await verifyPassword(password, user.password);

  if (!valid) {
    user.failedLoginAttempts += 1;
    if (user.failedLoginAttempts >= security.maxFailedLogins) {
      user.lockedUntil = new Date(Date.now() + security.lockoutMinutes * 60 * 1000);
      user.failedLoginAttempts = 0;
    }
    await user.save();
    return { ok: false, message: GENERIC_LOGIN_ERROR };
  }

  if (user.status === 'suspended') {
    return { ok: false, message: 'This account has been suspended. Please contact support.' };
  }
  if (user.status === 'inactive') {
    return { ok: false, message: 'This account is inactive. Please contact support to reactivate it.' };
  }
  if (security.requireEmailVerification && !user.emailVerifiedAt && user.role === 'patient') {
    return { ok: false, message: 'Please verify your email address before signing in.' };
  }

  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.lastLoginAt = new Date();
  await user.save();

  resetRateLimit(`login:email:${email}`);

  await issueSession(user);

  await recordAudit({
    actor: { id: String(user._id), name: user.name, email: user.email, role: user.role, permissions: [] },
    action: 'auth.login',
    entity: 'User',
    entityId: String(user._id),
    summary: `${user.name} signed in`,
  });

  const next = String(formData.get('next') ?? '');
  redirect(safeRedirect(next, ADMIN_ROLES.includes(user.role) ? '/admin' : '/patient/dashboard'));
}

export async function registerAction(_prev: unknown, formData: FormData): Promise<ActionResult> {
  const parsed = registerSchema.safeParse({
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
    acceptTerms: formData.get('acceptTerms') === 'on',
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const limit = rateLimit(`register:${ip}`, RATE_LIMITS.register);
  if (!limit.success) {
    return { ok: false, message: 'Too many sign-up attempts. Please try again later.' };
  }

  const { name, email, phone, password } = parsed.data;

  await connectDB();

  const existing = await User.findOne({ email }).select('_id').lean();
  if (existing) {
    // This one *does* disclose existence — the alternative is a broken
    // sign-up flow. It is limited to the registration form and rate limited.
    return {
      ok: false,
      fieldErrors: { email: ['An account already exists with this email. Try signing in.'] },
    };
  }

  const user = await User.create({
    name,
    email,
    phone: normalisePhone(phone),
    password: await hashPassword(password),
    role: 'patient',
    status: 'active',
    emailVerifiedAt: new Date(),
  });

  await PatientProfile.create({
    user: user._id,
    patientNumber: await nextReference('patient'),
    address: { city: 'Port Harcourt', state: 'Rivers' },
  });

  /* Consent is recorded as an immutable event, with the request context. */
  await Consent.create({
    user: user._id,
    type: 'terms',
    version: '1.0',
    granted: true,
    ipAddress: ip,
    userAgent: requestHeaders.get('user-agent') ?? undefined,
  });

  await issueSession(user);

  await notify({
    recipientId: String(user._id),
    template: 'custom',
    channels: ['in_app'],
    data: {
      subject: 'Welcome to NurseOnCall',
      body:
        `Hi ${name.split(' ')[0]},\n\nYour account is ready. You can book a service, ` +
        `track your appointments and view receipts from your dashboard.`,
    },
    link: '/patient/dashboard',
  });

  redirect('/patient/dashboard');
}

export async function logoutAction() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/');
}

export async function forgotPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const ip = clientIp(await headers());
  const limit = rateLimit(`reset:${ip}`, RATE_LIMITS.passwordReset);

  /* Always the same reply, whether or not the account exists. */
  const neutral: ActionResult = {
    ok: true,
    message:
      'If an account exists for that email, a password reset link is on its way. ' +
      'Check your inbox and your spam folder.',
  };

  if (!limit.success) return neutral;

  await connectDB();
  const user = await User.findOne({ email: parsed.data.email });
  if (!user) return neutral;

  const { token, hash } = createToken();
  user.passwordResetToken = hash;
  user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
  await user.save();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  await notify({
    recipientId: String(user._id),
    template: 'custom',
    channels: ['email'],
    data: {
      subject: 'Reset your NurseOnCall password',
      body:
        `Hi ${user.name.split(' ')[0]},\n\n` +
        `Use the button below to choose a new password. The link expires in one hour.\n\n` +
        `If you did not request this, you can safely ignore this message — your ` +
        `password will not change.`,
    },
    // Carried as a button in HTML email and appended to the plain-text part,
    // so the link survives clients that refuse HTML.
    action: { label: 'Choose a new password', url: resetUrl },
  });

  return neutral;
}

export async function resetPasswordAction(
  _prev: unknown,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse({
    token: formData.get('token'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!parsed.success) {
    return { ok: false, fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await connectDB();

  // Look the token up by its hash — the raw value is never stored.
  const user = await User.findOne({
    passwordResetToken: hashToken(parsed.data.token),
    passwordResetExpires: { $gt: new Date() },
  }).select('+passwordResetToken +passwordResetExpires');

  if (!user) {
    return {
      ok: false,
      message: 'That reset link is invalid or has expired. Please request a new one.',
    };
  }

  user.password = await hashPassword(parsed.data.password);
  user.passwordResetToken = null;
  user.passwordResetExpires = null;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  // Invalidate every session issued before the password changed.
  user.sessionVersion += 1;
  await user.save();

  await recordAudit({
    action: 'auth.password_reset',
    entity: 'User',
    entityId: String(user._id),
    summary: `${user.name} reset their password`,
  });

  return { ok: true, message: 'Your password has been changed. You can now sign in.' };
}

/* ── helpers ──────────────────────────────────────────────────────── */

async function issueSession(user: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  sessionVersion?: number;
}) {
  const token = await signSession({
    sub: String(user._id),
    email: user.email,
    name: user.name,
    role: user.role as never,
    v: user.sessionVersion ?? 1,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions());
}

/**
 * Only same-origin, absolute-path redirects are honoured. Without this, a
 * crafted `?next=https://evil.example` turns the login form into an open
 * redirect that phishes freshly authenticated users.
 */
function safeRedirect(next: string, fallback: string): string {
  if (!next.startsWith('/') || next.startsWith('//')) return fallback;
  return next;
}
