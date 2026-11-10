"use client";

import * as React from "react";
import { Megaphone } from "lucide-react";
import { parseLabSharedResultFromSearch, type LabSharedResult } from "../share-result-url";

/**
 * Shared-result recipient state — display-only challenge hint.
 *
 * Reads `?result=S-T` client-side after mount (first render is null so
 * SSR and the first client paint agree — hydration-safe). The parsed
 * value never flows into scoring, answered counts, or completion state;
 * callers render it in `SharedResultBanner` above the untouched game.
 * `dismiss` clears the query with history.replaceState (no reload) so a
 * subsequent share emits the recipient's own run, never a forwarded one.
 */

export function useSharedLabResult(expectedTotal: number): {
  readonly shared: LabSharedResult | null;
  readonly dismiss: () => void;
} {
  const [shared, setShared] = React.useState<LabSharedResult | null>(null);

  React.useEffect(() => {
    try {
      setShared(parseLabSharedResultFromSearch(window.location.search, expectedTotal));
    } catch {
      setShared(null);
    }
  }, [expectedTotal]);

  const dismiss = React.useCallback(() => {
    setShared(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("result");
      window.history.replaceState({}, "", url.toString());
    } catch {
      // History unavailable — banner is already hidden locally.
    }
  }, []);

  return { shared, dismiss };
}

export interface SharedResultBannerProps {
  readonly gameName: string;
  readonly shared: LabSharedResult;
  readonly resultNoun?: string;
  readonly onDismiss: () => void;
}

/**
 * Dismissible challenge banner for recipients of a shared result link.
 * Purely informational: the game beneath it always starts fresh and
 * independent of the shared score.
 */
export function SharedResultBanner({
  gameName,
  shared,
  resultNoun,
  onDismiss,
}: SharedResultBannerProps) {
  const noun = resultNoun ?? "good reads";
  return (
    <section
      aria-label={`Shared ${gameName} result`}
      aria-live="polite"
      className="border-primary/25 bg-primary/[0.06] rounded-[12px] border p-4 text-sm leading-relaxed"
    >
      <p className="text-primary flex items-center gap-2 font-mono text-[11px] tracking-widest">
        <Megaphone className="h-3.5 w-3.5" aria-hidden /> SHARED RESULT
      </p>
      <p className="mt-2 font-medium">
        Someone shared {shared.score}/{shared.total} {noun} on {gameName}. Can you make the call?
      </p>
      <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
        This is their claimed result, not a verified score. Your run below starts fresh — nothing is
        imported.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <button
          type="button"
          onClick={onDismiss}
          aria-label={`Start your own ${gameName} run`}
          className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full px-6 text-sm font-medium hover:bg-[var(--color-primary-hover)] focus-visible:ring-2 focus-visible:outline-none"
        >
          Start your run
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss shared result"
          className="border-border bg-card hover:bg-muted focus-visible:ring-ring inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full border px-6 text-sm font-medium focus-visible:ring-2 focus-visible:outline-none"
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
