/**
 * League of Legends patch-article parser (official Riot HTML articles).
 *
 * Input block: `{ lines: [{ depth, text, heading?, quote? }] }` produced
 * from article HTML. Sections are delimited by `##` boundaries; mode and
 * cosmetic subtrees (ARAM, Mayhem, Arena, Classic, skins, highlights,
 * related) are excluded WHOLESALE — Mayhem/Arena rows mimic Rift grammar
 * with different numbers, so keyword-per-row filtering would leak.
 *
 * Deterministic only: `⇒` (plus `→`/`->`) numeric transitions + shared
 * direction map (adapterKey "lol", incl. the `damage_taken` override) +
 * scoped TL;DR buff wording + bug-fix detection → adjustment/low fallback.
 * The LLM never classifies. Abilities stay in `category`; entity types are
 * only champion | item | system (V1 taxonomy).
 */

import type { RawPatchChange } from "../../types";
import { classifyChange, normalizeAttribute } from "../../services/direction-map";
import { resolveLoLName } from "./aliases";

export type LolEntityType = "champion" | "item" | "system";

export interface LolParsedLine {
  readonly depth: number;
  readonly text: string;
  /**
   * Heading level 1-6 when known (always present in corpus lines produced
   * by `htmlToLines`). `##` (level 2) marks section boundaries; `###`
   * marks entities; `####` marks categories. Lines without a level fall
   * back to section-name matching, then to each section's default role.
   */
  readonly level?: number;
  readonly heading?: boolean;
  readonly quote?: boolean;
}

export interface ParseLoLInput {
  readonly block: unknown;
  readonly upstreamCommit: string | null;
  readonly aliasMap: ReadonlyMap<string, string>;
  readonly ddragonVersion?: string | null;
}

type Section = "none" | "champions" | "items" | "systems" | "bugfixes" | "excluded";

function normalizeHeading(text: string): string {
  return text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

const INCLUDE_PATTERNS: ReadonlyArray<{ pattern: RegExp; section: Section }> = [
  { pattern: /^champions$/, section: "champions" },
  { pattern: /^items$/, section: "items" },
  { pattern: /^systems?$/, section: "systems" },
  { pattern: /^bugfix(es)?(\s*&\s*qol.*)?$/, section: "bugfixes" },
];

const EXCLUDE_PATTERNS: ReadonlyArray<RegExp> = [
  /^aram(\s*:\s*mayhem)?$/,
  /^arena$/,
  /^classic$/,
  /^upcoming skins/,
  /^related articles?$/,
  /^patch highlights$/,
  /^team voice$/,
  /^ranked(\s+\S+)?$/,
  /^guests of honor$/,
];

/**
 * Classify a `##` heading: included V1 section, explicitly excluded
 * subtree, or unknown (skipped — missing facts beat false facts).
 */
export function sectionOf(text: string): Section | "unknown" {
  const normalized = normalizeHeading(text);
  for (const { pattern, section } of INCLUDE_PATTERNS) {
    if (pattern.test(normalized)) return section;
  }
  for (const pattern of EXCLUDE_PATTERNS) {
    if (pattern.test(normalized)) return "excluded";
  }
  return "unknown";
}

const BUGFIX_LEAD_PATTERN = /^\s*(fixed|fix\s+for|fix:)\b/i;
const INLINE_BUGFIX_PATTERN = /\bbug\s*fix\b/i;
const NEW_LEAD_PATTERN = /^\s*new\b/i;
const REWORK_PATTERN = /\brework(ed)?\b/i;
const REMOVAL_PATTERN = /\b(removed|no longer (?:stacks|exists)|has been removed)\b/i;
const NEGATIVE_VERB_PATTERN = /\b(decreased|reduced|nerf(s|ed)?|weaken(s|ed)?|slower|longer)\b/i;
const BUFF_SENTENCE_PATTERN = /\bbuff(s|ed)?\b/i;
const UNCHANGED_PATTERN = /\bunchanged\.?$/i;

/** Transition arrows: primary `⇒` plus deterministic alternates. */
const ARROW_PATTERN = /(⇒|→|->)/;
const NAMED_ARROW_PATTERN = /&(rArr|Rightarrow|rarr);|&#0*8658;|&#x0*21[Dd]2;/g;

/** Normalize named/numeric arrow entities to `⇒` before splitting. */
export function normalizeArrows(text: string): string {
  return text.replace(NAMED_ARROW_PATTERN, "⇒");
}

function toScalarNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/%/g, "")
    .replace(/\s*(seconds?|secs?|s|ms)\s*$/i, "")
    .trim();
  if (cleaned === "" || /[/()+*a-zA-Z]/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function detectUnit(raw: string): string | null {
  const match = /(-?\d+(?:\.\d+)?)\s*(%|seconds?|secs?|s|ms)\s*$/i.exec(raw.trim());
  if (!match?.[2]) return null;
  const unit = match[2].toLowerCase();
  if (unit.startsWith("sec")) return "s";
  if (unit === "s" || unit === "%") return unit;
  if (unit === "ms") return "ms";
  return unit;
}

const DASH_PATTERN = /[−–—]/g;
const NUMBER_PATTERN = /-?\d+(?:\.\d+)?/;

/** Leading numeric token (dashes normalized). Null when absent. */
export function leadingNumber(text: string): number | null {
  const match = NUMBER_PATTERN.exec(text.replace(DASH_PATTERN, "-"));
  if (!match) return null;
  const value = Number(match[0]);
  return Number.isFinite(value) ? value : null;
}

/** Trailing numeric token (dashes normalized). Null when absent. */
export function trailingNumber(text: string): number | null {
  const normalized = text.replace(DASH_PATTERN, "-");
  const pattern = new RegExp(NUMBER_PATTERN.source, "g");
  let last: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(normalized)) !== null) {
    last = match;
  }
  if (!last) return null;
  const value = Number(last[0]);
  return Number.isFinite(value) ? value : null;
}

