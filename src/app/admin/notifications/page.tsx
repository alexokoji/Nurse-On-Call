import type { Metadata } from 'next';
import { Suspense } from 'react';
import { format } from 'date-fns';
import { Bell, Mail, MessageSquare, Smartphone } from 'lucide-react';
import { FilterBar } from '@/components/admin/filter-bar';
import { SendNotificationForm } from './send-form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pagination } from '@/components/ui/pagination';
import { EmptyState, TableSkeleton } from '@/components/ui/feedback';
import { requireAdmin } from '@/lib/auth/guards';
import { userCan } from '@/lib/auth/current-user';
import { getNotificationHistory } from '@/lib/queries/admin';
import { truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Notifications' };

const CHANNEL_ICON = { email: Mail, sms: Smartphone, in_app: Bell };

const STATUS_TONE = {
  sent: 'success',
  read: 'info',
  queued: 'warning',
  failed: 'danger',
} as const;

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string; page?: string }>;
}) {
  const user = await requireAdmin('notifications.view');
  const params = await searchParams;

  return (
    <div className="space-y-5">
      {userCan(user, 'notifications.send') && <SendNotificationForm />}

      <div>
        <h2 className="text-sm font-semibold text-navy-800">Notification history</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Every message the system has attempted to send, including failures.
        </p>
      </div>

      <FilterBar
        searchPlaceholder="Search notifications…"
        filters={[
          {
            name: 'channel',
            label: 'All Channels',
            options: [
              { value: 'email', label: 'Email' },
              { value: 'sms', label: 'SMS' },
              { value: 'in_app', label: 'In-app' },
            ],
          },
        ]}
      />

      <Suspense
        key={JSON.stringify(params)}
        fallback={
          <div className="rounded-xl border border-border bg-card p-5">
            <TableSkeleton rows={8} columns={5} />
          </div>
        }
      >
        <HistoryTable params={params} />
      </Suspense>
    </div>
  );
}

async function HistoryTable({ params }: { params: { channel?: string; page?: string } }) {
  const result = await getNotificationHistory({
    channel: params.channel,
    page: Number(params.page ?? 1),
  });

  if (result.data.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-5 shadow-card">
        <EmptyState
          icon={MessageSquare}
          title="No notifications sent yet"
          description="Booking confirmations, reminders and receipts appear here automatically."
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Channel</TableHead>
            <TableHead>Recipient</TableHead>
            <TableHead>Message</TableHead>
            <TableHead>Sent by</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {result.data.map((notification) => {
            const Icon = CHANNEL_ICON[notification.channel as keyof typeof CHANNEL_ICON] ?? Bell;

            return (
              <TableRow key={notification.id}>
                <TableCell>
                  <span className="flex items-center gap-1.5 text-sm capitalize text-navy-800">
                    <Icon className="size-3.5 text-muted-foreground" aria-hidden />
                    {notification.channel.replace(/_/g, '-')}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="block max-w-[12rem] truncate text-sm text-navy-800">
                    {notification.recipientName}
                  </span>
                  {notification.batchId && (
                    <span className="text-xs text-muted-foreground">Part of a broadcast</span>
                  )}
                </TableCell>

                <TableCell>
                  <p className="max-w-[22rem] truncate text-sm font-medium text-navy-800">
                    {notification.subject}
                  </p>
                  <p className="max-w-[22rem] truncate text-xs text-muted-foreground">
                    {truncate(notification.body.replace(/\n/g, ' '), 90)}
                  </p>
                </TableCell>

                <TableCell>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {notification.sentBy}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="whitespace-nowrap text-sm text-muted-foreground">
                    {format(new Date(notification.createdAt), 'd MMM, HH:mm')}
                  </span>
                </TableCell>

                <TableCell>
                  <Badge variant={STATUS_TONE[notification.status as keyof typeof STATUS_TONE]}>
                    {notification.status}
                  </Badge>
                  {notification.failureReason && (
                    <p className="mt-1 max-w-[12rem] text-xs text-destructive">
                      {notification.failureReason}
                    </p>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Pagination
        page={result.page}
        totalPages={result.totalPages}
        total={result.total}
        pageSize={result.pageSize}
        label="notifications"
      />
    </div>
  );
}
