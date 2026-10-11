import type { GameSlug } from "@/config/games/catalog";
import type { Route } from "next";
import type { DraftStep } from "../types";

/**
 * Draft & Ban — Official/static game veto presets (Phase 3).
 *
 * A preset is a STARTING sequence only. Selecting one creates a normal
 * counted custom template through the existing creation path — presets never
 * mint quota-exempt rows, never bypass caps, and never touch RLS/billing.
 *
 * Sequences encode procedure (ban/pick/side order + owning team slot), never
 * map pools: pools rotate per event and stay user-supplied and editable.
 * `side` steps are record-only placeholders; teams record the actual choice
 * during the draft. Side attribution for seeding-determined deciders must be
 * confirmed at match setup (see per-preset sourceNote).
 */
export interface GameVetoPreset {
  readonly id: string;
  readonly gameSlug: GameSlug;
  readonly label: string;
  readonly description: string;
  readonly sequence: readonly DraftStep[];
  readonly sourceNote: string;
}

const B = (team: "A" | "B"): DraftStep => ({ team, type: "ban" });
const P = (team: "A" | "B"): DraftStep => ({ team, type: "pick" });
const S = (team: "A" | "B"): DraftStep => ({ team, type: "side" });

export const GAME_VETO_PRESETS: readonly GameVetoPreset[] = [
  {
    id: "cs2-major-bo1",
    gameSlug: "cs2",
    label: "CS2 Major BO1 — starting sequence",
    description: "Six bans, then the remaining map with a side choice.",
    sequence: [B("A"), B("A"), B("B"), B("B"), B("B"), B("A"), S("B")],
    sourceNote:
      "Standard-bracket sequence per the Valve Major supplemental rulebook (BO1 pick-ban order). Pool not included — supply the event Active Duty pool. Verify against event rules.",
  },
  {
    id: "cs2-major-bo3",
    gameSlug: "cs2",
    label: "CS2 Major BO3 — starting sequence",
    description: "Bans, alternating map picks with side choices, then decider.",
    sequence: [B("A"), B("B"), P("A"), S("B"), P("B"), S("A"), B("B"), B("A"), S("B")],
    sourceNote:
      "Standard-bracket sequence per the Valve Major supplemental rulebook (BO3 pick-ban order). Pool not included — supply the event Active Duty pool. Verify against event rules.",
  },
  {
    id: "valorant-vct-bo1",
    gameSlug: "valorant",
    label: "VCT BO1 — starting sequence",
    description: "Six bans, then the remaining map with a side choice.",
    sequence: [B("A"), B("B"), B("A"), B("B"), B("A"), B("B"), S("A")],
    sourceNote:
      "Standard-bracket sequence per the VCT official competition ruleset (BO1 map selection). Pool not included — supply the event map pool. Verify against event rules.",
  },
  {
    id: "valorant-vct-bo3",
    gameSlug: "valorant",
    label: "VCT BO3 — starting sequence",
    description: "Bans, alternating map picks with side choices, then decider.",
    sequence: [B("A"), B("B"), P("A"), S("B"), P("B"), S("A"), B("A"), B("B"), S("A")],
    sourceNote:
      "Standard-bracket sequence per the VCT official competition ruleset (BO3 map selection). Pool not included — supply the event map pool. Verify against event rules.",
  },
  {
    id: "valorant-vct-bo5",
    gameSlug: "valorant",
    label: "VCT BO5 — starting sequence",
    description: "Two bans, four alternating picks with side choices, then decider.",
    sequence: [B("A"), B("B"), P("A"), S("B"), P("B"), S("A"), P("A"), S("B"), P("B"), S("A"), S("B")],
    sourceNote:
      "Standard-bracket sequence per the VCT official competition ruleset (BO5 map selection). Pool not included — supply the event map pool. Verify against event rules.",
  },
  {
    id: "r6-bo1",
    gameSlug: "rainbow-six-siege",
    label: "R6 BO1 — starting sequence",
    description: "Seven bans, one map pick, then side selection.",
    sequence: [B("A"), B("B"), B("A"), B("B"), B("A"), B("B"), B("A"), P("B"), S("A")],
    sourceNote:
      "Standard-bracket sequence per the Ubisoft competition rulebook (BO1 map ban order, 9-map pool). Side selection goes to the non-picking team per the rulebook. Operator bans are out of scope. Verify against event rules.",
  },
  {
    id: "r6-bo3",
    gameSlug: "rainbow-six-siege",
    label: "R6 BO3 — starting sequence",
    description: "Bans, alternating map picks with side choices, then decider.",
    sequence: [B("A"), B("B"), B("A"), B("B"), P("A"), S("B"), P("B"), S("A"), B("A"), B("B"), S("A")],
    sourceNote:
      "Standard-bracket sequence per the Ubisoft competition rulebook (BO3 map ban order). Decider side follows series round-differential/seeding per the rulebook — confirm the team slot when creating the match. Operator bans are out of scope. Verify against event rules.",
  },
];

export function getGameVetoPresetById(id: string): GameVetoPreset | undefined {
  return GAME_VETO_PRESETS.find((preset) => preset.id === id);
}

export function getGameVetoPresetsBySlug(slug: GameSlug): GameVetoPreset[] {
  return GAME_VETO_PRESETS.filter((preset) => preset.gameSlug === slug);
}

export type GamePresetCreateResult = { readonly error?: string; readonly templateId?: string };

/**
 * Match-setup route for a freshly saved preset template. Uses the same
 * `?template=` contract as the template picker — no new routing convention.
 */
export function buildGamePresetSetupHref(orgSlug: string, templateId: string): Route {
  return `/dashboard/${orgSlug}/draft-ban/new?template=${templateId}` as Route;
}

/**
 * Post-creation navigation decision. Returns the setup href only when the
 * server result carries a template id with no error; otherwise null so the
 * caller surfaces the error state instead of navigating.
 */
export function resolveGamePresetSetupNavigation(
  orgSlug: string,
  result: GamePresetCreateResult,
): Route | null {
  if (result.error || !result.templateId) return null;
  return buildGamePresetSetupHref(orgSlug, result.templateId);
}
