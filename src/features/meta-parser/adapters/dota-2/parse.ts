/**
 * Dota 2 patch-block parser (dotaconstants structured corpus).
 *
 * Input is one dataset key block:
 *   general: string[]                       → system changes
 *   items:   { item_key: string[] }          → item changes
 *   heroes:  { hero_key: { ability_key | general | talents: string[] } }
 *
 * One sanitized entry → one RawPatchChange. Deterministic only:
 * content flags (new/rework/removal/fix) → numeric from→to + shared
 * direction map → adjustment/low fallback. The LLM never classifies.
 */

import type { RawPatchChange } from "../../types";
import { classifyChange, compareLevelValues, normalizeAttribute } from "../../services/direction-map";
import { normalizeEntityName } from "../../services/entity-normalize";
import { extractTransition } from "../../services/numeric-extract";
import { sanitizePatchText } from "../../services/sanitize";
import { resolveHeroName } from "./hero-aliases";

export interface DotaPatchBlock {
  readonly general?: unknown;
  readonly items?: unknown;
  readonly heroes?: unknown;
}

export interface ParseDotaBlockInput {
  readonly block: DotaPatchBlock;
  readonly upstreamCommit: string | null;
  readonly aliasMap: ReadonlyMap<string, string>;
}

const REWORK_PATTERN = /\brework(ed)?\b/i;
const NEW_ITEM_PATTERN = /^\s*new\s+(item|ability|hero)\b/i;
const REMOVAL_PATTERN = /\b(removed from the game|no longer (?:deals|has|gives|provides|drops|exists)|has been removed)\b/i;
const BUGFIX_PATTERN = /^\s*fixed\b/i;
const VERB_PATTERN = /\b(increased|decreased|reduced|changed|rescaled|improved|adjusted)\b/i;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Merge split OLD:/NEW: pairs. The corpus stores formulas as consecutive
 * entries ("OLD: ..." then "NEW: ..."); without merging, neither half
 * carries a complete transition. Only merges when the current entry starts
 * with NEW: and the previous buffered entry contains OLD:.
 */
export function mergeOldNewPairs(entries: readonly string[]): string[] {
  const merged: string[] = [];
  for (const entry of entries) {
    const previous = merged[merged.length - 1];
    if (
      previous !== undefined &&
      /^\s*NEW:/i.test(entry) &&
      /\bOLD:/i.test(previous) &&
      !/\bNEW:/i.test(previous)
    ) {
      merged[merged.length - 1] = `${previous} ${entry}`;
    } else {
      merged.push(entry);
    }
  }
  return merged;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  return value as Readonly<Record<string, unknown>>;
}

