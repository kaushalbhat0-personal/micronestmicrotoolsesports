import * as React from "react";
import { ExternalLink } from "lucide-react";
import type { ResolvedGameProvenance } from "../_lib/game-provenance";

/**
 * Facts provenance block (server-rendered, no client JS).
 *
 * Fully data-driven: canonical source + structured dataset attribution come
 * from the caller (catalog `expected_fields.provenance` via
 * `resolveGameProvenance`). No game literals live here.
 */
export function Provenance({
  sourceUrl,
  patchVersion,
  gameName,
  provenance,
  revision = null,
  compact = false,
}: {
  sourceUrl: string;
  patchVersion: string;
  gameName: string;
  provenance: ResolvedGameProvenance;
  /**
   * Re-publication count. Secondary source detail only — never a primary
   * product fact. Null hides it entirely.
   */
  revision?: number | null;
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
        Official patch notes:{" "}
        <a
          href={sourceUrl}
          target="_blank"
          rel="noopener noreferrer external"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {provenance.sourceLabel} Patch {patchVersion}
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      </p>
      {provenance.datasetLabel !== null ? (
        <p className="mt-1">
          Data:{" "}
          {provenance.datasetUrl !== null ? (
            <a
              href={provenance.datasetUrl}
              target="_blank"
              rel="noopener noreferrer external"
              className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {provenance.datasetLabel}
              <ExternalLink className="h-3 w-3" aria-hidden />
            </a>
          ) : (
            <span className="font-medium text-primary">{provenance.datasetLabel}</span>
          )}{" "}
          {provenance.license !== null ? `(${provenance.license}).` : `for ${gameName}.`}
        </p>
      ) : null}
      {typeof revision === "number" && !compact ? (
        <p className="mt-2 text-xs">Source details · update {revision}</p>
      ) : null}
    </section>
  );
}
