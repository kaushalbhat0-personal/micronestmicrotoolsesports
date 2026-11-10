"use client";

import { Button } from "@/components/ui/button";

export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} className="min-h-[44px]" aria-label="Print">
      Print / Save PDF
    </Button>
  );
}
