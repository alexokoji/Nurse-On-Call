import { describe, it, expect } from 'vitest';
import { canTransition, toInstants } from '@/lib/bookings/service';
import { refundableAmount } from '@/lib/bookings/pricing';
import { formatNaira, toKobo, normalisePhone, displayPhone, percentChange, slugify } from '@/lib/utils';
import { loginSchema, registerSchema, passwordSchema, phoneSchema } from '@/lib/validations/auth';
import { createBookingSchema } from '@/lib/validations/booking';

/**
 * Money, status transitions and input validation — the three places where a
 * quiet mistake turns into a wrong charge, a double booking, or a booking
 * nobody can deliver.
 */

describe('booking status transitions', () => {
  it('allows the normal happy path', () => {
    expect(canTransition('pending_payment', 'confirmed')).toBe(true);
    expect(canTransition('confirmed', 'in_progress')).toBe(true);
    expect(canTransition('in_progress', 'completed')).toBe(true);
  });

  it('allows completing directly from confirmed', () => {
    // Short appointments are often marked done without an "in progress" step.
    expect(canTransition('confirmed', 'completed')).toBe(true);
  });

  it('refuses to move backwards', () => {
    expect(canTransition('completed', 'confirmed')).toBe(false);
    expect(canTransition('in_progress', 'pending_payment')).toBe(false);
  });

  it('treats completed, cancelled, no-show and expired as final', () => {
    for (const terminal of ['completed', 'cancelled', 'no_show', 'expired']) {
      for (const target of ['confirmed', 'in_progress', 'completed', 'cancelled']) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it('refuses to mark an unpaid booking as completed', () => {
    // A pending_payment booking must be confirmed (i.e. paid) first.
    expect(canTransition('pending_payment', 'completed')).toBe(false);
    expect(canTransition('pending_payment', 'in_progress')).toBe(false);
  });

  it('refuses a no-show on a booking that was never confirmed', () => {
    expect(canTransition('pending_payment', 'no_show')).toBe(false);
    expect(canTransition('confirmed', 'no_show')).toBe(true);
  });

  it('rejects an unknown status outright', () => {
    expect(canTransition('confirmed', 'teleported')).toBe(false);
    expect(canTransition('nonsense', 'confirmed')).toBe(false);
  });
});

describe('cancellation refunds', () => {
  const paidKobo = 2_500_000; // ₦25,000
  const base = new Date('2026-09-10T10:00:00');

  it('refunds in full outside the cancellation window', () => {
    const now = new Date('2026-09-08T10:00:00'); // 48 hours before
    expect(
      refundableAmount({ paidKobo, startAt: base, cancellationWindowHours: 24, now }),
    ).toBe(paidKobo);
  });

  it('refunds in full exactly on the window boundary', () => {
    const now = new Date('2026-09-09T10:00:00'); // exactly 24 hours before
    expect(
      refundableAmount({ paidKobo, startAt: base, cancellationWindowHours: 24, now }),
    ).toBe(paidKobo);
  });

  it('refunds half inside the window', () => {
    const now = new Date('2026-09-10T00:00:00'); // 10 hours before
    expect(
      refundableAmount({ paidKobo, startAt: base, cancellationWindowHours: 24, now }),
    ).toBe(paidKobo / 2);
  });

  it('refunds nothing once the appointment has started', () => {
    const now = new Date('2026-09-10T10:00:01');
    expect(
      refundableAmount({ paidKobo, startAt: base, cancellationWindowHours: 24, now }),
    ).toBe(0);
  });

  it('refunds nothing after the appointment', () => {
    const now = new Date('2026-09-11T10:00:00');
    expect(
      refundableAmount({ paidKobo, startAt: base, cancellationWindowHours: 24, now }),
    ).toBe(0);
  });

  it('never returns a fractional kobo', () => {
    const odd = 1_501; // an amount that halves unevenly
    const now = new Date('2026-09-10T09:00:00');
    const refund = refundableAmount({
      paidKobo: odd,
      startAt: base,
      cancellationWindowHours: 24,
      now,
    });
    expect(Number.isInteger(refund)).toBe(true);
  });
});

describe('money handling', () => {
  it('converts naira to kobo without floating-point drift', () => {
    expect(toKobo(25_000)).toBe(2_500_000);
    expect(toKobo(0.1)).toBe(10);
    expect(toKobo(1234.56)).toBe(123_456);
    // 19.99 * 100 is 1998.9999... in binary floating point.
    expect(toKobo(19.99)).toBe(1999);
  });

  it('formats kobo as naira', () => {
    expect(formatNaira(2_500_000)).toContain('25,000');
    expect(formatNaira(0)).toContain('0');
  });

  it('computes percentage change without dividing by zero', () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(0, 0)).toBe(0);
    expect(percentChange(10, 0)).toBe(100);
  });
});

describe('local time to UTC instants', () => {
  it('builds instants on the right calendar day', () => {
    const { startAt, endAt } = toInstants('2026-09-15', '09:30', '10:30');
    expect(startAt.getFullYear()).toBe(2026);
    expect(startAt.getMonth()).toBe(8); // September, zero-indexed
    expect(startAt.getDate()).toBe(15);
    expect(startAt.getHours()).toBe(9);
    expect(startAt.getMinutes()).toBe(30);
    expect(endAt.getHours()).toBe(10);
    expect(endAt.getTime()).toBeGreaterThan(startAt.getTime());
  });
});

describe('Nigerian phone numbers', () => {
  it('normalises the common local formats to E.164', () => {
    expect(normalisePhone('08031234567')).toBe('+2348031234567');
    expect(normalisePhone('0803 123 4567')).toBe('+2348031234567');
    expect(normalisePhone('2348031234567')).toBe('+2348031234567');
    expect(normalisePhone('+234 803 123 4567')).toBe('+2348031234567');
  });

  it('renders a normalised number back in local form', () => {
    expect(displayPhone('+2348031234567')).toBe('0803 123 4567');
  });

  it('accepts valid numbers and rejects malformed ones', () => {
    expect(phoneSchema.safeParse('08031234567').success).toBe(true);
    expect(phoneSchema.safeParse('0803 123 4567').success).toBe(true);
    expect(phoneSchema.safeParse('+2348031234567').success).toBe(true);

    expect(phoneSchema.safeParse('123').success).toBe(false);
    expect(phoneSchema.safeParse('0803123456').success).toBe(false); // one digit short
    expect(phoneSchema.safeParse('not a number').success).toBe(false);
  });
});

describe('password policy', () => {
  it('accepts a password meeting every rule', () => {
    expect(passwordSchema.safeParse('Admin@12345').success).toBe(true);
  });

  it('rejects passwords that miss a rule', () => {
    expect(passwordSchema.safeParse('short1A').success).toBe(false); // too short
    expect(passwordSchema.safeParse('alllowercase1').success).toBe(false); // no uppercase
    expect(passwordSchema.safeParse('ALLUPPERCASE1').success).toBe(false); // no lowercase
    expect(passwordSchema.safeParse('NoDigitsHere').success).toBe(false); // no number
  });
});

describe('registration validation', () => {
  const valid = {
    name: 'Chinedu Okafor',
    email: 'chinedu@example.com',
    phone: '08031234567',
    password: 'Secure@123',
    confirmPassword: 'Secure@123',
    acceptTerms: true as const,
  };

  it('accepts a complete, consistent registration', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true);
  });

  it('rejects mismatched passwords and points at the right field', () => {
    const result = registerSchema.safeParse({ ...valid, confirmPassword: 'Different@123' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('confirmPassword'))).toBe(true);
    }
  });

  it('requires the terms to be accepted', () => {
    expect(registerSchema.safeParse({ ...valid, acceptTerms: false }).success).toBe(false);
  });

  it('normalises the email to lower case', () => {
    const result = registerSchema.safeParse({ ...valid, email: '  Chinedu@Example.COM ' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe('chinedu@example.com');
  });

  it('rejects a login without a password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false);
  });
});