function compareNumbers(oldValue: number | null, newValue: number | null): -1 | 0 | 1 {
  if (oldValue === null || newValue === null || oldValue === newValue) return 0;
  return newValue > oldValue ? 1 : -1;
}

export interface LolTransition {
  readonly oldText: string;
  readonly newText: string;
  readonly oldNumeric: number | null;
  readonly newNumeric: number | null;
  readonly unit: string | null;
  /** -1/0/1 from leading tokens, falling back to trailing tokens. */
  readonly direction: -1 | 0 | 1;
  /** True when leading and trailing components disagree (both decided). */
  readonly contradictory: boolean;
  readonly attributeSource: string;
}

/**
 * Parse "**Label**: OLD ⇒ NEW" transitions. Null when no arrow is present.
 * Full endpoint texts are preserved; numerics stay null unless the endpoint
 * parses as a clean scalar (never manufactured from formula fragments).
 */
export function extractLoLTransition(entry: string): LolTransition | null {
  const clean = normalizeArrows(entry);
  const arrow = ARROW_PATTERN.exec(clean);
  if (!arrow || arrow.index === undefined) return null;
  const left = clean.slice(0, arrow.index);
  const right = clean.slice(arrow.index + arrow[0].length);
  const colon = left.indexOf(":");
  let attributeSource: string;
  let oldRaw: string;
  if (colon > 0) {
    attributeSource = left.slice(0, colon);
    oldRaw = left.slice(colon + 1);
  } else {
    attributeSource = left;
    oldRaw = left;
  }
  const oldText = oldRaw.trim().slice(0, 300);
  const newText = right.trim().replace(/\.$/, "").slice(0, 300);
  if (oldText === "" || newText === "") return null;
  const leading = compareNumbers(leadingNumber(oldText), leadingNumber(newText));
  const trailing = compareNumbers(trailingNumber(oldText), trailingNumber(newText));
  return {
    oldText,
    newText,
    oldNumeric: toScalarNumber(oldText),
    newNumeric: toScalarNumber(newText),
    unit: detectUnit(oldText) ?? detectUnit(newText),
    direction: leading !== 0 ? leading : trailing,
    contradictory: leading !== 0 && trailing !== 0 && leading !== trailing,
    attributeSource,
  };
}

/** Attribute label: bold label before the colon, cleaned and bounded. */
export function guessLoLAttribute(transition: LolTransition): string | null {
  const label = transition.attributeSource.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  if (label === "") return null;
  return label.slice(0, 80);
}

