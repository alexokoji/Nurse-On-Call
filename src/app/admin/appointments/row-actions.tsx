'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  CalendarClock,
  CreditCard,
  Eye,
  MoreHorizontal,
  Pencil,
  Receipt,
  User,
  UserPlus,
  XCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Alert } from '@/components/ui/feedback';
import { adminCancelBookingAction } from '../actions/bookings';
import type { ActionResult, BookingStatus } from '@/types';
import type { Permission } from '@/lib/permissions/catalogue';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

/**
 * The three-dot menu on each appointment row.
 *
 * Entries are filtered by permission *and* by what the booking's current
 * status actually allows, so the menu never offers an action that would be
 * rejected — e.g. cancelling an already-completed appointment.
 */
export function AppointmentRowActions({
  bookingId,
  patientId,
  status,
  isPaid,
  permissions,
  isSuperAdmin,
}: {
  bookingId: string;
  patientId: string;
  status: BookingStatus;
  isPaid: boolean;
  permissions: string[];
  isSuperAdmin: boolean;
}) {
  const [cancelOpen, setCancelOpen] = useState(false);

  const can = (permission: Permission) => isSuperAdmin || permissions.includes(permission);

  const isLive = ['pending_payment', 'confirmed', 'in_progress'].includes(status);
  const canCancel = can('appointments.cancel') && isLive;
  const canReschedule = can('appointments.reschedule') && ['pending_payment', 'confirmed'].includes(status);
  const canAssign = can('appointments.assign') && isLive;

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Appointment actions">
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Appointment</DropdownMenuLabel>

          <DropdownMenuItem asChild>
            <Link href={`/admin/appointments/${bookingId}`}>
              <Eye />
              View details
            </Link>
          </DropdownMenuItem>

          {can('appointments.edit') && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/appointments/${bookingId}?edit=1`}>
                <Pencil />
                Edit
              </Link>
            </DropdownMenuItem>
          )}

          {canAssign && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/appointments/${bookingId}#assign`}>
                <UserPlus />
                Assign staff
              </Link>
            </DropdownMenuItem>
          )}

          {canReschedule && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/appointments/${bookingId}#reschedule`}>
                <CalendarClock />
                Reschedule
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />
          <DropdownMenuLabel>Related</DropdownMenuLabel>

          {can('patients.view') && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/patients/${patientId}`}>
                <User />
                View patient
              </Link>
            </DropdownMenuItem>
          )}

          {can('payments.view') && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/appointments/${bookingId}#payments`}>
                <CreditCard />
                View payment
              </Link>
            </DropdownMenuItem>
          )}

          {can('payments.refund') && isPaid && (
            <DropdownMenuItem asChild>
              <Link href={`/admin/appointments/${bookingId}#refund`}>
                <Receipt />
                Issue refund
              </Link>
            </DropdownMenuItem>
          )}

          {canCancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem destructive onSelect={() => setCancelOpen(true)}>
                <XCircle />
                Cancel appointment
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <CancelDialog bookingId={bookingId} open={cancelOpen} onOpenChange={setCancelOpen} />
    </>
  );
}

function CancelDialog({
  bookingId,
  open,
  onOpenChange,
}: {
  bookingId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState(adminCancelBookingAction, INITIAL);

  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription>
            The patient is notified and the slot is released. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Field label="Reason for cancellation" required error={state.fieldErrors?.reason?.[0]}>
            <Textarea
              name="reason"
              rows={3}
              placeholder="This is recorded in the audit log and shared with the patient."
              required
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Keep appointment
            </Button>
            <SubmitButton variant="destructive" pendingLabel="Cancelling…">
              Cancel appointment
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
