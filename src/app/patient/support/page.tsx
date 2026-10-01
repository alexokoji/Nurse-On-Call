import type { Metadata } from 'next';
import { format } from 'date-fns';
import { LifeBuoy, Mail, Phone } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/feedback';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientTickets } from '@/lib/queries/patient';
import { getSettings } from '@/lib/settings';
import { cn } from '@/lib/utils';
import { NewTicketForm, TicketReplyForm } from './support-forms';

export const metadata: Metadata = { title: 'Support' };

const STATUS_VARIANT = {
  open: 'info',
  in_progress: 'warning',
  resolved: 'success',
  closed: 'neutral',
} as const;

export default async function PatientSupportPage() {
  const user = await requirePatient();
  const [tickets, general] = await Promise.all([getPatientTickets(user.id), getSettings('general')]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">Support</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Raise a request here, or call us if it is urgent.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href={`tel:${general.phone.replace(/\s/g, '')}`}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:bg-secondary/40"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-crimson-50 text-crimson-600">
            <Phone className="size-5" aria-hidden />
          </span>
          <span>
            <span className="block text-sm font-semibold text-navy-800">{general.phone}</span>
            <span className="text-xs text-muted-foreground">Available 24/7</span>
          </span>
        </a>

        <a
          href={`mailto:${general.supportEmail}`}
          className="flex items-center gap-4 rounded-xl border border-border bg-card p-5 shadow-card transition-colors hover:bg-secondary/40"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Mail className="size-5" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-navy-800">
              {general.supportEmail}
            </span>
            <span className="text-xs text-muted-foreground">Replies within one working day</span>
          </span>
        </a>
      </div>

      <NewTicketForm />

      <section>
        <h2 className="text-sm font-semibold text-navy-800">Your requests</h2>

        {tickets.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={LifeBuoy}
            title="No support requests"
            description="Anything you raise will appear here with our replies."
          />
        ) : (
          <ul className="mt-4 space-y-4">
            {tickets.map((ticket) => (
              <li key={ticket.id} className="rounded-xl border border-border bg-card shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-navy-800">{ticket.subject}</p>
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                      {ticket.reference} · opened{' '}
                      {format(new Date(ticket.createdAt), 'd MMM yyyy')}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[ticket.status as keyof typeof STATUS_VARIANT]}>
                    {ticket.status.replace(/_/g, ' ')}
                  </Badge>
                </div>

                <ul className="space-y-4 p-5">
                  {ticket.messages.map((message, index) => (
                    <li
                      key={index}
                      className={cn(
                        'rounded-lg p-4',
                        message.isStaff
                          ? 'bg-brand-50/60'
                          : 'bg-secondary/60',
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-xs font-semibold text-navy-800">
                          {message.isStaff ? `${message.authorName} · NurseOnCall` : 'You'}
                        </span>
                        <time
                          dateTime={message.createdAt}
                          className="text-xs text-muted-foreground"
                        >
                          {format(new Date(message.createdAt), 'd MMM yyyy, h:mm a')}
                        </time>
                      </div>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                        {message.body}
                      </p>
                    </li>
                  ))}
                </ul>

                {ticket.status !== 'closed' && (
                  <div className="border-t border-border p-5">
                    <TicketReplyForm ticketId={ticket.id} />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
