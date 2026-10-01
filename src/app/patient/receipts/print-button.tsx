'use client';

import { Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Uses the browser's own print dialog rather than generating a PDF
 * server-side: "Save as PDF" is available in every modern browser's print
 * flow, so a PDF library would add weight for a capability the user already
 * has. The `no-print` utility in globals.css hides the app chrome.
 */
export function PrintButton() {
  return (
    <Button variant="outline" onClick={() => window.print()} className="no-print">
      <Printer className="size-4" />
      Print / save as PDF
    </Button>
  );
}
