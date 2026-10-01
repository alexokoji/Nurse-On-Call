import { Badge, type BadgeProps } from './badge';
import { LABELS } from '@/types';
import type { BookingStatus, PaymentStatus, RefundStatus, ReviewStatus, UserStatus } from '@/types';

/**
 * One place that maps a domain status to a colour and a label.
 *
 * Every table, card and detail page uses this, so "Confirmed" is the same
 * green everywhere and a new status cannot be introduced without choosing
 * its presentation here.
 */

type Variant = NonNullable<BadgeProps['variant']>;

const BOOKING: Record<BookingStatus, Variant> = {
  pending_payment: 'warning',
  confirmed: 'success',
  in_progress: 'info',
  completed: 'info',
  cancelled: 'danger',
  no_show: 'neutral',
  expired: 'neutral',
};

const PAYMENT: Record<PaymentStatus, Variant> = {
  pending: 'warning',
  successful: 'success',
  failed: 'danger',
  abandoned: 'neutral',
  refunded: 'purple',
  partially_refunded: 'purple',
};

const REFUND: Record<RefundStatus, Variant> = {
  requested: 'warning',
  approved: 'info',
  rejected: 'danger',
  processing: 'info',
  completed: 'success',
  failed: 'danger',
};

const REVIEW: Record<ReviewStatus, Variant> = {
  pending: 'warning',
  approved: 'success',
  hidden: 'neutral',
};

const USER: Record<UserStatus, Variant> = {
  active: 'success',
  inactive: 'neutral',
  suspended: 'danger',
  pending: 'warning',
};

const REVIEW_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  hidden: 'Hidden',
};

const USER_LABELS: Record<UserStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  pending: 'Pending',
};

type StatusBadgeProps =
  | { kind: 'booking'; status: BookingStatus; className?: string; dot?: boolean }
  | { kind: 'payment'; status: PaymentStatus; className?: string; dot?: boolean }
  | { kind: 'refund'; status: RefundStatus; className?: string; dot?: boolean }
  | { kind: 'review'; status: ReviewStatus; className?: string; dot?: boolean }
  | { kind: 'user'; status: UserStatus; className?: string; dot?: boolean };

export function StatusBadge(props: StatusBadgeProps) {
  const { className, dot } = props;

  const { variant, label } = ((): { variant: Variant; label: string } => {
    switch (props.kind) {
      case 'booking':
        return { variant: BOOKING[props.status], label: LABELS.bookingStatus[props.status] };
      case 'payment':
        return { variant: PAYMENT[props.status], label: LABELS.paymentStatus[props.status] };
      case 'refund':
        return { variant: REFUND[props.status], label: LABELS.refundStatus[props.status] };
      case 'review':
        return { variant: REVIEW[props.status], label: REVIEW_LABELS[props.status] };
      case 'user':
        return { variant: USER[props.status], label: USER_LABELS[props.status] };
    }
  })();

  return (
    <Badge variant={variant} dot={dot} className={className}>
      {label}
    </Badge>
  );
}
