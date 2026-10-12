"use client";

import * as React from "react";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Prize Payout Tracker — dashboard share-link control.
 * Copies the existing public URL for the tracker's share token.
 * Never generates tokens: the token already exists on the published row.
 */
export function PayoutShareLinkButton({ shareToken }: { shareToken: string }) {
  const [copied, setCopied] = React.useState(false);

  function shareUrl(): string {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/share/payout/${shareToken}`;
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
      <Button type="button" variant="outline" onClick={copyLink} className="min-h-[44px]" aria-label="Copy public payout link">
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        {copied ? "Link copied" : "Copy public link"}
      </Button>
      <span role="status" aria-live="polite" className="sr-only">
        {copied ? "Public payout link copied." : null}
      </span>
    </>
  );
}
