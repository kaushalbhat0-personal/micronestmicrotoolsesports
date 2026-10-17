/**
 * BGMI Tournament Hub — domain types.
 *
 * Liquipedia is the primary tournament-data source (public MediaWiki API,
 * CC BY-SA — see adapters/liquipedia.ts). KRAFTON endpoints are never
 * touched: official per-tournament standings/match endpoints are
 * authentication-gated and must not be bypassed.
 *
 * Standings are always DERIVED (repositories/reads.ts):
 *   stage total = entry starting_points + SUM(match totals)
 * and never stored as competing totals.
 */

export interface BgmiTournament {
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
  readonly seasonYear: number | null;
  readonly organizer: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly rulebookUrl: string | null;
  readonly sourceUrl: string;
  readonly sourcePage: string;
  readonly sourceRevision: number | null;
  readonly sourceLastUpdatedAt: string | null;
  readonly status: "upcoming" | "ongoing" | "completed";
}

export interface BgmiStage {
  readonly slug: string;
  readonly name: string;
  readonly formatNote: string | null;
  readonly status: "upcoming" | "ongoing" | "completed";
  readonly smashRule: boolean;
  readonly matchPointThreshold: number | null;
  readonly sourceUrl: string | null;
  readonly sourceRevision: number | null;
  readonly publishedAt: string | null;
}

export interface BgmiTeam {
  readonly canonicalName: string;
  readonly displayName: string;
  readonly shortName: string;
  readonly logoUrl: string | null;
}

export interface BgmiMatchResult {
  readonly teamCanonical: string;
  readonly placement: number;
  readonly finishes: number;
  readonly placementPoints: number;
  readonly finishPoints: number;
  readonly totalPoints: number;
}

export interface BgmiMatch {
  readonly matchNumber: number;
  readonly mapName: string | null;
  readonly scheduledAt: string | null;
  readonly status: "scheduled" | "completed";
  readonly vodUrl: string | null;
  readonly results: readonly BgmiMatchResult[];
}

export interface BgmiStageEntry {
  readonly teamCanonical: string;
  readonly startingPoints: number;
  /** Sparse official hint from the source; advisory only, never stored. */
  readonly sourcePlacement: number | null;
}

/**
 * Fully normalized stage dataset — the in-memory staging area.
 * The ingest pipeline validates this completely BEFORE any database
 * write, so a failed run leaves the previous published data intact.
 */
export interface BgmiStageDataset {
  readonly tournament: {
    readonly slug: string;
    readonly name: string;
    readonly shortName: string;
    readonly seasonYear: number | null;
    readonly organizer: string | null;
    readonly startsOn: string | null;
    readonly endsOn: string | null;
    readonly rulebookUrl: string | null;
    readonly sourceUrl: string;
    readonly sourcePage: string;
    readonly sourceRevision: number | null;
    readonly sourceLastUpdatedAt: string | null;
    readonly status: "upcoming" | "ongoing" | "completed";
  };
  readonly stage: {
    readonly slug: string;
    readonly name: string;
    readonly formatNote: string | null;
    readonly status: "upcoming" | "ongoing" | "completed";
    readonly smashRule: boolean;
    readonly matchPointThreshold: number | null;
    readonly sourceUrl: string | null;
    readonly sourceRevision: number | null;
  };
  readonly teams: readonly BgmiTeam[];
  readonly entries: readonly BgmiStageEntry[];
  readonly matches: readonly BgmiMatch[];
  /** Points table the source declared for this stage (p1..p8, p_kill). */
  readonly scoring: {
    readonly placementPoints: readonly number[];
    readonly finishPointValue: number;
  };
}

/** One derived standings row (computed, never stored). */
export interface BgmiStandingRow {
  readonly rank: number;
  readonly teamCanonical: string;
  readonly displayName: string;
  readonly shortName: string;
  readonly logoUrl: string | null;
  readonly wins: number;
  readonly placementPoints: number;
  readonly finishes: number;
  readonly matchPoints: number;
  readonly startingPoints: number;
  readonly totalPoints: number;
  readonly matchesPlayed: number;
}
