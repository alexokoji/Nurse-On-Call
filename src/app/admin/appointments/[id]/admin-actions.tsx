'use client';

import { useActionState, useState } from 'react';
import { Banknote, CalendarClock, CheckCircle2, RotateCcw, UserPlus, XCircle } from 'lucide-react';
import {
  adminAssignStaffAction,
  adminCancelBookingAction,
  adminRecordManualPaymentAction,
  adminRescheduleAction,
  adminUpdateStatusAction,
} from '../../actions/bookings';
import { requestRefundAction } from '../../actions/finance';
import { BookingDatePicker } from '@/components/booking/date-picker';
import { SlotPicker } from '@/components/booking/slot-picker';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input, Textarea } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatNaira, formatTimeLabel } from '@/lib/utils';
import { LABELS } from '@/types';
import type { ActionResult, BookingStatus, LocationType, TimeSlot } from '@/types';
import type { Permission } from '@/lib/permissions/catalogue';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

interface PaymentSummary {
  id: string;
  reference: string;
  status: string;
  amountPaidKobo: number;
  refundedKobo: number;
}

/**
 * Everything an administrator can do to one appointment.
 *
 * Buttons appear only when the permission *and* the current status allow it;
 * the server actions re-check both, so this is a usability filter rather than
 * the security boundary.
 */
export function AppointmentAdminActions({
  bookingId,
  status,
  isPaid,
  currentStaffId,
  eligibleStaff,
  serviceId,
  locationType,
  amountKobo,
  payments,
  permissions,
  isSuperAdmin,
}: {
  bookingId: string;
  status: BookingStatus;
  isPaid: boolean;
  currentStaffId: string | null;
  eligibleStaff: { id: string; name: string; title: string }[];
  serviceId: string;
  locationType: LocationType;
  amountKobo: number;
  payments: PaymentSummary[];
  permissions: string[];
  isSuperAdmin: boolean;
}) {
  const [dialog, setDialog] = useState<
    'assign' | 'reschedule' | 'cancel' | 'payment' | 'refund' | null
  >(null);

  const can = (permission: Permission) => isSuperAdmin || permissions.includes(permission);

  const isLive = ['pending_payment', 'confirmed', 'in_progress'].includes(status);
  const refundable = payments.find(
    (payment) =>
      ['successful', 'partially_refunded'].includes(payment.status) &&
      payment.amountPaidKobo > payment.refundedKobo,
  );

  const showStatusButtons = can('appointments.edit') && isLive;

  return (
    <section className="rounded-xl border border-border bg-card shadow-card">
      <h3 className="border-b border-border px-5 py-4 text-sm font-semibold text-navy-800">
        Manage this appointment
      </h3>

      <div className="flex flex-wrap gap-2 p-5">
        {can('appointments.assign') && isLive && (
          <Button variant="outline" onClick={() => setDialog('assign')}>
            <UserPlus className="size-4" />
            {currentStaffId ? 'Reassign staff' : 'Assign staff'}
          </Button>
        )}

        {can('appointments.reschedule') && ['pending_payment', 'confirmed'].includes(status) && (
          <Button variant="outline" onClick={() => setDialog('reschedule')}>
            <CalendarClock className="size-4" />
            Reschedule
          </Button>
        )}

        {showStatusButtons && status === 'confirmed' && (
          <StatusButton bookingId={bookingId} status="in_progress" label="Mark in progress" />
        )}

        {showStatusButtons && ['confirmed', 'in_progress'].includes(status) && (
          <StatusButton
            bookingId={bookingId}
            status="completed"
            label="Mark completed"
            variant="accent"
            icon={CheckCircle2}
          />
        )}

        {showStatusButtons && status === 'confirmed' && (
          <StatusButton bookingId={bookingId} status="no_show" label="Mark no-show" />
        )}

        {can('payments.refund') && !isPaid && isLive && (
          <Button variant="outline" onClick={() => setDialog('payment')}>
            <Banknote className="size-4" />
            Record payment
          </Button>
        )}

        {can('payments.refund') && refundable && (
          <Button variant="outline" onClick={() => setDialog('refund')}>
            <RotateCcw className="size-4" />
            Issue refund
          </Button>
        )}

        {can('appointments.cancel') && isLive && (
          <Button
            variant="outline"
            className="text-destructive hover:bg-red-50"
            onClick={() => setDialog('cancel')}
          >
            <XCircle className="size-4" />
            Cancel
          </Button>
        )}
      </div>

      <AssignDialog
        open={dialog === 'assign'}
        onClose={() => setDialog(null)}
        bookingId={bookingId}
        currentStaffId={currentStaffId}
        staff={eligibleStaff}
      />

      <RescheduleDialog
        open={dialog === 'reschedule'}
        onClose={() => setDialog(null)}
        bookingId={bookingId}
        serviceId={serviceId}
        locationType={locationType}
      />

      <CancelDialog
        open={dialog === 'cancel'}
        onClose={() => setDialog(null)}
        bookingId={bookingId}
      />

      <ManualPaymentDialog
        open={dialog === 'payment'}
        onClose={() => setDialog(null)}
        bookingId={bookingId}
        amountKobo={amountKobo}
      />

      {refundable && (
        <RefundDialog
          open={dialog === 'refund'}
          onClose={() => setDialog(null)}
          payment={refundable}
        />
      )}
    </section>
  );
}

