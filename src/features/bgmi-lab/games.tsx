import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * BGMI Lab game loader map — single registry-aware mapping from game slug
 * to its client island.
 *
 * Architecture: registry → route → loader map → game island.
 * The route never hardcodes a game component; adding a game means adding
 * one entry here (plus registry entry + island component) — no route
 * changes. The /bgmi-lab index never imports this module, so index
 * visitors never download game code.
 *
 * The homepage teaser (circle-iq-micro-challenge) is intentionally
 * separate and must NEVER import from this module.
 */

const CircleIqIsland = dynamic(() =>
  import("@/features/bgmi-lab/components/circle-iq-shell").then((m) => m.CircleIqShell)
);

const RotationReplayIsland = dynamic(() =>
  import("@/features/bgmi-lab/components/rotation-replay-shell").then((m) => m.RotationReplayShell)
);

const TournamentScenarioGeneratorIsland = dynamic(() =>
  import("@/features/bgmi-lab/components/tournament-scenario-generator-shell").then(
    (m) => m.TournamentScenarioGeneratorShell
  )
);

const ZonePatternExplorerIsland = dynamic(() =>
  import("@/features/bgmi-lab/components/zone-pattern-explorer-shell").then((m) => m.ZonePatternExplorerShell)
);

/** Only routable-with-island slugs appear here. Planned tools have no entry. */
const LAB_GAME_LOADERS: Record<string, ComponentType> = {
  "circle-iq": CircleIqIsland,
  "rotation-replay": RotationReplayIsland,
  "tournament-scenario-generator": TournamentScenarioGeneratorIsland,
  "zone-patterns": ZonePatternExplorerIsland,
};

export function resolveLabGame(slug: string): ComponentType | null {
  return LAB_GAME_LOADERS[slug] ?? null;
}

export function hasLabGame(slug: string): boolean {
  return slug in LAB_GAME_LOADERS;
}
