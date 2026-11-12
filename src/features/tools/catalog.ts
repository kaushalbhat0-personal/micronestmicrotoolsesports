// P5 Esports Tools — static catalogue contract (no database).
// Tools are code, not rows: the registry below is the entire catalogue.
// Adding a tool means appending one definition + its engine/landing pieces;
// no unrelated tool is touched. No pricing, no entitlements, no usage stats
// — availability is the only commercial signal and it is honest
// ("available" = runs locally today; "coming-soon" = landing only).

import { isPlannedGameKey, isSupportedGameKey } from "@/lib/game-catalog/catalog";

export const TOOL_CATEGORIES = [
  "tournament-operations",
  "team-management",
  "scoring",
  "planning",
] as const;

export type ToolCategory = (typeof TOOL_CATEGORIES)[number];

export function isToolCategory(value: unknown): value is ToolCategory {
  return (
    typeof value === "string" &&
    (TOOL_CATEGORIES as readonly string[]).includes(value)
  );
}

export const TOOL_CATEGORY_LABELS: Record<ToolCategory, string> = {
  "tournament-operations": "Tournament operations",
  "team-management": "Team management",
  scoring: "Scoring",
  planning: "Planning",
};

export function toolCategoryLabel(category: ToolCategory): string {
  return TOOL_CATEGORY_LABELS[category];
}

export type ToolAvailability = "available" | "coming-soon";

export function isToolAvailability(value: unknown): value is ToolAvailability {
  return value === "available" || value === "coming-soon";
}

/** Platform-wide tools carry `gameKeys: null` and match every game filter. */
export interface ToolDefinition {
  readonly slug: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  readonly audience: string;
  readonly category: ToolCategory;
  readonly gameKeys: ReadonlyArray<string> | null;
  readonly availability: ToolAvailability;
  readonly version: string;
  readonly inputsExplained: ReadonlyArray<string>;
  readonly outputsExplained: ReadonlyArray<string>;
  readonly usageGuidance: ReadonlyArray<string>;
}

export const TOOL_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function definePrizePoolSplitter(): ToolDefinition {
  return {
    slug: "prize-pool-splitter",
    name: "Prize Pool Splitter",
    tagline: "Split a tournament prize pool into exact per-position payouts.",
    description:
      "A planning calculator for tournament organizers and teams. Enter the total prize pool, assign fixed amounts or percentages to finishing positions, and get an exact per-position breakdown in integer minor units — no floating-point drift, no payments, no custody of funds.",
    audience: "Tournament organizers, team managers and community admins planning BGMI events.",
    category: "tournament-operations",
    gameKeys: null,
    availability: "available",
    version: "1.0.0",
    inputsExplained: [
      "Total prize pool in INR or USD, up to two decimal places.",
      "One row per paid finishing position: a fixed amount or a percentage of the total.",
      "Up to 32 paid positions; positions are whole numbers from 1 to 64.",
    ],
    outputsExplained: [
      "Exact per-position payout in minor units (paise/cents).",
      "Distributed total, unallocated remainder, and a copyable text summary.",
      "Remainders from percentage rounding go to the largest fractional shares, one minor unit at a time.",
    ],
    usageGuidance: [
      "Percentages may sum to at most 100%. Fixed amounts may sum to at most the total.",
      "Anything left undistributed is shown as unallocated — never silently absorbed.",
      "This is a calculation aid for announcements, not a payment or escrow service.",
    ],
  };
}

function defineRosterSlotBuilder(): ToolDefinition {
  return {
    slug: "roster-slot-builder",
    name: "Roster & Slot Builder",
    tagline: "Assemble a BGMI roster and map players to starter and substitute slots.",
    description:
      "A planning aid for team managers and tournament organizers: enter player names by hand, map each one to a starter or substitute slot, and spot empty slots or unassigned players before an event. Everything stays in this browser session — no accounts, no uploads, no lookups.",
    audience: "Team managers, coaches and tournament organizers planning BGMI lineups.",
    category: "team-management",
    gameKeys: ["bgmi"],
    availability: "available",
    version: "1.0.0",
    inputsExplained: [
      "Team name (optional) and the number of starter slots (1–6) plus substitute slots (0–6) you want to plan with.",
      "One row per player: display name (2–24 characters), optional player ID (4–32 characters), role (Flexible, IGL, Assaulter, Support or Scout), and a short note (up to 140 characters).",
      "A slot choice per player: a starter slot, a substitute slot, or the bench (unassigned).",
    ],
    outputsExplained: [
      "Starters-filled progress, a per-slot roster view, and an explicit Empty / Partial / Complete state.",
      "A list of issues needing attention: empty starter slots and unassigned players.",
      "A copyable plain-text roster plan for sharing with teammates.",
    ],
    usageGuidance: [
      "Starter slots are the bar for completeness; substitutes are optional by design.",
      "Occupied slots are never overwritten — unassign the holder first.",
      "This is a planning aid only: it is not an official entry, approval, or player check.",
    ],
  };
}

function defineTiebreakQualifier(): ToolDefinition {
  return {
    slug: "tiebreak-qualifier",
    name: "Tie-Break & Qualification Simulator",
    tagline: "Rank teams on your own scoring rules and test qualification cutoffs.",
    description:
      "A planning simulator for organizers and teams: enter team scores by hand, weight your own criteria, order tie-breaks, and see standings with plain-language explanations. Everything runs in this browser session — no accounts, no uploads, no live data.",
    audience: "Tournament organizers, team managers and community admins planning standings.",
    category: "scoring",
    gameKeys: null,
    availability: "available",
    version: "1.0.0",
    inputsExplained: [
      "Scenario name (optional) and a qualification cutoff (top N, or off).",
      "One row per team: name plus a whole-number score for each criterion you define.",
      "Scoring criteria you name yourself: weight, higher-wins or lower-wins direction, and priority order.",
    ],
    outputsExplained: [
      "Standings with exact integer totals and a per-team score breakdown.",
      "Tie explanations naming the deciding criterion, or an honest unresolved-tie flag.",
      "Qualification states: qualified, out, or contested at the cutoff.",
      "A copyable plain-text summary of the simulated scenario.",
    ],
    usageGuidance: [
      "Totals are value-times-weight sums; ties break in your priority order.",
      "Teams equal on every criterion stay tied — no winner is invented.",
      "A tie across the cutoff is contested: add a criterion or decide by hand.",
      "This is a simulation of your rules, not an official tournament result.",
    ],
  };
}
export const TOOL_REGISTRY: ReadonlyArray<ToolDefinition> = [
  definePrizePoolSplitter(),
  defineRosterSlotBuilder(),
  defineTiebreakQualifier(),
];

export function getToolBySlug(slug: string): ToolDefinition | undefined {
  const normalized = slug.trim().toLowerCase();
  return TOOL_REGISTRY.find((tool) => tool.slug === normalized);
}

export function isValidToolSlug(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 2 &&
    value.length <= 48 &&
    TOOL_SLUG_PATTERN.test(value.trim().toLowerCase())
  );
}

/** Game filter matching: platform-wide tools match every shaped game value. */
export function toolMatchesGame(tool: ToolDefinition, game: string | undefined): boolean {
  if (game === undefined) {
    return true;
  }
  if (tool.gameKeys === null) {
    return true;
  }
  return tool.gameKeys.includes(game);
}

/** Fail-closed vocabulary check for the game filter (mirrors P3/P4 posture). */
export function isKnownGameFilter(value: string): boolean {
  return isSupportedGameKey(value) || isPlannedGameKey(value);
}
