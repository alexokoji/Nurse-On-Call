'use client';

import { useFormStatus } from 'react-dom';
import { Button, type ButtonProps } from '@/components/ui/button';

/**
 * Submit button wired to the enclosing form's pending state.
 *
 * Using `useFormStatus` rather than local state means the disabled/loading
 * treatment is automatic for every server-action form — nobody has to
 * remember to add it, and double submissions are blocked by default.
 */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: ButtonProps & { pendingLabel?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}
