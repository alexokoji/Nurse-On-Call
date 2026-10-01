import 'server-only';
import { headers } from 'next/headers';
import { connectDB } from '@/lib/db/connect';
import { AuditLog } from '@/models';
import type { CurrentUser } from '@/lib/auth/current-user';

/** Field names whose values must never reach the audit trail. */
const REDACTED_KEYS = [
  'password',
  'passwordhash',
  'token',
  'secret',
  'apikey',
  'authorization',
  'passwordresettoken',
  'emailverificationtoken',
];

function redact(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.includes(key.toLowerCase()) ? '[redacted]' : redact(val);
    }
    return out;
  }
  return value;
}

/** Only the keys that actually changed, so the diff stays readable. */
function diff(before?: Record<string, unknown>, after?: Record<string, unknown>) {
  if (!before || !after) {
    return { before: before ? redact(before) : null, after: after ? redact(after) : null };
  }
  const changedBefore: Record<string, unknown> = {};
  const changedAfter: Record<string, unknown> = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
      changedBefore[key] = before[key];
      changedAfter[key] = after[key];
    }
  }
  return {
    before: redact(changedBefore) as Record<string, unknown>,
    after: redact(changedAfter) as Record<string, unknown>,
  };
}

export interface AuditInput {
  actor?: CurrentUser | null;
  action: string;
  entity: string;
  entityId?: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
}

/**
 * Write an audit entry. Never throws — a failed audit write must not roll back
 * the business operation it describes, but it is logged for investigation.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await connectDB();

    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    try {
      const h = await headers();
      ipAddress = h.get('x-forwarded-for')?.split(',')[0].trim() ?? undefined;
      userAgent = h.get('user-agent') ?? undefined;
    } catch {
      // Outside a request scope (e.g. a seed script) — headers are unavailable.
    }

    const { before, after } = diff(input.before, input.after);

    await AuditLog.create({
      actor: input.actor?.id ?? null,
      actorName: input.actor?.name ?? 'System',
      actorRole: input.actor?.role ?? 'system',
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      summary: input.summary,
      before,
      after,
      ipAddress,
      userAgent,
    });
  } catch (error) {
    console.error('[audit] failed to record entry', {
      action: input.action,
      entity: input.entity,
      error,
    });
  }
}
