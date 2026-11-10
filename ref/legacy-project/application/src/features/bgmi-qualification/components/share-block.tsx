"use client";

import * as React from "react";
import { Check, Link2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildShareUrl } from "../services/share";
import { buildQualificationWhatsAppMessage, buildQualificationWhatsAppUrl } from "../services/whatsapp";
import type { QualificationShareState } from "../types";
import type { WhatsAppCheckInput } from "../services/whatsapp";

interface ShareBlockProps {
  readonly state: QualificationShareState;
  readonly check: WhatsAppCheckInput;
}

/**
 * Client-only share affordances (clipboard + wa.me need window).
 * Rendered after mount so SSR and first client paint stay identical.
 */
export function ShareBlock({ state, check }: ShareBlockProps) {
  const [mounted, setMounted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  React.useEffect(() => {
    if (!copied) return;
    const t = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(t);
  }, [copied]);

  if (!mounted) return null;
  const shareUrl = buildShareUrl(`${window.location.origin}/share/bgmi-qualification`, state);
  const waUrl = buildQualificationWhatsAppUrl(check, shareUrl);

  const copyLink = async () => {
    try {
      await window.navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      window.prompt("Copy this link:", shareUrl);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" onClick={copyLink} aria-live="polite">
        {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
        {copied ? "Link copied" : "Copy share link"}
      </Button>
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 min-h-[44px] items-center justify-center gap-2 rounded-full border border-border bg-card px-6 text-[14px] font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <MessageCircle className="h-4 w-4" aria-hidden />
        Share on WhatsApp
      </a>
      <span className="w-full text-xs text-muted-foreground">
        The link reopens this exact check — no account, nothing stored. Message preview:{" "}
        <span className="font-mono">{buildQualificationWhatsAppMessage(check, shareUrl).split("\n")[0]}</span>
      </span>
    </div>
  );
}
