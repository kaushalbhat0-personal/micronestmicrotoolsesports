// D1 teams domain — deterministic matching primitives (REIMPLEMENT from legacy).
// Legacy: legacy/application/src/features/finder/domain/matching.ts
// Boundaries (frozen): NEVER a percentage score. Tiers only.
// D1 note: `verified` and `tournamentEvidenceCount` exist as inputs but callers
// MUST pass verified=false / 0 until a verification pipeline is approved (G1 forbids badges).
import { meetsLevelMinimum, type CompetitiveLevel } from "./levels";
import { regionsCompatible } from "./roles";

export type MatchTier = "strong" | "good" | "stretch" | "no-match";

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
  readonly tournamentEvidenceCount: number;
  readonly labActivityCount: number;
}

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
  readonly key: "role" | "region" | "availability" | "target-level" | "tournament-evidence" | "level-note";
  readonly label: string;
  readonly met: boolean;
}

export interface MatchResult {
  readonly tier: MatchTier;
  readonly blockedBy: ReadonlyArray<string>;
  readonly reasons: ReadonlyArray<MatchReason>;
}

export function normalizeAvailabilityToken(token: string): string {
  return token.trim().toLowerCase().replace(/[\s_]+/g, "-");
}

export function availabilityOverlaps(player: ReadonlyArray<string>, required: ReadonlyArray<string>): boolean {
  if (required.length === 0) return true;
  const have = new Set(player.map(normalizeAvailabilityToken));
  return required.some((token) => have.has(normalizeAvailabilityToken(token)));
}

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

export function rankMatch(player: MatchPlayer, post: MatchPost): MatchResult {
  const hard = hardFiltersPass(player, post);
  if (!hard.pass) return { tier: "no-match", blockedBy: hard.blockedBy, reasons: [] };
  const targetAligned = player.targetLevel === post.targetLevel;
  const overlap = availabilityOverlaps(player.availability, post.availabilityRequired);
  const trustSignal = player.verified || player.tournamentEvidenceCount > 0;
  const labSignal = player.labActivityCount > 0;
  const softHits = [targetAligned, overlap, trustSignal].filter(Boolean).length;
  const tier: MatchTier = softHits >= 3 ? "strong" : softHits >= 1 ? "good" : "stretch";
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
      label: targetAligned ? `Target level aligns (${player.targetLevel})` : `Player targets ${player.targetLevel} — discuss goals in tryout`,
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
  if (labSignal) reasons.push({ key: "level-note", label: "Active in BGMI Lab practice", met: true });
  return { tier, blockedBy: [], reasons };
}
