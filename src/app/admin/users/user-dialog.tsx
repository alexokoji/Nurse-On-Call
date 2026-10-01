'use client';

import { useActionState, useState } from 'react';
import { Pencil, UserPlus } from 'lucide-react';
import { saveAdminUserAction } from '../actions/people';
import { Field } from '@/components/forms/field';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert } from '@/components/ui/feedback';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { LABELS, USER_STATUSES } from '@/types';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';

const INITIAL: ActionResult = { ok: false };

interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
}

export function AdminUserDialog({
  user,
  canCreateSuperAdmin,
}: {
  user?: AdminUser;
  canCreateSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction] = useActionState(saveAdminUserAction, INITIAL);

  useActionFeedback(state, { onSuccess: () => setOpen(false) });

  const roles = (['admin', 'operations_manager', 'finance'] as const).slice();
  const allRoles = canCreateSuperAdmin ? (['super_admin', ...roles] as const) : roles;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {user ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${user.name}`}>
            <Pencil className="size-4" />
          </Button>
        ) : (
          <Button>
            <UserPlus className="size-4" />
            New user
          </Button>
        )}
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? `Edit ${user.name}` : 'Create an admin user'}</DialogTitle>
          <DialogDescription>
            Their role decides which sections of this panel they can open and what they can change.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4">
          {user && <input type="hidden" name="userId" value={user.id} />}

          {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

          <Field label="Full name" required error={state.fieldErrors?.name?.[0]}>
            <Input name="name" defaultValue={user?.name} required />
          </Field>

          <Field label="Email address" required error={state.fieldErrors?.email?.[0]}>
            <Input name="email" type="email" defaultValue={user?.email} required />
          </Field>

          <Field label="Phone number" error={state.fieldErrors?.phone?.[0]}>
            <Input name="phone" type="tel" defaultValue={user?.phone} />
          </Field>

          <Field
            label={user ? 'New password' : 'Initial password'}
            required={!user}
            description={
              user
                ? 'Leave blank to keep the current password. Changing it signs them out everywhere.'
                : '8+ characters with upper and lower case and a number.'
            }
            error={state.fieldErrors?.password?.[0]}
          >
            <Input name="password" type="password" autoComplete="new-password" required={!user} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Role" required error={state.fieldErrors?.role?.[0]}>
              <select
                name="role"
                defaultValue={user?.role ?? 'admin'}
                required
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {allRoles.map((role) => (
                  <option key={role} value={role}>
                    {LABELS.userRole[role]}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" error={state.fieldErrors?.status?.[0]}>
              <select
                name="status"
                defaultValue={user?.status ?? 'active'}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm capitalize shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {USER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <SubmitButton pendingLabel="Saving…">
              {user ? 'Save changes' : 'Create user'}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
