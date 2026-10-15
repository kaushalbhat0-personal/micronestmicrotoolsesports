/**
 * Shared deterministic direction/polarity map.
 *
 * One classification engine for every game adapter. Adapters may register
 * small per-game overrides, but must never fork the engine.
 *
 * Polarity contract:
 * - "up-good" attributes: higher value helps the entity (damage, armor).
 * - "up-bad" attributes: higher value hurts the entity (cooldown, mana cost).
 * - Unknown attributes → adjustment/low. Never guessed.
 */

import type { ClassificationConfidence, PatchChangeType } from "../types";

export type AttributePolarity = "up-good" | "up-bad";

export interface Classification {
  readonly changeType: PatchChangeType;
  readonly confidence: ClassificationConfidence;
}

/** Shared attribute vocabulary (normalized, lowercase, underscores). */
const POLARITY: Readonly<Record<string, AttributePolarity>> = {
  damage: "up-good",
  attack_damage: "up-good",
  ability_power: "up-good",
  healing: "up-good",
  shield: "up-good",
  health: "up-good",
  armor: "up-good",
  magic_resist: "up-good",
  attack_speed: "up-good",
  ability_haste: "up-good",
  move_speed: "up-good",
  movement_speed: "up-good",
  range: "up-good",
  duration: "up-good",
  ammo: "up-good",
  lifesteal: "up-good",
  tenacity: "up-good",
  strength: "up-good",
  agility: "up-good",
  intelligence: "up-good",
  bounty: "up-good",
  // Higher is worse for the entity.
  cooldown: "up-bad",
  mana_cost: "up-bad",
  manacost: "up-bad",
  energy_cost: "up-bad",
  ultimate_cost: "up-bad",
  reload_time: "up-bad",
  spread: "up-bad",
  recoil: "up-bad",
  cast_time: "up-bad",
  respawn_time: "up-bad",
  gold_cost: "up-bad",
  recipe_cost: "up-bad",
  cost: "up-bad",
};

/** Per-game attribute overrides: adapterKey → attribute → polarity. */
const OVERRIDES: Readonly<Record<string, Readonly<Record<string, AttributePolarity>>>> = {
  "dota-2": {
    base_attack_time: "up-bad",
    attack_time: "up-bad",
  },
  // Verified against the 13.01 fixture: Outlaw "Recovery from 0.1 >>> 0.15"
  // weakens the weapon, so a recovery increase is a nerf.
  valorant: {
    recovery: "up-bad",
  },
  // Verified against live LoL notes: "Damage Taken: 105% ⇒ 100%" helps the
  // champion, so a damage-taken decrease is a buff (the shared "damage"
  // substring would otherwise invert it to a nerf).
  lol: {
    damage_taken: "up-bad",
  },
};

export function normalizeAttribute(raw: string): string {
  return raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

/** Resolve polarity for an attribute, honoring per-game overrides. */
export function resolvePolarity(attribute: string, adapterKey?: string): AttributePolarity | null {
  const key = normalizeAttribute(attribute);
  if (adapterKey !== undefined) {
    const override = OVERRIDES[adapterKey]?.[key];
    if (override !== undefined) return override;
  }
  // Substring fallback: "spell shield" contains "shield".
  for (const [name, polarity] of Object.entries(POLARITY)) {
    if (key.includes(name)) return polarity;
  }
  return null;
}

export interface ClassifyInput {
  readonly attribute: string | null;
  /** -1 (down), 0 (equal/unknown), 1 (up). Slash-lists use first-level compare. */
  readonly direction: -1 | 0 | 1;
  readonly adapterKey?: string;
  /** Explicit content flags observed by the parser. */
  readonly isNew?: boolean;
  readonly isRework?: boolean;
  readonly isRemoval?: boolean;
  readonly isBugfix?: boolean;
  /** True when the entry bundles contradictory effects. */
  readonly contradictory?: boolean;
}

/**
 * Deterministic buff/nerf/adjustment classification. No LLM involvement.
 * Unknown or contradictory input → adjustment/low.
 */
export function classifyChange(input: ClassifyInput): Classification {
  if (input.isBugfix === true) return { changeType: "bugfix", confidence: "high" };
  if (input.isRework === true) return { changeType: "rework", confidence: "high" };
  if (input.isNew === true) return { changeType: "new", confidence: "high" };
  if (input.isRemoval === true) return { changeType: "neutral", confidence: "medium" };
  if (input.contradictory === true) return { changeType: "adjustment", confidence: "low" };
  if (input.attribute === null || input.direction === 0) {
    return { changeType: "adjustment", confidence: "low" };
  }
  const polarity = resolvePolarity(input.attribute, input.adapterKey);
  if (polarity === null) return { changeType: "adjustment", confidence: "low" };
  const improved = polarity === "up-good" ? input.direction === 1 : input.direction === -1;
  return improved
    ? { changeType: "buff", confidence: "medium" }
    : { changeType: "nerf", confidence: "medium" };
}

/** Compare slash-separated level values by their first components. */
export function compareLevelValues(oldText: string, newText: string): -1 | 0 | 1 {
  const first = (value: string): number | null => {
    const head = value.split("/")[0]?.replace(/[^0-9.]/g, "");
    if (head === undefined || head === "") return null;
    const parsed = Number(head);
    return Number.isFinite(parsed) ? parsed : null;
  };
  const oldHead = first(oldText);
  const newHead = first(newText);
  if (oldHead === null || newHead === null || oldHead === newHead) return 0;
  return newHead > oldHead ? 1 : -1;
}
