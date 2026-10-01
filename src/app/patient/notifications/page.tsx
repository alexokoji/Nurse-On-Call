import type { Metadata } from 'next';
import Link from 'next/link';
import { format } from 'date-fns';
import { Bell, CheckCheck } from 'lucide-react';
import { EmptyState } from '@/components/ui/feedback';
import { Button } from '@/components/ui/button';
import { requirePatient } from '@/lib/auth/guards';
import { getPatientNotifications } from '@/lib/queries/patient';
import { markAllReadAction } from '../actions';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Notifications' };

export default async function PatientNotificationsPage() {
  const user = await requirePatient();
  const notifications = await getPatientNotifications(user.id);
  const unread = notifications.filter((notification) => !notification.readAt);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-navy-800">
            Notifications
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {unread.length > 0
              ? `${unread.length} unread ${unread.length === 1 ? 'message' : 'messages'}.`
              : 'You are all caught up.'}
          </p>
        </div>

        {unread.length > 0 && (
          <form action={markAllReadAction}>
            <Button type="submit" variant="outline" size="sm">
              <CheckCheck className="size-4" />
              Mark all as read
            </Button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications yet"
          description="Booking confirmations, reminders and payment receipts will appear here."
          action={{ label: 'Book a service', href: '/book' }}
        />
      ) : (
        <ul className="space-y-2">
          {notifications.map((notification) => {
            const body = (
              <>
                <span
                  className={cn(
                    'mt-1.5 flex size-9 shrink-0 items-center justify-center rounded-full',
                    notification.readAt
                      ? 'bg-secondary text-muted-foreground'
                      : 'bg-brand-50 text-brand-600',
                  )}
                >
                  <Bell className="size-4" aria-hidden />
                </span>

                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline justify-between gap-2">
                    <span
                      className={cn(
                        'text-sm',
                        notification.readAt
                          ? 'font-medium text-navy-800'
                          : 'font-semibold text-navy-800',
                      )}
                    >
                      {notification.subject}
                    </span>
                    <time
                      dateTime={notification.createdAt}
                      className="shrink-0 text-xs text-muted-foreground"
                    >
                      {format(new Date(notification.createdAt), 'd MMM yyyy, h:mm a')}
                    </time>
                  </span>

                  <span className="mt-1 block whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {notification.body}
                  </span>
                </span>

                {!notification.readAt && (
                  <span
                    className="mt-2 size-2 shrink-0 rounded-full bg-primary"
                    aria-label="Unread"
                  />
                )}
              </>
            );

            return (
              <li key={notification.id}>
                {notification.link ? (
                  <Link
                    href={notification.link}
                    className={cn(
                      'flex gap-3 rounded-xl border p-4 transition-colors',
                      notification.readAt
                        ? 'border-border bg-card hover:bg-secondary/40'
                        : 'border-brand-200 bg-brand-50/40 hover:bg-brand-50/70',
                    )}
                  >
                    {body}
                  </Link>
                ) : (
                  <div
                    className={cn(
                      'flex gap-3 rounded-xl border p-4',
                      notification.readAt
                        ? 'border-border bg-card'
                        : 'border-brand-200 bg-brand-50/40',
                    )}
                  >
                    {body}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
