import type { Metadata } from 'next';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { ClipboardList } from 'lucide-react';
import { FilterBar } from '@/components/admin/filter-bar';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, TableSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { getAuditLogs, getAuditFilterOptions } from '@/lib/queries/admin';
import { LABELS } from '@/types';

export const metadata: Metadata = { title: 'Audit Logs' };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; entity?: string; action?: string; page?: string }>;
}) {
  await requireAdmin('audit.view');
  const params = await searchParams;
  const options = await getAuditFilterOptions();

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">Audit logs</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Every administrative action that changes a record, who performed it, and what changed.
        </p>
      </div>

      <FilterBar
        searchPlaceholder="Search by summary, person or record id…"
        filters={[
          {
            name: 'entity',
            label: 'All Records',
            options: options.entities.map((entity) => ({ value: entity, label: entity })),
          },
          {
            name: 'action',
            label: 'All Actions',
            options: options.actions.map((action) => ({
              value: action,
              label: action.replace(/[._]/g, ' '),
            })),
          },
        ]}
      />

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={10} columns={4} />
          </div>
        }
      >
        <LogList params={params} />
      </Suspense>
    </div>
  );
}

async function LogList({
  params,
}: {
  params: { q?: string; entity?: string; action?: string; page?: string };
}) {
  const result = await getAuditLogs({
    q: params.q,
    entity: params.entity,
    action: params.action,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={ClipboardList}
          title="No audit entries"
          description="Administrative actions are recorded here as they happen."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <ul className="divide-y divide-border">
        {result.data.map((entry) => {
          const changed = entry.after && Object.keys(entry.after).length > 0;

          return (
            <li key={entry.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-navy-800">{entry.summary}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-medium text-navy-800">{entry.actorName}</span>
                    <span aria-hidden>·</span>
                    <span>
                      {LABELS.userRole[entry.actorRole as keyof typeof LABELS.userRole] ??
                        entry.actorRole}
                    </span>
                    <span aria-hidden>·</span>
                    <time dateTime={entry.createdAt}>
                      {format(new Date(entry.createdAt), 'd MMM yyyy, HH:mm:ss')}
                    </time>
                    {entry.ipAddress && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="font-mono">{entry.ipAddress}</span>
                      </>
                    )}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap gap-1.5">
                  <Badge variant="outline">{entry.entity}</Badge>
                  <Badge variant="info">{entry.action}</Badge>
                </div>
              </div>

              {changed && (
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs font-medium text-primary hover:underline">
                    View what changed
                  </summary>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <ChangeBlock label="Before" data={entry.before} />
                    <ChangeBlock label="After" data={entry.after} />
                  </div>
                </details>
              )}
            </li>
          );
        })}
      </ul>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="entries"
      />
    </div>
  );
}

function ChangeBlock({ label, data }: { label: string; data: Record<string, unknown> | null }) {
  const entries = data ? Object.entries(data) : [];

  return (
    <div className="rounded-lg bg-secondary/60 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      {entries.length === 0 ? (
        <p className="mt-1 text-xs italic text-muted-foreground">—</p>
      ) : (
        <dl className="mt-1.5 space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2 text-xs">
              <dt className="shrink-0 font-medium text-navy-800">{key}:</dt>
              <dd className="min-w-0 break-words font-mono text-muted-foreground">
                {formatValue(value)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined) return '—';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