/** Attribute guess = text before the change verb, last few words. */
function guessAttribute(clean: string): string | null {
  const verb = VERB_PATTERN.exec(clean);
  if (!verb || verb.index === undefined || verb.index === 0) return null;
  const before = clean.slice(0, verb.index).replace(/[:(]+$/, "").trim();
  if (before === "") return null;
  const words = before.split(/\s+/).slice(-6).join(" ");
  return words.slice(0, 80);
}

function hasOpposingVerbs(clean: string): boolean {
  const up = /\b(increased|improved)\b/i.test(clean);
  const down = /\b(decreased|reduced)\b/i.test(clean);
  return up && down;
}

function prettifyKey(key: string): string {
  return key
    .split("_")
    .map((part) => (part.length > 0 ? part[0]?.toUpperCase() + part.slice(1) : part))
    .join(" ");
}

interface EmitterContext {
  readonly bucket: "hero" | "item" | "general";
  readonly heroKey: string | null;
  readonly heroName: string | null;
  readonly abilityKey: string | null;
  readonly isTalent: boolean;
  readonly itemKey: string | null;
  readonly upstreamCommit: string | null;
  readonly aliasMap: ReadonlyMap<string, string>;
}

function emitRaw(entry: string, index: number, ctx: EmitterContext): RawPatchChange | null {
  const clean = sanitizePatchText(entry);
  if (clean === "") return null;

  const transition = extractTransition(clean);
  const contradictory = hasOpposingVerbs(clean);
  const attribute = guessAttribute(clean);
  const classification = classifyChange({
    attribute,
    direction:
      transition.oldText !== null && transition.newText !== null
        ? compareLevelValues(transition.oldText, transition.newText)
        : 0,
    adapterKey: "dota-2",
    isNew: NEW_ITEM_PATTERN.test(clean),
    isRework: REWORK_PATTERN.test(clean),
    isRemoval: REMOVAL_PATTERN.test(clean),
    isBugfix: BUGFIX_PATTERN.test(clean),
    contradictory,
  });

  const entityName =
    ctx.heroName ?? (ctx.itemKey !== null ? prettifyKey(ctx.itemKey) : "General");
  const entityType = ctx.bucket === "hero" ? "hero" : ctx.bucket === "item" ? "item" : "system";
  const category =
    ctx.bucket === "hero" ? (ctx.isTalent ? "talents" : ctx.abilityKey === "general" ? "general" : "ability") : ctx.bucket === "item" ? "item" : "system";

  const stableKey = [ctx.bucket, ctx.heroKey ?? ctx.itemKey ?? "general", ctx.abilityKey ?? "-", String(index)].join(":");

  return {
    stableKey,
    entityType,
    entityName,
    entityKey: ctx.heroKey ?? ctx.itemKey,
    category,
    attribute: attribute !== null ? normalizeAttribute(attribute) : null,
    description: clean,
    oldText: transition.oldText,
    newText: transition.newText,
    oldNumeric: transition.oldNumeric,
    newNumeric: transition.newNumeric,
    unit: null,
    changeType: classification.changeType,
    confidence: classification.confidence,
    metadata: {
      source_bucket: ctx.bucket,
      hero_key: ctx.heroKey,
      ability_key: ctx.abilityKey,
      talent: ctx.isTalent,
      upstream_commit: ctx.upstreamCommit,
    },
  };
}

/** Parse one dataset-key block into raw changes. Never throws on data shape. */
export function parseDotaPatchBlock(input: ParseDotaBlockInput): RawPatchChange[] {
  const out: RawPatchChange[] = [];
  let index = 0;
  const nextIndex = (): number => {
    index += 1;
    return index;
  };

  for (const entry of mergeOldNewPairs(asStringArray(input.block.general))) {
    const raw = emitRaw(entry, nextIndex(), {
      bucket: "general",
      heroKey: null,
      heroName: null,
      abilityKey: null,
      isTalent: false,
      itemKey: null,
      upstreamCommit: input.upstreamCommit,
      aliasMap: input.aliasMap,
    });
    if (raw !== null) out.push(raw);
  }

  const items = asRecord(input.block.items);
  for (const [itemKey, entries] of Object.entries(items)) {
    for (const entry of mergeOldNewPairs(asStringArray(entries))) {
      const raw = emitRaw(entry, nextIndex(), {
        bucket: "item",
        heroKey: null,
        heroName: null,
        abilityKey: null,
        isTalent: false,
        itemKey,
        upstreamCommit: input.upstreamCommit,
        aliasMap: input.aliasMap,
      });
      if (raw !== null) out.push(raw);
    }
  }

  const heroes = asRecord(input.block.heroes);
  for (const [heroKey, abilityMap] of Object.entries(heroes)) {
    const resolved = resolveHeroName(heroKey, input.aliasMap);
    const abilities = asRecord(abilityMap);
    for (const [abilityKey, entries] of Object.entries(abilities)) {
      for (const entry of mergeOldNewPairs(asStringArray(entries))) {
        const raw = emitRaw(entry, nextIndex(), {
          bucket: "hero",
          heroKey,
          heroName: resolved.displayName,
          abilityKey,
          isTalent: abilityKey === "talents",
          itemKey: null,
          upstreamCommit: input.upstreamCommit,
          aliasMap: input.aliasMap,
        });
        if (raw !== null) out.push(raw);
      }
    }
  }
  return out;
}

/** Attach tracking identity (normalized entity name) to parsed changes. */
export function withEntityNormalized(
  changes: readonly RawPatchChange[]
): Array<RawPatchChange & { entityNormalized: string }> {
  return changes.map((change) => ({
    ...change,
    entityNormalized: normalizeEntityName(change.entityName),
  }));
}
