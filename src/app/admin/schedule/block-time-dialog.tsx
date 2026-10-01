'use client';

import { useActionState, useState } from 'react';
import { saveBlockedScheduleAction } from '../actions/people';
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
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

/**
 * Blocks time out of the availability engine — leave, a public holiday, a
 * training afternoon. Leaving the times empty blocks the whole day, and
 * leaving the staff member empty closes the clinic for everyone.
 */
export function BlockTimeDialog({
  open,
  onOpenChange,
  staff,
  defaultStaffId,
  defaultDateKey,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staff: { id: string; name: string }[];
  defaultStaffId: string | null;
  defaultDateKey: string;
}) {
  const [state, formAction] = useActionState(saveBlockedScheduleAction, INITIAL);
  const [wholeDay, setWholeDay] = useState(true);

  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Block time</DialogTitle>
          <DialogDescription>
            Blocked time is removed from availability immediately, so patients cannot book it.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Field
            label="Who does this affect?"
            description="Leave as “whole organisation” for a public holiday or clinic closure."
          >
            <select
              name="staffId"
              defaultValue={defaultStaffId ?? ''}
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Whole organisation</option>
              {staff.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Type">
            <select
              name="type"
              defaultValue="leave"
              className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="leave">Leave</option>
              <option value="holiday">Public holiday</option>
              <option value="training">Training</option>
              <option value="blocked">Other blocked time</option>
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="From" required error={state.fieldErrors?.startDateKey?.[0]}>
              <Input name="startDateKey" type="date" defaultValue={defaultDateKey} required />
            </Field>
            <Field label="To" required error={state.fieldErrors?.endDateKey?.[0]}>
              <Input name="endDateKey" type="date" defaultValue={defaultDateKey} required />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={wholeDay}
              onChange={(event) => setWholeDay(event.target.checked)}
              className="size-4 rounded border-input"
            />
            Block the whole day
          </label>

          {!wholeDay && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Start time" error={state.fieldErrors?.startTime?.[0]}>
                <Input name="startTime" type="time" defaultValue="09:00" />
              </Field>
              <Field label="End time" error={state.fieldErrors?.endTime?.[0]}>
                <Input name="endTime" type="time" defaultValue="13:00" />
              </Field>
            </div>
          )}

          <Field label="Reason" error={state.fieldErrors?.reason?.[0]}>
            <Textarea
              name="reason"
              rows={2}
              placeholder="Annual leave, public holiday, clinical training…"
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Blocking…">Block this time</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
