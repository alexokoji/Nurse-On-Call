'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { Archive, ExternalLink, Eye, EyeOff, MoreHorizontal, Pencil } from 'lucide-react';
import { setServiceStatusAction } from '../actions/services';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

export function ServiceRowActions({
  serviceId,
  slug,
  status,
  canEdit,
  canDelete,
}: {
  serviceId: string;
  slug: string;
  status: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const [state, formAction] = useActionState(setServiceStatusAction, INITIAL);

  useActionFeedback(state, { toastOnError: true });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Service actions">
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-52">
        {canEdit && (
          <DropdownMenuItem asChild>
            <Link href={`/admin/services/${serviceId}`}>
              <Pencil />
              Edit service
            </Link>
          </DropdownMenuItem>
        )}

        {status === 'published' && (
          <DropdownMenuItem asChild>
            <Link href={`/services/${slug}`} target="_blank">
              <ExternalLink />
              View public page
            </Link>
          </DropdownMenuItem>
        )}

        {canEdit && (
          <>
            <DropdownMenuSeparator />

            {status !== 'published' ? (
              <DropdownMenuItem asChild>
                <form action={formAction} className="contents">
                  <input type="hidden" name="serviceId" value={serviceId} />
                  <input type="hidden" name="status" value="published" />
                  <button type="submit" className="flex w-full items-center gap-2">
                    <Eye />
                    Publish
                  </button>
                </form>
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem asChild>
                <form action={formAction} className="contents">
                  <input type="hidden" name="serviceId" value={serviceId} />
                  <input type="hidden" name="status" value="draft" />
                  <button type="submit" className="flex w-full items-center gap-2">
                    <EyeOff />
                    Unpublish
                  </button>
                </form>
              </DropdownMenuItem>
            )}
          </>
        )}

        {canDelete && status !== 'archived' && (
          <DropdownMenuItem asChild destructive>
            <form action={formAction} className="contents">
              <input type="hidden" name="serviceId" value={serviceId} />
              <input type="hidden" name="status" value="archived" />
              <button type="submit" className="flex w-full items-center gap-2">
                <Archive />
                Archive
              </button>
            </form>
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
