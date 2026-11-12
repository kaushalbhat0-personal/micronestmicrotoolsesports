"use client";

import * as React from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { PrizeSplitterCalculator } from "./prize-splitter-calculator";

/**
 * PublicSplitterDemo — anonymous hands-on demo for the marketing page.
 *
 * Renders the canonical `PrizeSplitterCalculator` verbatim (same validation,
 * same `calculateSplit` domain logic, same CSV/copy/share primitives — the
 * share links target the public `/share/prize-splitter` route). Fully
 * ephemeral: no account, nothing stored server-side, no access grant.
 * Page refresh resets the demo.
 *
 * The signup CTA sits after delivered value and only offers saving/sharing
 * with an account — it never gates the calculation.
 */
export function PublicSplitterDemo() {
  // Mount guard: the canonical calculator intentionally renders its share
  // block SSR-empty (`typeof window` guard) and fills it on the client.
  // Rendering the calculator only after mount keeps server and hydration
  // output identical — no hydration mismatch — while the skeleton holds
  // layout stable. The shared calculator itself is untouched.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    setMounted(true);
  }, []);
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card">
          <Calculator className="h-4 w-4 text-primary" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">Try it now — no signup needed</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Enter a prize pool, choose how to split it, and see every placement&apos;s payout instantly.
            This demo runs entirely in your browser — nothing is saved.
          </p>
        </div>
      </div>
      {mounted ? (
        <PrizeSplitterCalculator />
      ) : (
        <div className="space-y-3" aria-busy="true" aria-label="Loading interactive demo">
          <div className="h-9 w-48 animate-pulse rounded-full bg-surface-muted" />
          <div className="h-64 animate-pulse rounded-[12px] bg-surface-muted/60" />
        </div>
      )}
      <p className="rounded-[12px] border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        Want to keep this result handy?{" "}
        <Link
          href="/signup"
          aria-label="Create a free account to save or share your result"
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Create a free account
        </Link>{" "}
        to save or share your splits.
      </p>
    </div>
  );
}
