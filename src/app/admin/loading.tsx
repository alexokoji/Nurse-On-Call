import { CardSkeleton, TableSkeleton } from '@/components/ui/feedback';

/**
 * Shared loading state for every admin route, so no admin page ever shows a
 * blank screen while its data resolves.
 */
export default function AdminLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-3 w-72" />
      </div>

      <CardSkeleton count={4} />

      <div className="rounded-xl border border-border bg-card p-5">
        <TableSkeleton rows={8} columns={6} />
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
