import type { DraftStep, DraftTemplateConfig } from "../types";

/**
 * Draft & Ban — Generic starter preset.
 * Game-agnostic fairness pattern only: alternating bans, then picks.
 * The leftover pool item is the decider. No game rules encoded.
 */

export const STANDARD_VETO_NAME = "Standard Veto";

export const STANDARD_VETO_SEQUENCE: readonly DraftStep[] = [
  { team: "A", type: "ban" },
  { team: "B", type: "ban" },
  { team: "A", type: "ban" },
  { team: "B", type: "ban" },
  { team: "A", type: "pick" },
  { team: "B", type: "pick" },
] as const;

export const STANDARD_VETO_POOL_SIZE = 7;

export const STANDARD_VETO_DESCRIPTION = "Alternating bans (2 per team), then one pick each. The remaining map is the decider.";

export function standardVetoTemplate(): DraftTemplateConfig {
  return {
    sequence: STANDARD_VETO_SEQUENCE.map((s) => ({ team: s.team, type: s.type })),
    pool: [],
    teamA: null,
    teamB: null,
  };
}
