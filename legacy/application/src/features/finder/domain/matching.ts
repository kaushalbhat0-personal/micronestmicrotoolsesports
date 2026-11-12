/**
 * Finder — deterministic matching primitives.
 *
 * Pure functions only: no database queries, no network, no randomness.
 * Matching NEVER produces a percentage score. Results are an explainable
 * tier (Strong / Good / Possible stretch) plus per-criterion reasons.
 */

import {
  meetsLevelMinimum,
  type CompetitiveLevel,
} from "./levels";
import { regionsCompatible } from "./roles";

export type MatchTier = "strong" | "good" | "stretch" | "no-match";

/** Minimal normalized player shape the matcher consumes. */
export interface MatchPlayer {
  readonly game: string;
  readonly lookingFor: boolean;
  readonly region: string;
  readonly primaryRole: string;
  readonly secondaryRoles: ReadonlyArray<string>;
  readonly currentLevel: CompetitiveLevel;
  readonly targetLevel: CompetitiveLevel;
  readonly availability: ReadonlyArray<string>;
  readonly verified: boolean;
  /** Independently supported evidence (Hub roster records). Count only. */
  readonly tournamentEvidenceCount: number;
  /** Lab activity signal (run counts). Counts only — never scores. */
  readonly labActivityCount: number;
}

/** Minimal normalized recruitment-post shape the matcher consumes. */
export interface MatchPost {
  readonly game: string;
  readonly status: string;
  readonly region: string;
  readonly roleNeeded: string;
  readonly currentLevelMin: CompetitiveLevel;
  readonly targetLevel: CompetitiveLevel;
  readonly availabilityRequired: ReadonlyArray<string>;
}

export interface MatchReason {
  /** Stable key for UI mapping (never user-facing raw). */
  readonly key:
    | "role"
    | "region"
    | "availability"
    | "target-level"
    | "tournament-evidence"
    | "level-note";
  /** Human-readable, no internal IDs or fake precision. */
  readonly label: string;
  readonly met: boolean;
}

export interface MatchResult {
  readonly tier: MatchTier;
  /** Hard-filter failure explanations. Empty when tier !== no-match. */
  readonly blockedBy: ReadonlyArray<string>;
  /** Soft-preference explanations, strongest first. */
  readonly reasons: ReadonlyArray<MatchReason>;
}

/**
 * Availability overlap: coarse token comparison. Both sides use broad
 * labels ("weekday-evenings", "8-11 PM IST"), so exact schedule parsing
 * is out of scope — any shared token counts as overlap.
 */
export function normalizeAvailabilityToken(token: string): string {
  return token.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function availabilityOverlaps(
  player: ReadonlyArray<string>,
  required: ReadonlyArray<string>,
): boolean {
  if (required.length === 0) return true;
  const have = new Set(player.map(normalizeAvailabilityToken));
  return required.some((token) => have.has(normalizeAvailabilityToken(token)));
}

/** Hard filters: every criterion must pass for a result to be shown. */
export function hardFiltersPass(
  player: MatchPlayer,
  post: MatchPost,
): { readonly pass: boolean; readonly blockedBy: ReadonlyArray<string> } {
  const blockedBy: string[] = [];

  if (player.game !== post.game) blockedBy.push("Different game");
  if (post.status !== "open") blockedBy.push("Recruitment is not open");
  if (!player.lookingFor) blockedBy.push("Player is not looking for a team");
  if (!regionsCompatible(player.region, post.region)) blockedBy.push("Region mismatch");

  const roles = new Set([player.primaryRole, ...player.secondaryRoles]);
  if (!roles.has(post.roleNeeded)) blockedBy.push(`Role needed: ${post.roleNeeded}`);

  if (!meetsLevelMinimum(player.currentLevel, post.currentLevelMin)) {
    blockedBy.push(`Needs at least ${post.currentLevelMin} level context`);
  }

  return { pass: blockedBy.length === 0, blockedBy };
}

/**
 * Soft ranking after hard filters pass. Tier thresholds:
 * - strong: target aligned + availability + at least one trust signal
 * - good: target aligned or availability (core fit without trust signals)
 * - stretch: neither target nor availability aligns (level/role fit only)
 */
export function rankMatch(player: MatchPlayer, post: MatchPost): MatchResult {
  const hard = hardFiltersPass(player, post);
  if (!hard.pass) {
    return { tier: "no-match", blockedBy: hard.blockedBy, reasons: [] };
  }

  const targetAligned = player.targetLevel === post.targetLevel;
  const overlap = availabilityOverlaps(player.availability, post.availabilityRequired);
  const trustSignal = player.verified || player.tournamentEvidenceCount > 0;
  const labSignal = player.labActivityCount > 0;

  const softHits = [targetAligned, overlap, trustSignal].filter(Boolean).length;
  const tier: MatchTier =
    softHits >= 3 ? "strong" : softHits >= 1 ? "good" : "stretch";

  const reasons: MatchReason[] = [
    { key: "role", label: `Role: ${post.roleNeeded}`, met: true },
    { key: "region", label: `Region: ${post.region}`, met: true },
    {
      key: "availability",
      label: overlap ? "Availability overlaps" : "Availability differs — confirm timings in tryout",
      met: overlap,
    },
    {
      key: "target-level",
      label: targetAligned
        ? `Target level aligns (${player.targetLevel})`
        : `Player targets ${player.targetLevel} — discuss goals in tryout`,
      met: targetAligned,
    },
    {
      key: "tournament-evidence",
      label:
        player.tournamentEvidenceCount > 0
          ? "Tournament record present (Hub)"
          : player.verified
            ? "BGMI account verified"
            : "Tournament experience self-reported",
      met: trustSignal,
    },
  ];

  if (labSignal) {
    reasons.push({
      key: "level-note",
      label: "Active in BGMI Lab practice",
      met: true,
    });
  }

  return { tier, blockedBy: [], reasons };
}