describe('booking payload validation', () => {
  const base = {
    serviceId: 'service-1',
    dateKey: '2026-09-15',
    startTime: '09:30',
    contact: {
      name: 'Chinedu Okafor',
      phone: '08031234567',
      email: 'chinedu@example.com',
    },
  };

  it('accepts a clinic booking with no address', () => {
    expect(createBookingSchema.safeParse({ ...base, locationType: 'clinic' }).success).toBe(true);
  });

  it('rejects a home visit without an address', () => {
    const result = createBookingSchema.safeParse({ ...base, locationType: 'home' });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((issue) => issue.path.includes('address'))).toBe(true);
    }
  });

  it('accepts a home visit with a complete address', () => {
    const result = createBookingSchema.safeParse({
      ...base,
      locationType: 'home',
      address: { street: '24 Aba Road', city: 'Port Harcourt', state: 'Rivers' },
    });
    expect(result.success).toBe(true);
  });

  it('rejects malformed dates and times', () => {
    expect(
      createBookingSchema.safeParse({ ...base, locationType: 'clinic', dateKey: '15/09/2026' })
        .success,
    ).toBe(false);
    expect(
      createBookingSchema.safeParse({ ...base, locationType: 'clinic', startTime: '9:30am' })
        .success,
    ).toBe(false);
    expect(
      createBookingSchema.safeParse({ ...base, locationType: 'clinic', startTime: '25:00' })
        .success,
    ).toBe(false);
  });

  it('rejects an unknown location type', () => {
    expect(createBookingSchema.safeParse({ ...base, locationType: 'moon' }).success).toBe(false);
  });

  it('ignores any price the client tries to send', () => {
    const result = createBookingSchema.safeParse({
      ...base,
      locationType: 'clinic',
      totalKobo: 1,
      priceKobo: 1,
      status: 'confirmed',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      // Money and status are derived server-side; they are stripped here.
      expect(result.data).not.toHaveProperty('totalKobo');
      expect(result.data).not.toHaveProperty('priceKobo');
      expect(result.data).not.toHaveProperty('status');
    }
  });
});

describe('slug generation', () => {
  it('produces url-safe slugs', () => {
    expect(slugify('Home Nursing')).toBe('home-nursing');
    expect(slugify('  Doctor  Consultation  ')).toBe('doctor-consultation');
    expect(slugify("Nurse's Care & Support!")).toBe('nurses-care-support');
  });
});
