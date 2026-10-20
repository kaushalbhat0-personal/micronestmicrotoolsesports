"use client";

import * as React from "react";
import { Check, Link2, MessageCircle, Share2 } from "lucide-react";
import { buildWhatsAppShareUrl } from "@/lib/share/whatsapp";
import { buildLabShareMessage, isShareAbort } from "../share-message";

/**
 * ShareRow — completion-screen share controls for BGMI Lab games.
 *
 * Props-only and game-agnostic: consumes score/total/shareText/canonicalUrl,
 * never scoring internals. Renders inside the game result (within
 * AdSafeGameLayout): native Share when available, Copy link with persistent
 * success state, and a direct WhatsApp deep link. Fully client-side —
 * no network calls, no storage, no analytics, no accounts.
 */

export interface ShareRowProps {
  readonly gameName: string;
  readonly score: number;
  readonly total: number;
  readonly shareText: string;
  readonly canonicalUrl: string;
  /**
   * Result noun forwarded to buildLabShareMessage (e.g. Rotation Replay
   * passes "lined-up reads"). Optional — defaults to "good reads".
   * No game-specific branching lives here; callers supply their noun.
   */
  readonly resultNoun?: string;
}

const BUTTON =
  "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function ShareRow({ gameName, score, total, shareText, canonicalUrl, resultNoun }: ShareRowProps) {
  const [mounted, setMounted] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [copyFailed, setCopyFailed] = React.useState(false);
  const [shareUnavailable, setShareUnavailable] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const message = buildLabShareMessage(
    resultNoun === undefined
      ? { gameName, score, total, shareText, canonicalUrl }
      : { gameName, score, total, shareText, canonicalUrl, resultNoun }
  );
  const canNativeShare =
    mounted && typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function nativeShare() {
    if (!canNativeShare) return;
    try {
      await navigator.share({ title: `${gameName} — MicroNest BGMI Lab`, text: message, url: canonicalUrl });
    } catch (error) {
      if (isShareAbort(error)) return;
      setShareUnavailable(true);
    }
  }

  async function copyLink() {
    setCopyFailed(false);
    try {
      await navigator.clipboard.writeText(canonicalUrl);
      setCopied(true);
    } catch {
      setCopyFailed(true);
    }
  }

  return (
    <section aria-label={`Share your ${gameName} result`} className="rounded-[12px] border border-border bg-surface-muted/40 p-4">
      <p className="font-mono text-[11px] tracking-widest text-muted-foreground">SHARE YOUR RESULT</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        {canNativeShare ? (
          <button type="button" onClick={nativeShare} aria-label={`Share your ${gameName} result`} className={`${BUTTON} bg-primary text-primary-foreground hover:bg-[var(--color-primary-hover)]`}>
            <Share2 className="h-4 w-4" aria-hidden /> Share
          </button>
        ) : null}
        <button
          type="button"
          onClick={copyLink}
          aria-label={`Copy ${gameName} link`}
          aria-live="polite"
          className={`${BUTTON} border border-border bg-card hover:bg-muted`}
        >
          {copied ? <Check className="h-4 w-4" aria-hidden /> : <Link2 className="h-4 w-4" aria-hidden />}
          {copied ? "Link copied" : "Copy link"}
        </button>
        <a
          href={buildWhatsAppShareUrl(message)}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Share ${gameName} result on WhatsApp`}
          className={`${BUTTON} border border-border bg-card hover:bg-muted`}
        >
          <MessageCircle className="h-4 w-4" aria-hidden /> WhatsApp
        </a>
      </div>
      {shareUnavailable ? (
        <p className="mt-2 text-xs text-muted-foreground">Sharing isn&apos;t available here — copy the link instead.</p>
      ) : null}
      {copyFailed ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Copy didn&apos;t work in this browser — copy this link manually:{" "}
          <span className="break-all font-mono">{canonicalUrl}</span>
        </p>
      ) : null}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        The link opens {gameName} — no account, nothing stored. Your score stays on this device.
      </p>
    </section>
  );
}
