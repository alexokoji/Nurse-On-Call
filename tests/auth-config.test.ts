import { describe, expect, it, afterEach, beforeEach } from 'vitest';
import { isSessionConfigured, SESSION_CONFIG_ERROR, signSession } from '@/lib/auth/session';

/**
 * A deployment with no usable AUTH_SECRET must be detectable *before* anything
 * is written.
 *
 * This is a regression test for a real failure: registration wrote the user,
 * their patient profile and their consent record, and only then tried to sign
 * them in. With AUTH_SECRET missing — the normal state of a hosted deployment
 * whose environment variables have not been set, since .env.local is never
 * deployed — that threw, the request 500'd, and the account was left existing
 * but unusable. Every retry then answered "an account already exists with this
 * email", with no way out from the UI.
 */

describe('session configuration', () => {
  const original = process.env.AUTH_SECRET;

  beforeEach(() => {
    delete process.env.AUTH_SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.AUTH_SECRET;
    else process.env.AUTH_SECRET = original;
  });

  it('reports unconfigured when AUTH_SECRET is absent', () => {
    expect(isSessionConfigured()).toBe(false);
  });

  it('reports unconfigured when AUTH_SECRET is too short to sign with', () => {
    process.env.AUTH_SECRET = 'tooshort';
    expect(isSessionConfigured()).toBe(false);
  });

  it('accepts a secret of sufficient length', () => {
    process.env.AUTH_SECRET = 'a'.repeat(16);
    expect(isSessionConfigured()).toBe(true);
  });

  it('accepts a generated 32-byte secret', () => {
    process.env.AUTH_SECRET = Buffer.from('b'.repeat(32)).toString('base64');
    expect(isSessionConfigured()).toBe(true);
  });

  /* The check must agree with what actually happens, or guarding on it is
     theatre: an unconfigured deployment has to fail the signing attempt too. */
  it('signing fails when the check says it would', async () => {
    expect(isSessionConfigured()).toBe(false);
    await expect(
      signSession({ sub: '1', email: 'a@b.ng', name: 'A', role: 'patient', v: 1 }),
    ).rejects.toThrow(/AUTH_SECRET/);
  });

  it('signing succeeds when the check says it would', async () => {
    process.env.AUTH_SECRET = 'x'.repeat(32);
    expect(isSessionConfigured()).toBe(true);
    const token = await signSession({
      sub: '1',
      email: 'a@b.ng',
      name: 'A',
      role: 'patient',
      v: 1,
    });
    expect(token.split('.')).toHaveLength(3);
  });

  it('names the variable and does not send operators to .env.local alone', () => {
    expect(SESSION_CONFIG_ERROR).toContain('AUTH_SECRET');
    expect(SESSION_CONFIG_ERROR).toMatch(/hosting provider/i);
  });
});
