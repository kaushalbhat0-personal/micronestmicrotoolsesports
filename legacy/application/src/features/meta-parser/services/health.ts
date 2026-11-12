/**
 * Meta-Parser freshness signals (pure, game-agnostic).
 *
 * Dota wiring: latestUpstreamDate = patch.json max date, lastIngestedDate =
 * newest stored Dota patch. Stale threshold mirrors the platform rule:
 * no successful ingestion for >10 days surfaces in health probes.
 */

export const META_PARSER_STALE_AFTER_DAYS = 10;

export interface FreshnessInput {
  readonly latestUpstreamDate: string | null;
  readonly lastIngestedDate: string | null;
  readonly nowIso: string;
}

export interface FreshnessAssessment {
  readonly stale: boolean;
  readonly daysBehindUpstream: number | null;
  readonly daysSinceIngest: number | null;
  readonly reason: string;
}

function daysBetween(fromIso: string, toIso: string): number | null {
  const from = Date.parse(fromIso);
  const to = Date.parse(toIso);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.max(0, Math.floor((to - from) / 86_400_000));
}

/** Assess ingestion freshness. Never throws. */
export function assessFreshness(input: FreshnessInput): FreshnessAssessment {
  const daysSinceIngest =
    input.lastIngestedDate !== null ? daysBetween(input.lastIngestedDate, input.nowIso) : null;
  const daysBehindUpstream =
    input.latestUpstreamDate !== null && input.lastIngestedDate !== null
      ? daysBetween(input.lastIngestedDate, input.latestUpstreamDate)
      : null;

  if (input.lastIngestedDate === null) {
    return { stale: true, daysBehindUpstream, daysSinceIngest, reason: "never-ingested" };
  }
  if (daysSinceIngest !== null && daysSinceIngest > META_PARSER_STALE_AFTER_DAYS) {
    return { stale: true, daysBehindUpstream, daysSinceIngest, reason: "stale-ingest" };
  }
  if (daysBehindUpstream !== null && daysBehindUpstream > META_PARSER_STALE_AFTER_DAYS) {
    return { stale: true, daysBehindUpstream, daysSinceIngest, reason: "upstream-ahead" };
  }
  return { stale: false, daysBehindUpstream, daysSinceIngest, reason: "fresh" };
}
