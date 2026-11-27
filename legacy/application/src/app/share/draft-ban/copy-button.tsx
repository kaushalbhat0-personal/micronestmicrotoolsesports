"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Draft & Ban — Public share copy button.
 * Mirrors the internal ResultCard clipboard/fallback pattern.
 * Receives pre-built official result text (public projection only, no notes).
 */
export function ShareCopyButton({ text }: { text: string }) {
  const [copied, setCopied] = React.useState(false);

  async function copyResult() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Button onClick={copyResult} className="min-h-[44px]" aria-label="Copy result as text">
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
        {copied ? "Copied" : "Copy result"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Result copied." : null}
      </span>
    </>
  );
}
