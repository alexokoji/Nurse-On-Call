'use client';

import { useActionState } from 'react';
import { saveRoleAction } from '../actions/people';
import { SubmitButton } from '@/components/forms/submit-button';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/misc';
import { Alert } from '@/components/ui/feedback';
import type { ActionResult } from '@/types';
import { useActionFeedback } from '@/hooks/use-action-feedback';
import { useSyncedState } from '@/hooks/use-synced-state';

const INITIAL: ActionResult = { ok: false };

interface PermissionGroup {
  label: string;
  permissions: { key: string; description: string }[];
}

/**
 * Permission matrix for one role.
 *
 * Selection is held in React state so the "select all in group" shortcuts
 * work, and the checked keys are submitted as repeated `permissions` fields.
 */
export function RolePermissionEditor({
  roleKey,
  roleName,
  description,
  granted,
  groups,
  canEdit,
}: {
  roleKey: string;
  roleName: string;
  description: string;
  granted: string[];
  groups: PermissionGroup[];
  canEdit: boolean;
}) {
  // Re-initialises when the server sends a different set after a save.
  const [selected, setSelected] = useSyncedState<Set<string>>(new Set(granted));
  const [state, formAction] = useActionState(saveRoleAction, INITIAL);

  useActionFeedback(state);

  const toggle = (permission: string) => {
    const next = new Set(selected);
    if (next.has(permission)) next.delete(permission);
    else next.add(permission);
    setSelected(next);
  };

  const toggleGroup = (group: PermissionGroup, on: boolean) => {
    const next = new Set(selected);
    for (const permission of group.permissions) {
      if (on) next.add(permission.key);
      else next.delete(permission.key);
    }
    setSelected(next);
  };

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="key" value={roleKey} />
      <input type="hidden" name="name" value={roleName} />
      <input type="hidden" name="description" value={description} />
      {[...selected].map((permission) => (
        <input key={permission} type="hidden" name="permissions" value={permission} />
      ))}

      {state.message && !state.ok && <Alert variant="error">{state.message}</Alert>}

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {groups.map((group) => {
          const groupKeys = group.permissions.map((permission) => permission.key);
          const allOn = groupKeys.every((key) => selected.has(key));

          return (
            <fieldset key={group.label} className="rounded-lg border border-border p-4">
              <div className="flex items-center justify-between gap-2">
                <legend className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </legend>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group, !allOn)}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    {allOn ? 'Clear all' : 'Select all'}
                  </button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {group.permissions.map((permission) => (
                  <label
                    key={permission.key}
                    className="flex cursor-pointer items-start gap-2.5 rounded p-1 hover:bg-secondary/60"
                  >
                    <Checkbox
                      checked={selected.has(permission.key)}
                      onCheckedChange={() => toggle(permission.key)}
                      disabled={!canEdit}
                      className="mt-0.5"
                      aria-label={permission.description}
                    />
                    <span className="min-w-0">
                      <span className="block text-xs text-navy-800">{permission.description}</span>
                      <span className="block font-mono text-[10px] text-muted-foreground">
                        {permission.key}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}
      </div>

      {canEdit && (
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">
            {selected.size} permission{selected.size === 1 ? '' : 's'} selected
          </p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setSelected(new Set(granted))}>
              Reset
            </Button>
            <SubmitButton pendingLabel="Saving…">Save permissions</SubmitButton>
          </div>
        </div>
      )}
    </form>
  );
}
