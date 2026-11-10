/**
 * Presentation taxonomy for Meta-Parser patch facts (RCCF-META-PARSER-UX-07).
 *
 * Pure functions only — no database access, no Supabase, no React.
 * Maps the internal parser bucket (`entity_type`, e.g. `system`) to a
 * human-facing patch section (e.g. `Gameplay`). The grouping engine and all
 * UI components stay generic; only this module knows game-specific labels.
 *
 * Rules:
 * - Deterministic: section order is declared, never database-ordered.
 * - Unknown game slugs and unknown entity types map to `Other`, never crash.
 * - No new categories are inferred from `category` — only `entity_type`
 *   values actually emitted by the adapters are mapped.
 */

export interface PresentationSection {
  /** Stable section key (used for ordering and React keys). */
  readonly key: string;
  /** Human-facing section label (e.g. "Heroes", "Gameplay"). */
  readonly label: string;
  /** Adapter-defined entity types belonging to this section. */
  readonly entityTypes: ReadonlyArray<string>;
}

export interface PresentationTaxonomy {
  readonly gameSlug: string;
  readonly sections: ReadonlyArray<PresentationSection>;
}

/** Fallback section for unknown/future entity types. Never blank. */
export const OTHER_SECTION: PresentationSection = {
  key: "other",
  label: "Other",
  entityTypes: [],
};

interface TaxonomySpec {
  readonly sections: ReadonlyArray<{ key: string; label: string; entityTypes: ReadonlyArray<string> }>;
}

/**
 * Data-driven per-game presentation taxonomies. Each entry maps ONLY the
 * entity types the corresponding adapter actually emits today:
 * - dota-2: hero | item | system
 * - valorant: agent | weapon | map | system
 * - lol: champion | item | system
 */
const TAXONOMIES: Readonly<Record<string, TaxonomySpec>> = {
  "dota-2": {
    sections: [
      { key: "heroes", label: "Heroes", entityTypes: ["hero"] },
      { key: "items", label: "Items", entityTypes: ["item"] },
      { key: "gameplay", label: "Gameplay", entityTypes: ["system"] },
    ],
  },
  valorant: {
    sections: [
      { key: "agents", label: "Agents", entityTypes: ["agent"] },
      { key: "weapons", label: "Weapons", entityTypes: ["weapon"] },
      { key: "maps", label: "Maps", entityTypes: ["map"] },
      { key: "gameplay", label: "Gameplay", entityTypes: ["system"] },
    ],
  },
  lol: {
    sections: [
      { key: "champions", label: "Champions", entityTypes: ["champion"] },
      { key: "items", label: "Items", entityTypes: ["item"] },
      { key: "gameplay", label: "Gameplay", entityTypes: ["system"] },
    ],
  },
};

/** Ordered section list for a game; unknown games yield `[Other]`. */
export function getPresentationTaxonomy(gameSlug: string): PresentationTaxonomy {
  const spec = TAXONOMIES[gameSlug];
  if (!spec) return { gameSlug, sections: [OTHER_SECTION] };
  return {
    gameSlug,
    sections: [...spec.sections.map((s) => ({ ...s, entityTypes: [...s.entityTypes] })), OTHER_SECTION],
  };
}

/** Section an entity type belongs to; unknown types (and games) map to `Other`. */
export function getPresentationSection(gameSlug: string, entityType: string): PresentationSection {
  const spec = TAXONOMIES[gameSlug];
  if (spec) {
    const match = spec.sections.find((s) => s.entityTypes.includes(entityType));
    if (match) return { ...match, entityTypes: [...match.entityTypes] };
  }
  return { ...OTHER_SECTION, entityTypes: [] };
}

export interface SectionFilterOption {
  /** Raw stored entity_type value (URL param stays internal vocabulary). */
  readonly value: string;
  /** Human-facing section label. */
  readonly label: string;
  /** Section key for ordering. */
  readonly sectionKey: string;
}

/**
 * Filter options for a patch's own entity types, ordered by taxonomy
 * section order. Types sharing a section collapse to one option (first
 * stored value wins); unknown types surface once under `Other`.
 */
export function sectionsForEntityTypes(
  gameSlug: string,
  entityTypes: readonly string[]
): ReadonlyArray<SectionFilterOption> {
  const seen = new Set<string>();
  const options: SectionFilterOption[] = [];
  const ordered = [...entityTypes].sort(
    (a, b) => sectionOrder(gameSlug, a) - sectionOrder(gameSlug, b) || (a < b ? -1 : a > b ? 1 : 0)
  );
  for (const entityType of ordered) {
    const section = getPresentationSection(gameSlug, entityType);
    if (seen.has(section.key)) continue;
    seen.add(section.key);
    options.push({ value: entityType, label: section.label, sectionKey: section.key });
  }
  return options;
}

/** Declared section order index (stable sort key); unknown types sort last. */
export function sectionOrder(gameSlug: string, entityType: string): number {
  const spec = TAXONOMIES[gameSlug];
  if (!spec) return 0;
  const index = spec.sections.findIndex((s) => s.entityTypes.includes(entityType));
  return index >= 0 ? index : spec.sections.length;
}
