import { ExternalLink } from "lucide-react";

/**
 * Facts provenance block (server-rendered, no client JS).
 *
 * Two distinct attributions, never conflated:
 * - Canonical patch source: Valve / Dota 2 (per-patch official page).
 * - Structured dataset: OpenDota dotaconstants (MIT License,
 *   Copyright (c) 2017 The OpenDota Project — verified against the upstream
 *   LICENSE at github.com/odota/dotaconstants during IMPL-02).
 */

const DOTACONSTANTS_REPO_URL = "https://github.com/odota/dotaconstants";

export function Provenance({
  sourceUrl,
  patchVersion,
  compact = false,
}: {
  sourceUrl: string;
  patchVersion: string;
  compact?: boolean;
}) {
  return (
    <section
      aria-label="Source attribution"
      className={
        compact
          ? "text-xs leading-relaxed text-muted-foreground"
          : "rounded-[16px] border border-border bg-card p-5 text-sm leading-relaxed text-muted-foreground"
      }
    >
      {!compact && <h2 className="text-sm font-semibold text-foreground">Sources</h2>}
      <p className={compact ? undefined : "mt-2"}>
        Canonical patch source:{" "}
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer external"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Valve — Dota 2 Patch {patchVersion}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </p>
      <p className="mt-1">
        Structured dataset:{" "}
        <a
          href={DOTACONSTANTS_REPO_URL}
          target="_blank"
          rel="noopener noreferrer external"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          OpenDota dotaconstants
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>{" "}
        (MIT License, © 2017 The OpenDota Project).
      </p>
    </section>
  );
}
