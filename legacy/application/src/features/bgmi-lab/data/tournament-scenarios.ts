import type { PublishedStageDetail } from "@/features/bgmi-tournaments/repositories/reads";

/**
 * BGMI Lab tournament scenario adapter — read-only boundary.
 *
 * Tournament Hub owns tournament truth; Lab experiences consume
 * scenario-shaped facts through this module. The adapter is pure:
 * it maps an existing `PublishedStageDetail` (loaded via the Hub's own
 * public readers, all `published = true` rows) into a small scenario
 * object. It performs no Supabase access, no ingestion, no mutation —
 * only `import type` coupling to the Hub, erased at compile time.
 *
 * Completeness gate: only genuinely completed, published match data
 * becomes a scenario. Anything incomplete returns null — the adapter
 * never invents missing values. Result facts (placement, finishes,
 * points) are preserved; intentions, causality, and IGL reasoning are
 * not present in the source and are never fabricated (no such fields).
 */

export interface TournamentScenarioTeam {
  readonly teamCanonical: string;
  readonly displayName: string;
  readonly placement: number;
  readonly finishes: number;
  readonly totalPoints: number;
}

export interface TournamentScenario {
  readonly kind: "tournament-derived";
  readonly tournament: { readonly slug: string; readonly name: string };
  readonly stage: { readonly slug: string; readonly name: string };
  /** Identifiers matching the registry `scenarioRef` shape. */
  readonly ref: { readonly tournamentSlug: string; readonly stageSlug: string; readonly matchId: string };
  readonly match: {
    readonly number: number;
    readonly mapName: string;
    readonly scheduledAt: string | null;
    readonly vodUrl: string | null;
  };
  /** Placement-ordered result facts. No intentions, no causality. */
  readonly results: readonly TournamentScenarioTeam[];
  readonly source: {
    readonly tournamentRevision: number | null;
    readonly stageRevision: number | null;
    readonly publishedAt: string | null;
    readonly sourceUrl: string | null;
  };
  /** Existing canonical Hub routes for attribution links. No new routes. */
  readonly links: { readonly tournamentHref: string; readonly stageHref: string };
}

/**
 * Build a scenario from one published match. Returns null when the match
 * is missing, not completed, or lacks the minimum facts (map + results) —
 * callers must skip, never fill in.
 */
export function buildMatchScenario(
  detail: PublishedStageDetail,
  matchNumber: number
): TournamentScenario | null {
  const match = detail.matches.find((m) => m.matchNumber === matchNumber);
  if (!match) return null;
  if (match.status !== "completed") return null;
  if (!match.mapName || match.mapName.trim().length === 0) return null;
  if (match.results.length === 0) return null;
  for (const result of match.results) {
    if (!result.teamCanonical || result.placement < 1) return null;
  }
  const results = [...match.results]
    .sort((a, b) => a.placement - b.placement)
    .map((r) => ({
      teamCanonical: r.teamCanonical,
      displayName: r.displayName,
      placement: r.placement,
      finishes: r.finishes,
      totalPoints: r.totalPoints,
    }));
  return {
    kind: "tournament-derived",
    tournament: { slug: detail.tournament.slug, name: detail.tournament.name },
    stage: { slug: detail.stage.slug, name: detail.stage.name },
    ref: {
      tournamentSlug: detail.tournament.slug,
      stageSlug: detail.stage.slug,
      matchId: `match-${match.matchNumber}`,
    },
    match: {
      number: match.matchNumber,
      mapName: match.mapName,
      scheduledAt: match.scheduledAt,
      vodUrl: match.vodUrl,
    },
    results,
    source: {
      tournamentRevision: detail.tournament.sourceRevision,
      stageRevision: detail.stage.sourceRevision,
      publishedAt: detail.stage.publishedAt,
      sourceUrl: detail.tournament.sourceUrl ?? detail.stage.sourceUrl,
    },
    links: {
      tournamentHref: `/bgmi-tournaments/${detail.tournament.slug}`,
      stageHref: `/bgmi-tournaments/${detail.tournament.slug}/${detail.stage.slug}`,
    },
  };
}

/** Match numbers eligible for scenarios — completed with map and results. */
export function listScenarioMatchNumbers(detail: PublishedStageDetail): number[] {
  return detail.matches
    .filter((m) => m.status === "completed" && !!m.mapName && m.results.length > 0)
    .map((m) => m.matchNumber)
    .sort((a, b) => a - b);
}
