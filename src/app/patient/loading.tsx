import { CardSkeleton, TableSkeleton } from '@/components/ui/feedback';

export default function PatientLoading() {
  return (
    <div className="space-y-6" role="status" aria-label="Loading">
      <div className="space-y-2">
        <div className="skeleton h-6 w-56" />
        <div className="skeleton h-3 w-72" />
      </div>

      <CardSkeleton count={4} />

      <div className="rounded-xl border border-border bg-card p-5">
        <TableSkeleton rows={5} columns={4} />
      </div>

      <span className="sr-only">Loading…</span>
    </div>
  );
}