/* ── Status transition ────────────────────────────────────────────── */

function StatusButton({
  bookingId,
  status,
  label,
  variant = 'outline',
  icon: Icon,
}: {
  bookingId: string;
  status: string;
  label: string;
  variant?: 'outline' | 'accent';
  icon?: React.ComponentType<{ className?: string }>;
}) {
  const [state, formAction] = useActionState(adminUpdateStatusAction, INITIAL);

  useActionFeedback(state, { toastOnError: true });

  return (
    <form action={formAction}>
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="status" value={status} />
      <SubmitButton variant={variant} pendingLabel="Updating…">
        {Icon && <Icon className="size-4" />}
        {label}
      </SubmitButton>
    </form>
  );
}

/* ── Assign staff ─────────────────────────────────────────────────── */

function AssignDialog({
  open,
  onClose,
  bookingId,
  currentStaffId,
  staff,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  currentStaffId: string | null;
  staff: { id: string; name: string; title: string }[];
}) {
  const [state, formAction] = useActionState(adminAssignStaffAction, INITIAL);

  useActionFeedback(state, { onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign a care professional</DialogTitle>
          <DialogDescription>
            Only staff cleared to deliver this service are listed. The server re-checks that they
            are actually free at this time.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          {staff.length === 0 ? (
            <Alert variant="warning">
              No active staff member is assigned to this service yet. Assign the service to someone
              on the Staff page first.
            </Alert>
          ) : (
            <Field label="Staff member" required error={state.fieldErrors?.staffId?.[0]}>
              <select
                name="staffId"
                defaultValue={currentStaffId ?? ''}
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose a staff member</option>
                {staff.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name} — {LABELS.staffRole[member.title as keyof typeof LABELS.staffRole]}
                  </option>
                ))}
              </select>
            </Field>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton disabled={staff.length === 0} pendingLabel="Assigning…">
              Assign
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Reschedule ───────────────────────────────────────────────────── */

function RescheduleDialog({
  open,
  onClose,
  bookingId,
  serviceId,
  locationType,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  serviceId: string;
  locationType: LocationType;
}) {
  const [state, formAction] = useActionState(adminRescheduleAction, INITIAL);
  const [dateKey, setDateKey] = useState<string | null>(null);
  const [slot, setSlot] = useState<TimeSlot | null>(null);

  useActionFeedback(state, { onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Reschedule this appointment</DialogTitle>
          <DialogDescription>
            Availability is checked live, and the patient is notified of the new time.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="dateKey" value={dateKey ?? ''} />
          <input type="hidden" name="startTime" value={slot?.start ?? ''} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <BookingDatePicker
            selected={dateKey}
            maximumAdvanceDays={365}
            onSelect={(chosen) => {
              setDateKey(chosen);
              setSlot(null);
            }}
          />

          {dateKey && (
            <SlotPicker
              serviceId={serviceId}
              dateKey={dateKey}
              locationType={locationType}
              selected={slot?.start ?? null}
              onSelect={setSlot}
            />
          )}

          <Field label="Reason" error={state.fieldErrors?.reason?.[0]}>
            <Input name="reason" placeholder="Shared with the patient and recorded in the log." />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton disabled={!slot || !dateKey} pendingLabel="Rescheduling…">
              {slot && dateKey
                ? `Move to ${formatTimeLabel(slot.start)}`
                : 'Choose a new time'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Cancel ───────────────────────────────────────────────────────── */

function CancelDialog({
  open,
  onClose,
  bookingId,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
}) {
  const [state, formAction] = useActionState(adminCancelBookingAction, INITIAL);

  useActionFeedback(state, { onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this appointment?</DialogTitle>
          <DialogDescription>
            The slot is released and the patient is notified. Any refund is raised separately.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Field label="Reason" required error={state.fieldErrors?.reason?.[0]}>
            <Textarea name="reason" rows={3} required />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
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

/* ── Manual payment ───────────────────────────────────────────────── */

function ManualPaymentDialog({
  open,
  onClose,
  bookingId,
  amountKobo,
}: {
  open: boolean;
  onClose: () => void;
  bookingId: string;
  amountKobo: number;
}) {
  const [state, formAction] = useActionState(adminRecordManualPaymentAction, INITIAL);

  useActionFeedback(state, { onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a payment of {formatNaira(amountKobo)}</DialogTitle>
          <DialogDescription>
            Use this for money received outside the online gateways — a bank transfer, cash or a
            card machine at the visit. It confirms the appointment and issues a receipt.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="bookingId" value={bookingId} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Alert variant="warning">
            Only record a payment you have actually received and can evidence. Your name is
            attached to this entry in the audit log.
          </Alert>

          <Field label="How was it paid?" required error={state.fieldErrors?.method?.[0]}>
            <select
              name="method"
              defaultValue="bank_transfer"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="bank_transfer">Bank transfer</option>
              <option value="cash">Cash</option>
              <option value="pos">Card / POS terminal</option>
            </select>
          </Field>

          <Field
            label="Reference or note"
            description="Transfer reference, teller number, or who took the cash."
            error={state.fieldErrors?.note?.[0]}
          >
            <Input name="note" placeholder="GTB transfer ref 8827341" />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Recording…">
              Record {formatNaira(amountKobo)}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ── Refund ───────────────────────────────────────────────────────── */

function RefundDialog({
  open,
  onClose,
  payment,
}: {
  open: boolean;
  onClose: () => void;
  payment: PaymentSummary;
}) {
  const [state, formAction] = useActionState(requestRefundAction, INITIAL);
  const remaining = payment.amountPaidKobo - payment.refundedKobo;

  useActionFeedback(state, { onSuccess: onClose });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Request a refund</DialogTitle>
          <DialogDescription>
            Up to {formatNaira(remaining)} can still be refunded on {payment.reference}. The
            request goes to the refunds queue for approval before any money moves.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="paymentId" value={payment.id} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Field
            label="Amount (₦)"
            required
            description={`Maximum ${formatNaira(remaining)}.`}
            error={state.fieldErrors?.amount?.[0]}
          >
            <Input
              name="amount"
              type="number"
              min={1}
              max={remaining / 100}
              step={100}
              defaultValue={remaining / 100}
              required
            />
          </Field>

          <Field label="Reason" required error={state.fieldErrors?.reason?.[0]}>
            <Textarea
              name="reason"
              rows={3}
              placeholder="Cancelled within the free window, service not delivered…"
              required
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Requesting…">Request refund</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
