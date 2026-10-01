'use client';

import { useActionState, useState } from 'react';
import { Check, EyeOff, MessageSquare, MoreHorizontal, Trash2 } from 'lucide-react';
import { moderateReviewAction, respondToReviewAction } from '../actions/moderation';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/input';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Alert } from '@/components/ui/feedback';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import type { ActionResult, ReviewStatus } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

export function ReviewActions({
  reviewId,
  status,
  hasResponse,
}: {
  reviewId: string;
  status: ReviewStatus;
  hasResponse: boolean;
}) {
  const [moderateState, moderateAction] = useActionState(moderateReviewAction, INITIAL);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [respondOpen, setRespondOpen] = useState(false);

  useActionFeedback(moderateState, { onSuccess: () => setDeleteOpen(false) });

  return (
    <>
      <div className="flex items-center gap-1.5">
        {/* The common action is a single click, not buried in the menu. */}
        {status !== 'approved' && (
          <form action={moderateAction}>
            <input type="hidden" name="reviewId" value={reviewId} />
            <input type="hidden" name="action" value="approve" />
            <SubmitButton size="sm" variant="outline" pendingLabel="Approving…">
              <Check className="size-3.5" />
              Approve
            </SubmitButton>
          </form>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Review actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onSelect={() => setRespondOpen(true)}>
              <MessageSquare />
              {hasResponse ? 'Edit response' : 'Add response'}
            </DropdownMenuItem>

            {status !== 'hidden' && (
              <DropdownMenuItem asChild>
                <form action={moderateAction} className="contents">
                  <input type="hidden" name="reviewId" value={reviewId} />
                  <input type="hidden" name="action" value="hide" />
                  <button type="submit" className="flex w-full items-center gap-2">
                    <EyeOff />
                    Hide from site
                  </button>
                </form>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />

            <DropdownMenuItem destructive onSelect={() => setDeleteOpen(true)}>
              <Trash2 />
              Delete permanently
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Delete confirmation — this one is irreversible. */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this review?</DialogTitle>
            <DialogDescription>
              The review is removed permanently and the service rating is recalculated. If you only
              want it off the public site, hide it instead.
            </DialogDescription>
          </DialogHeader>

          {moderateState.message && !moderateState.ok && (
            <Alert variant="error">{moderateState.message}</Alert>
          )}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setDeleteOpen(false)}>
              Keep review
            </Button>
            <form action={moderateAction}>
              <input type="hidden" name="reviewId" value={reviewId} />
              <input type="hidden" name="action" value="delete" />
              <SubmitButton variant="destructive" pendingLabel="Deleting…">
                Delete permanently
              </SubmitButton>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <RespondDialog reviewId={reviewId} open={respondOpen} onOpenChange={setRespondOpen} />
    </>
  );
}

function RespondDialog({
  reviewId,
  open,
  onOpenChange,
}: {
  reviewId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction] = useActionState(respondToReviewAction, INITIAL);

  useActionFeedback(state, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Respond to this review</DialogTitle>
          <DialogDescription>
            Your reply is shown publicly beneath the review once it is approved.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="reviewId" value={reviewId} />

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Field label="Your response" required error={state.fieldErrors?.response?.[0]}>
            <Textarea
              name="response"
              rows={4}
              placeholder="Thank the patient, address the point specifically, and say what changes."
              required
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Publishing…">Publish response</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
