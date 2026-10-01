'use client';

import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { ActionResult } from '@/types';

/**
 * Reacts to a server action finishing: shows a toast, and optionally closes a
 * dialog or resets a form.
 *
 * Every admin and patient form needs this, so it lives in one place rather
 * than being re-implemented (slightly differently) in twenty components.
 *
 * Two details matter:
 *
 *  - It fires only when the result object actually changes identity, which
 *    `useActionState` guarantees per submission. A ref guards against a
 *    re-render replaying the same outcome twice.
 *
 *  - `react-hooks/set-state-in-effect` is disabled for the callback line
 *    below. Closing a dialog in response to a completed server round-trip is
 *    the "synchronise with an external system" case the rule exempts — the
 *    external system being the server. There is no render loop here: the
 *    effect depends on the action result, which only changes on submit.
 */
export function useActionFeedback<T>(
  state: ActionResult<T>,
  options: {
    /** Runs after a successful action — close a dialog, reset a form, navigate. */
    onSuccess?: (state: ActionResult<T>) => void;
    /** Overrides the success toast. Pass null to suppress it entirely. */
    successMessage?: string | null;
    /** Show failures as a toast too. Off by default: most forms render an inline Alert. */
    toastOnError?: boolean;
  } = {},
) {
  const { onSuccess, successMessage, toastOnError = false } = options;

  // Holds the latest callback without making it an effect dependency, which
  // would re-run the effect whenever a caller passes an inline arrow.
  // Assigned inside an effect rather than during render, as refs require.
  const onSuccessRef = useRef(onSuccess);
  useEffect(() => {
    onSuccessRef.current = onSuccess;
  });

  const lastHandled = useRef<ActionResult<T> | null>(null);

  useEffect(() => {
    // The initial state is not the result of a submission.
    if (state === lastHandled.current) return;
    if (!state.ok && !state.message) return;

    lastHandled.current = state;

    if (state.ok) {
      if (successMessage !== null) {
        toast.success(successMessage ?? state.message ?? 'Saved.');
      }
      onSuccessRef.current?.(state);
      return;
    }

    if (toastOnError && state.message) toast.error(state.message);
  }, [state, successMessage, toastOnError]);
}
