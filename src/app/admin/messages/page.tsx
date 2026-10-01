import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { MessageSquare } from 'lucide-react';
import { FilterBar } from '@/components/admin/filter-bar';
import { TicketReply } from './ticket-reply';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, TableSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getAdminTickets } from '@/lib/queries/admin';
import { cn, initials } from '@/lib/utils';

export const metadata: Metadata = { title: 'Messages' };

const STATUS_TONE = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
} as const;

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  await requireAdmin('support.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold tracking-tight text-navy-800">Messages</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Support requests raised by patients from their dashboard or the contact form.
        </p>
      </div>

      <FilterBar
        searchPlaceholder="Search messages…"
        filters={[
          {
            name: 'status',
            label: 'All Status',
            options: [
              { value: 'open', label: 'Open' },
              { value: 'in_progress', label: 'In progress' },
              { value: 'resolved', label: 'Resolved' },
              { value: 'closed', label: 'Closed' },
            ],
          },
        ]}
      />

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={5} columns={3} />
          </div>
        }
      >
        <TicketList params={params} />
      </Suspense>
    </div>
  );
}

async function TicketList({ params }: { params: { status?: string; page?: string } }) {
  const user = await requireAdmin('support.view');
  const canRespond = userCan(user, 'support.respond');

  const result = await getAdminTickets({
    status: params.status,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={MessageSquare}
          title="No messages"
          description="Support requests from patients will appear here."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {result.data.map((ticket) => (
        <article key={ticket.id} className="rounded-xl border border-border bg-card shadow-card">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-navy-800">{ticket.subject}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span className="font-mono">{ticket.reference}</span>
                <span aria-hidden>·</span>
                {userCan(user, 'patients.view') ? (
                  <Link
                    href={`/admin/patients/${ticket.patientId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {ticket.patientName}
                  </Link>
                ) : (
                  <span className="font-medium text-navy-800">{ticket.patientName}</span>
                )}
                <span aria-hidden>·</span>
                <span>opened {format(new Date(ticket.createdAt), 'd MMM yyyy')}</span>
              </p>
            </div>

            <Badge variant={STATUS_TONE[ticket.status as keyof typeof STATUS_TONE]}>
              {ticket.status.replace(/_/g, ' ')}
            </Badge>
          </div>

          <ul className="space-y-3 p-5">
            {ticket.messages.map((message, index) => (
              <li
                key={index}
                className={cn(
                  'flex gap-3 rounded-lg p-4',
                  message.isStaff ? 'bg-brand-50/60' : 'bg-secondary/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold',
                    message.isStaff
                      ? 'bg-brand-500 text-white'
                      : 'bg-white text-navy-800 ring-1 ring-border',
                  )}
                >
                  {initials(message.authorName)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="text-xs font-semibold text-navy-800">
                      {message.authorName}
                      {message.isStaff && ' · NurseOnCall'}
                    </span>
                    <time dateTime={message.createdAt} className="text-xs text-muted-foreground">
                      {format(new Date(message.createdAt), 'd MMM yyyy, HH:mm')}
                    </time>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {message.body}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {canRespond && ticket.status !== 'closed' && (
            <div className="border-t border-border p-5">
              <TicketReply ticketId={ticket.id} currentStatus={ticket.status} />
            </div>
          )}
        </article>
      ))}

      <div className="rounded-xl border border-border bg-card shadow-card">
        <Pagination
          page={result.page}
          totalPages={result.totalPages}
          total={result.total}
          pageSize={result.pageSize}
          label="messages"
        />
      </div>
    </div>
  );
}
