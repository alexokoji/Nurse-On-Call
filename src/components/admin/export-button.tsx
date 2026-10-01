'use client';

import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Exports the *currently filtered* view, not the whole table — the current
 * query string is forwarded to the export endpoint so what you download
 * matches what you were looking at.
 */
export function ExportButton({
  resource,
  label = 'Export',
}: {
  resource: 'appointments' | 'payments' | 'patients' | 'report';
  label?: string;
}) {
  const searchParams = useSearchParams();

  const params = new URLSearchParams(searchParams.toString());
  params.set('resource', resource);
  params.delete('page');

  return (
    <Button asChild variant="outline">
      {/* A real link, so the browser handles the download natively. */}
      <a href={`/api/admin/export?${params.toString()}`} download>
        <Download className="size-4" />
        {label}
      </a>
    </Button>
  );
}
