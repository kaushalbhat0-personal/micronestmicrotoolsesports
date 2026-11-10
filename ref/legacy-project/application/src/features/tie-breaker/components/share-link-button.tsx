"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Tie-Breaker Resolver — Dashboard share-link control.
 * Copies the existing public URL for the locked record's share token.
 * Never generates tokens: the token already exists on the locked row.
 */
export function ShareLinkButton({ shareToken }: { shareToken: string }) {
  const [copied, setCopied] = React.useState(false);

  function shareUrl(): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/share/tie-breaker/${shareToken}`;
  }

  async function copyLink() {
    const url = shareUrl();
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
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
      <Button type="button" variant="outline" onClick={copyLink} className="min-h-[44px]" aria-label="Copy share link">
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        {copied ? "Link copied" : "Copy share link"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Share link copied." : null}
      </span>
    </>
  );
}