function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+\s+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function introMentions(name: string, sentences: readonly string[]): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  return sentences.some((sentence) => BUFF_SENTENCE_PATTERN.test(sentence) && pattern.test(sentence));
}

const GENERIC_CATEGORIES = new Set(["general", "bugfix", "system", "base_stats"]);

/**
 * Scoped TL;DR buff hint: the category/ability itself (or, for generic
 * categories, the entity) must be named in a buff sentence. Entity-wide
 * wording alone never upgrades an unrelated row. Buff-only upgrade.
 */
function isBuffHinted(entityName: string, category: string, sentences: readonly string[]): boolean {
  if (introMentions(category, sentences)) return true;
  if (GENERIC_CATEGORIES.has(category.toLowerCase())) {
    return introMentions(entityName, sentences);
  }
  return false;
}

interface WalkState {
  section: Section | "unknown";
  entityType: LolEntityType | null;
  entityName: string | null;
  category: string | null;
  inBugFix: boolean;
}

interface EmitterShared {
  readonly upstreamCommit: string | null;
  readonly ddragonVersion: string | null;
  readonly aliasMap: ReadonlyMap<string, string>;
  readonly ordinalByKey: Map<string, number>;
}

function cleanHeader(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/[:\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function emitLeaf(entry: string, walk: WalkState, sentences: readonly string[], shared: EmitterShared): RawPatchChange | null {
  const text = entry.trim();
  if (text === "") return null;
  const transition = extractLoLTransition(text);
  const isBugfix = walk.inBugFix || BUGFIX_LEAD_PATTERN.test(text) || INLINE_BUGFIX_PATTERN.test(text);
  const isNew = NEW_LEAD_PATTERN.test(text);
  const isRemoval = REMOVAL_PATTERN.test(text);
  // Conservative core: only transition / bugfix / new / removal rows become
  // facts. Prose, Scoreboard-style lists, skin names, and "Unchanged" rows
  // (no transition by construction) are skipped, never guessed.
  if (transition === null && !isBugfix && !isNew && !isRemoval) return null;
  if (transition === null && UNCHANGED_PATTERN.test(text)) return null;

  const attribute = transition !== null ? guessLoLAttribute(transition) : null;
  const entityType = walk.entityType ?? "system";
  const entityName = walk.entityName ?? (walk.section === "bugfixes" ? "General" : "Systems");
  const category = walk.category ?? (walk.section === "bugfixes" ? "bugfix" : "general");

  let classification = classifyChange({
    attribute,
    direction: transition?.direction ?? 0,
    adapterKey: "lol",
    isNew,
    isRework: REWORK_PATTERN.test(text),
    isRemoval,
    isBugfix,
    contradictory: transition?.contradictory ?? false,
  });
  // Scoped TL;DR buff wording upgrades an adjustment/low fallback to
  // buff/low. Never overrides a decided class; never applies on negative
  // language. Nerf direction always comes from numerics/polarity.
  let tldrHint = false;
  const buffHinted = isBuffHinted(entityName, category, sentences);
  if (
    classification.changeType === "adjustment" &&
    classification.confidence === "low" &&
    buffHinted &&
    !NEGATIVE_VERB_PATTERN.test(text)
  ) {
    classification = { changeType: "buff", confidence: "low" };
    tldrHint = true;
  }

  const resolved = resolveLoLName(entityName, shared.aliasMap);
  const keyBase = [
    "lol",
    entityType,
    normalizeAttribute(resolved.entityKey ?? resolved.displayName),
    normalizeAttribute(category),
    normalizeAttribute(attribute ?? "general"),
  ].join(":");
  const ordinal = shared.ordinalByKey.get(keyBase) ?? 0;
  shared.ordinalByKey.set(keyBase, ordinal + 1);
  const stableKey = `${keyBase}:${ordinal}`;

  return {
    stableKey,
    entityType,
    entityName: resolved.displayName,
    entityKey: resolved.entityKey,
    category,
    attribute: attribute !== null ? normalizeAttribute(attribute) : null,
    description: text,
    oldText: transition?.oldText ?? null,
    newText: transition?.newText ?? null,
    oldNumeric: transition?.oldNumeric ?? null,
    newNumeric: transition?.newNumeric ?? null,
    unit: transition?.unit ?? null,
    changeType: classification.changeType,
    confidence: classification.confidence,
    metadata: {
      source_section: walk.section,
      entity_header: entityName,
      category_label: category,
      tldr_hint: tldrHint,
      ddragon_version: shared.ddragonVersion,
      upstream_commit: shared.upstreamCommit,
    },
  };
}

/** Parse one article block into raw changes. Never throws on data shape. */
export function parseLoLArticle(input: ParseLoLInput): RawPatchChange[] {
  const block = input.block as { lines?: unknown };
  if (typeof block !== "object" || block === null || !Array.isArray(block.lines)) return [];
  const lines = (block.lines as unknown[]).filter(
    (line): line is LolParsedLine =>
      typeof line === "object" &&
      line !== null &&
      typeof (line as { depth?: unknown }).depth === "number" &&
      typeof (line as { text?: unknown }).text === "string" &&
      ((line as { text: string }).text as string).length > 0
  );

  // TL;DR sentences come only from pre-section content (title, intro quote,
  // bylines): everything before the first `##` boundary. Designer quotes
  // inside sections are never hints or facts.
  const sentences: string[] = [];
  for (const line of lines) {
    if (line.heading && !line.quote) {
      if (line.level === 2) break;
      if (line.level === undefined && sectionOf(line.text) !== "unknown") break;
    }
    sentences.push(...splitSentences(line.text));
  }

  const out: RawPatchChange[] = [];
  const shared: EmitterShared = {
    upstreamCommit: input.upstreamCommit,
    ddragonVersion: input.ddragonVersion ?? null,
    aliasMap: input.aliasMap,
    ordinalByKey: new Map<string, number>(),
  };
  let walk: WalkState = { section: "none", entityType: null, entityName: null, category: null, inBugFix: false };

  const clearFor = (section: WalkState["section"]): WalkState => ({
    section,
    entityType: null,
    entityName: null,
    category: null,
    inBugFix: section === "bugfixes",
  });

  /** Apply an entity/category role for a non-`##` heading. */
  const applyRole = (header: string, level: number): void => {
    if (walk.section === "champions") {
      if (level <= 3) {
        // `###` champion entity.
        walk = { ...walk, entityType: "champion", entityName: header, category: "general" };
      } else {
        // `####` ability / Base Stats category. Abilities never entities.
        walk = { ...walk, category: header };
      }
    } else if (walk.section === "items") {
      // `###` item names and `####` group headers (e.g. multi-item
      // groups) both set the item entity; qualitative subsections under
      // them emit nothing because their rows carry no transition.
      walk = { ...walk, entityType: "item", entityName: header, category: "general" };
    } else if (walk.section === "systems") {
      // `####` system features are the entity; category stays general.
      walk = { ...walk, entityType: "system", entityName: header, category: "general" };
    } else if (walk.section === "bugfixes") {
      // Subheads inside bugfix sections become categories, never entities.
      walk = { ...walk, category: header };
    }
  };

  for (const line of lines) {
    if (line.quote) continue;
    if (line.heading && !line.quote) {
      if (line.level === 2) {
        // `##` boundary: whole-subtree section switch with cleared
        // context. Excluded and unknown subtrees are skipped wholesale —
        // never filtered per row.
        const section = sectionOf(line.text);
        walk = section === "unknown" ? clearFor("unknown") : clearFor(section);
        continue;
      }
      if (line.level === undefined) {
        // Un-leveled headings (synthetic/test input): recognized section
        // names still switch; anything else takes the default role below.
        // A recognized name always wins — entity names never collide with
        // the reserved section set in practice.
        const section = sectionOf(line.text);
        if (section !== "unknown") {
          walk = clearFor(section);
          continue;
        }
      }
      if (walk.section === "none" || walk.section === "excluded" || walk.section === "unknown") continue;
      const header = cleanHeader(line.text);
      if (header === "") continue;
      applyRole(header, line.level ?? 3);
      continue;
    }
    if (walk.section === "none" || walk.section === "excluded" || walk.section === "unknown") continue;

    const raw = emitLeaf(line.text, walk, sentences, shared);
    if (raw !== null) out.push(raw);
  }
  return out;
}
