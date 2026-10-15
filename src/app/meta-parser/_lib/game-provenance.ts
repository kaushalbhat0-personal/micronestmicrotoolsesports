import type {
  PublishedGame,
  PublishedGameProvenance,
} from "@/features/meta-parser/repositories/reads";

export interface ResolvedGameProvenance {
  readonly sourceLabel: string;
  readonly datasetLabel: string | null;
  readonly datasetUrl: string | null;
  readonly license: string | null;
}

/**
 * Verified Dota 2 attribution (matches production copy verbatim).
 * Sourced from IMPL-02 verification against the upstream LICENSE.
 * No other game defaults are fabricated here — unknown games fall back to
 * generic official-patch-notes wording until their catalog row carries
 * `expected_fields.provenance`.
 */
const DOTA_2_PROVENANCE: ResolvedGameProvenance = {
  sourceLabel: "Valve — Dota 2",
  datasetLabel: "OpenDota dotaconstants",
  datasetUrl: "https://github.com/odota/dotaconstants",
  license: "MIT License, © 2017 The OpenDota Project",
};

/** Resolve display provenance: catalog data first, verified fallbacks second. */
export function resolveGameProvenance(game: PublishedGame): ResolvedGameProvenance {
  const provenance: PublishedGameProvenance = game.provenance;
  if (
    provenance.sourceLabel !== null ||
    provenance.datasetLabel !== null ||
    provenance.datasetUrl !== null ||
    provenance.license !== null
  ) {
    return {
      sourceLabel: provenance.sourceLabel ?? `${game.name} official patch notes`,
      datasetLabel: provenance.datasetLabel,
      datasetUrl: provenance.datasetUrl,
      license: provenance.license,
    };
  }
  if (game.slug === "dota-2") return DOTA_2_PROVENANCE;
  return {
    sourceLabel: `${game.name} official patch notes`,
    datasetLabel: null,
    datasetUrl: null,
    license: null,
  };
}
