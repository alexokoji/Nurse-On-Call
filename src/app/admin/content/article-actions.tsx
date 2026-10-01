'use client';

import { useActionState, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteArticleAction } from '../actions/services';
import { Button } from '@/components/ui/button';
import { SubmitButton } from '@/components/forms/submit-button';
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

export function DeleteArticleButton({
  articleId,
  title,
}: {
  articleId: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(deleteArticleAction, INITIAL);

  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${title}`}
        className="text-destructive hover:bg-red-50"
      >
        <Trash2 className="size-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this article?</DialogTitle>
            <DialogDescription>
              “{title}” will be removed permanently, along with its public URL. If you only want it
              off the site, set it back to draft instead.
            </DialogDescription>
          </DialogHeader>

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Keep article
            </Button>
            <form action={formAction}>
              <input type="hidden" name="articleId" value={articleId} />
              <SubmitButton variant="destructive" pendingLabel="Deleting…">
                Delete permanently
              </SubmitButton>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
