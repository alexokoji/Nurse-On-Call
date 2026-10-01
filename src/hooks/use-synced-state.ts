'use client';

import { useState } from 'react';

/**
 * Local state that re-initialises whenever an external value changes.
 *
 * This is React's documented "adjusting state when a prop changes" pattern:
 * comparing during render and calling setState there is cheaper and more
 * correct than an effect, because React re-runs the component immediately
 * without committing the stale value to the DOM first.
 *
 * Used for controlled inputs that mirror the URL (a search box reflecting
 * `?q=`) and for panels that reset when their subject changes.
 */
export function useSyncedState<T>(external: T): [T, (value: T) => void] {
  const [value, setValue] = useState(external);
  const [previous, setPrevious] = useState(external);

  if (external !== previous) {
    setPrevious(external);
    setValue(external);
  }

  return [value, setValue];
}

/**
 * Runs a reset when `token` changes — e.g. closing a drawer on navigation.
 *
 * Same render-phase technique as above, so it does not trigger the cascading
 * re-render that `useEffect` + `setState` would.
 */
export function useResetOnChange(token: string, reset: () => void) {
  const [previous, setPrevious] = useState(token);

  if (token !== previous) {
    setPrevious(token);
    reset();
  }
}
