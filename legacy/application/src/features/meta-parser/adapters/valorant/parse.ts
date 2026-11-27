/**
 * VALORANT patch-article parser (official Riot HTML articles).
 *
 * Input block: `{ lines: [{ depth, text }] }` produced from article HTML.
 * Sections are detected by keyword (editorial headings drift, so exact
 * names are never required). One leaf bullet → one RawPatchChange.
 *
 * Deterministic only: `>>>` numeric transitions + shared direction map
 * (adapterKey "valorant") + scoped TL;DR buff wording + bug-fix
 * detection → adjustment/low fallback. The LLM never classifies.
 * Ability names stay in `category`; entity types are only
 * agent | weapon | map | system (verified taxonomy).
 */

import type { RawPatchChange } from "../../types";
import { classifyChange, compareLevelValues, normalizeAttribute } from "../../services/direction-map";
import { resolveValorantName } from "./aliases";

export type ValorantEntityType = "agent" | "weapon" | "map" | "system";

export interface ValorantParsedLine {
  readonly depth: number;
  readonly text: string;
}

export interface ParseValorantInput {
  readonly block: unknown;
  readonly upstreamCommit: string | null;
  readonly aliasMap: ReadonlyMap<string, string>;
}

type Section =
  | "none"
  | "agents"
  | "weapons"
  | "maps"
  | "competitive"
  | "general"
  | "client"
  | "behavior"
  | "social"
  | "bugfixes"
  | "known";

const SECTION_PATTERNS: ReadonlyArray<{ pattern: RegExp; section: Section }> = [
  { pattern: /^agents?\s+updates?$/i, section: "agents" },
  { pattern: /^weapons?\s+updates?$/i, section: "weapons" },
  { pattern: /^maps?\s+updates?$/i, section: "maps" },
  { pattern: /^competitive\s+updates?$/i, section: "competitive" },
  { pattern: /^general\s+updates?$/i, section: "general" },
  { pattern: /^client\s+updates?$/i, section: "client" },
  { pattern: /^player\s+behavior\s+updates?$/i, section: "behavior" },
  { pattern: /^social\s+updates?$/i, section: "social" },
  { pattern: /^bug\s*fixes$/i, section: "bugfixes" },
  { pattern: /^known\s+issues$/i, section: "known" },
];

const PLATFORM_PATTERN = /^(all platforms|pc only|console only)\s*$/i;
const END_PATTERN = /^(related\s+articles?|show\s+more|privacy(\s+policy)?|terms(\s+of\s+service)?|cookie\s+preferences)\s*$/i;
const CAPTION_PATTERN = /^(before|after)\s*\(?(left|right)?\)?\s*(-*>|→)?\s*(after|before)?\s*\(?(left|right)?\)?\s*$/i;

const ARROW = ">>>";
const BUGFIX_LEAD_PATTERN = /^\s*(fixed|fix\s+for|fix:)\b/i;
const NEW_LEAD_PATTERN = /^\s*new\b/i;
const REWORK_PATTERN = /\brework(ed)?\b/i;
const REMOVAL_PATTERN = /\b(removed|no longer (?:stacks|exists)|has been removed)\b/i;
const VERB_PATTERN = /\b(increased|decreased|reduced|changed|improved|adjusted)\b/i;
const NEGATIVE_VERB_PATTERN = /\b(decreased|reduced|nerf(s|ed)?|weaken(s|ed)?|slower|longer)\b/i;
const BUFF_SENTENCE_PATTERN = /\bbuff(s|ed)?\b/i;

const GROUP_PATTERN = /^(general|agents?|weapons?|maps?|gameplay(\s+systems?)?|competitive|client|systems?)$/i;

function groupEntityType(header: string): ValorantEntityType {
  if (/^weapons?$/i.test(header)) return "weapon";
  if (/^maps?$/i.test(header)) return "map";
  if (/^agents?$/i.test(header)) return "agent";
  return "system";
}

/** Category label: lead phrase before a colon ("Map Rating: ..."). */
function headerCategory(header: string): string {
  const colon = header.indexOf(":");
  if (colon > 0) {
    const head = header.slice(0, colon).trim();
    if (head !== "" && head.length <= 48) return head.slice(0, 80);
  }
  return header.slice(0, 80);
}

const SECTION_LABELS: Readonly<Record<Exclude<Section, "none" | "known">, string>> = {
  agents: "Agents",
  weapons: "Weapons",
  maps: "Maps",
  competitive: "Competitive",
  general: "General",
  client: "Client",
  behavior: "Player Behavior",
  social: "Social",
  bugfixes: "Bug Fixes",
};

function sectionOf(text: string): Section | null {
  for (const { pattern, section } of SECTION_PATTERNS) {
    if (pattern.test(text)) return section;
  }
  return null;
}

interface TreeNode {
  text: string;
  children: TreeNode[];
}

function buildTree(lines: readonly ValorantParsedLine[]): TreeNode[] {
  const root: TreeNode[] = [];
  const stack: Array<{ depth: number; node: TreeNode }> = [];
  for (const line of lines) {
    const node: TreeNode = { text: line.text, children: [] };
    while (stack.length > 0 && (stack[stack.length - 1]?.depth ?? 0) >= line.depth) {
      stack.pop();
    }
    const parent = stack[stack.length - 1]?.node;
    if (parent) parent.children.push(node);
    else root.push(node);
    stack.push({ depth: line.depth, node });
  }
  return root;
}

function cleanHeader(text: string): string {
  return text
    .replace(/\*\*/g, "")
    .replace(/\s+MAP UPDATE\s*$/i, "")
    .replace(/[:\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function toScalarNumber(raw: string): number | null {
  const cleaned = raw
    .replace(/%/g, "")
    .replace(/\s*(seconds?|secs?|s|ms|meters?|m)\s*$/i, "")
    .trim();
  if (cleaned === "" || /[/()+*a-zA-Z]/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

function detectUnit(raw: string): string | null {
  const match = /(-?\d+(?:\.\d+)?)\s*(%|seconds?|secs?|s|ms|meters?|m)\s*$/i.exec(raw.trim());
  if (!match?.[2]) return null;
  const unit = match[2].toLowerCase();
  if (unit.startsWith("sec")) return "s";
  if (unit === "s" || unit === "%") return unit;
  if (unit.startsWith("meter") || unit === "m") return "m";
  if (unit === "ms") return "ms";
  return unit;
}

interface ArrowTransition {
  readonly oldText: string;
  readonly newText: string;
  readonly oldNumeric: number | null;
  readonly newNumeric: number | null;
  readonly unit: string | null;
  readonly attributeSource: string;
}

const VALUE_TOKEN_PATTERN = /(-?\d+(?:\.\d+)?\s*(?:%|seconds?|secs?|s|ms|meters?|m)?)\s*$/i;
const LEADING_VALUE_PATTERN = /^(-?\d+(?:\.\d+)?\s*(?:%|seconds?|secs?|s|ms|meters?|m)?)/i;

/** Parse "X from A >>> B" (or bare "A >>> B") transitions. Null when no arrow. */
function extractArrowTransition(clean: string): ArrowTransition | null {
  const arrowIndex = clean.indexOf(ARROW);
  if (arrowIndex < 0) return null;
  const left = clean.slice(0, arrowIndex);
  const right = clean.slice(arrowIndex + ARROW.length);
  const fromMatch = /\bfrom\b/i.exec(left);
  let attributeSource: string;
  let oldRaw: string;
  if (fromMatch?.index !== undefined) {
    attributeSource = left.slice(0, fromMatch.index);
    oldRaw = left.slice(fromMatch.index + 4);
  } else {
    const token = VALUE_TOKEN_PATTERN.exec(left);
    if (!token?.[1]) return null;
    oldRaw = token[1];
    attributeSource = left.slice(0, left.length - token[1].length);
  }
  const leading = LEADING_VALUE_PATTERN.exec(right.trim());
  const newRaw = leading?.[1] ?? right.trim();
  const oldText = oldRaw.trim().slice(0, 300);
  const newText = newRaw.trim().replace(/\.$/, "").slice(0, 300);
  if (oldText === "" || newText === "") return null;
  return {
    oldText,
    newText,
    oldNumeric: toScalarNumber(oldText),
    newNumeric: toScalarNumber(newText),
    unit: detectUnit(oldText) ?? detectUnit(newText),
    attributeSource,
  };
}

/** Attribute guess: text before the change verb (or arrow source), last words. */
function guessAttribute(clean: string, arrow: ArrowTransition | null): string | null {
  const source = arrow !== null ? arrow.attributeSource : clean;
  const verb = VERB_PATTERN.exec(arrow !== null ? arrow.attributeSource : clean);
  const before = verb && verb.index !== undefined && verb.index > 0 ? source.slice(0, verb.index) : source;
  const trimmed = before.replace(/[:(]+$/, "").trim();
  if (trimmed === "") return null;
  const words = trimmed.split(/\s+/).slice(-6).join(" ");
  return words === "" ? null : words.slice(0, 80);
}

function hasOpposingVerbs(clean: string): boolean {
  const up = /\b(increased|improved)\b/i.test(clean);
  const down = /\b(decreased|reduced)\b/i.test(clean);
  return up && down;
}

function introMentions(name: string, sentences: readonly string[]): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`\\b${escaped}\\b`, "i");
  return sentences.some((sentence) => BUFF_SENTENCE_PATTERN.test(sentence) && pattern.test(sentence));
}

const GENERIC_CATEGORIES = new Set(["general", "weapon", "bugfix", "map_pool", "system"]);

/**
 * Scoped TL;DR buff hint: the ability/category itself must be named in a
 * buff sentence ("...Double Tap", "...duration of Gatecrash"). Generic
 * categories fall back to the entity name. Entity-wide wording alone never
 * upgrades an unrelated ability (Fakeout stays adjustment/low).
 */
function isBuffHinted(entityName: string, category: string, sentences: readonly string[]): boolean {
  if (introMentions(category, sentences)) return true;
  if (GENERIC_CATEGORIES.has(category.toLowerCase())) {
    return introMentions(entityName, sentences);
  }
  return false;
}

interface EmitterContext {
  readonly entityType: ValorantEntityType;
  readonly entityName: string;
  readonly category: string;
  readonly section: Section;
  readonly inBugFix: boolean;
  readonly buffHinted: boolean;
  readonly upstreamCommit: string | null;
  readonly aliasMap: ReadonlyMap<string, string>;
  readonly ordinalByKey: Map<string, number>;
}

function emitRaw(entry: string, ctx: EmitterContext): RawPatchChange | null {
  if (entry === "") return null;
  const arrow = extractArrowTransition(entry);
  const attribute = guessAttribute(entry, arrow);
  const direction =
    arrow !== null ? compareLevelValues(arrow.oldText, arrow.newText) : 0;
  const isBugfix = ctx.inBugFix || BUGFIX_LEAD_PATTERN.test(entry);
  let classification = classifyChange({
    attribute,
    direction,
    adapterKey: "valorant",
    isNew: NEW_LEAD_PATTERN.test(entry),
    isRework: REWORK_PATTERN.test(entry),
    isRemoval: REMOVAL_PATTERN.test(entry),
    isBugfix,
    contradictory: hasOpposingVerbs(entry),
  });
  // Strong scoped source wording (TL;DR/intro "X buff ... ability"): a
  // hinted entity/ability with no negative language upgrades an
  // adjustment/low fallback to buff/low. Never overrides a decided class.
  let tldrHint = false;
  if (
    classification.changeType === "adjustment" &&
    classification.confidence === "low" &&
    ctx.buffHinted &&
    !NEGATIVE_VERB_PATTERN.test(entry)
  ) {
    classification = { changeType: "buff", confidence: "low" };
    tldrHint = true;
  }

  const resolved = resolveValorantName(ctx.entityName, ctx.aliasMap);
  const keyBase = [
    "valorant",
    ctx.entityType,
    normalizeAttribute(resolved.displayName),
    normalizeAttribute(ctx.category),
    normalizeAttribute(attribute ?? "general"),
  ].join(":");
  const ordinal = ctx.ordinalByKey.get(keyBase) ?? 0;
  ctx.ordinalByKey.set(keyBase, ordinal + 1);
  const stableKey = `${keyBase}:${ordinal}`;

  return {
    stableKey,
    entityType: ctx.entityType,
    entityName: resolved.displayName,
    entityKey: null,
    category: ctx.category,
    attribute: attribute !== null ? normalizeAttribute(attribute) : null,
    description: entry,
    oldText: arrow?.oldText ?? null,
    newText: arrow?.newText ?? null,
    oldNumeric: arrow?.oldNumeric ?? null,
    newNumeric: arrow?.newNumeric ?? null,
    unit: arrow?.unit ?? null,
    changeType: classification.changeType,
    confidence: classification.confidence,
    metadata: {
      source_section: ctx.section,
      entity_header: ctx.entityName,
      category_label: ctx.category,
      tldr_hint: tldrHint,
      upstream_commit: ctx.upstreamCommit,
    },
  };
}

type SharedEmitterContext = Omit<
  EmitterContext,
  "entityType" | "entityName" | "category" | "section" | "inBugFix" | "buffHinted"
>;

interface WalkContext {
  section: Section;
  entityType: ValorantEntityType | null;
  entityName: string | null;
  category: string | null;
  inBugFix: boolean;
  lastEntity: { type: ValorantEntityType; name: string } | null;
}

function defaultCategory(section: Section): string {
  switch (section) {
    case "weapons":
      return "weapon";
    case "bugfixes":
      return "bugfix";
    default:
      return "general";
  }
}

function inferBugfixType(ancestors: readonly string[]): ValorantEntityType {
  if (ancestors.some((text) => /^\s*maps?\s*$/i.test(text))) return "map";
  if (ancestors.some((text) => /^\s*weapons?\s*$/i.test(text))) return "weapon";
  return "agent";
}

/** Split pre-section intro text into sentences for scoped buff-hint matching. */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+\s+/)
    .map((part) => part.trim())
    .filter((part) => part !== "");
}

function introSentences(nodes: readonly TreeNode[]): string[] {
  const out: string[] = [];
  for (const node of nodes) {
    if (sectionOf(node.text) !== null || PLATFORM_PATTERN.test(node.text)) break;
    out.push(...splitSentences(node.text));
    for (const child of node.children) out.push(...splitSentences(child.text));
  }
  return out;
}

function emitLeaf(
  text: string,
  ancestors: readonly string[],
  walk: WalkContext,
  sentences: readonly string[],
  shared: SharedEmitterContext
): RawPatchChange | null {
  if (CAPTION_PATTERN.test(text) || END_PATTERN.test(text)) return null;
  let entityType = walk.entityType;
  let entityName = walk.entityName;
  let category = walk.category ?? defaultCategory(walk.section);
  let inBugFix = walk.inBugFix;

  if (walk.section === "bugfixes") {
    inBugFix = true;
    if (entityName === null) {
      if (walk.lastEntity !== null) {
        entityType = walk.lastEntity.type;
        entityName = walk.lastEntity.name;
      } else {
        entityType = inferBugfixType(ancestors);
        entityName = "General";
      }
    }
  }

  // Agents-section leaves without an entity header ("Killjoy Alarmbot ..."):
  // first capitalized token is the agent, remainder is the change.
  let entry = text;
  if (entityName === null && walk.section === "agents") {
    const headed = /^([A-Z][A-Za-z'’.\-]{1,30})\s+([\s\S]{10,})$/.exec(text);
    if (headed?.[1] && headed[2]) {
      entityType = "agent";
      entityName = headed[1];
      entry = headed[2];
      category = "general";
    }
  }
  if (entityName === null || entityType === null) {
    if (walk.section === "none") return null;
    entityType ??= "system";
    entityName ??= SECTION_LABELS[walk.section as keyof typeof SECTION_LABELS] ?? "General";
  }

  const buffHinted = isBuffHinted(entityName, category, sentences);
  return emitRaw(entry, { ...shared, entityType, entityName, category, section: walk.section, inBugFix, buffHinted });
}

function walkNodes(
  nodes: readonly TreeNode[],
  ancestors: readonly string[],
  walk: WalkContext,
  sentences: readonly string[],
  shared: SharedEmitterContext,
  out: RawPatchChange[]
): WalkContext {
  let current = walk;
  const setEntity = (type: ValorantEntityType, name: string): void => {
    current = { ...current, entityType: type, entityName: name };
    current.lastEntity = { type, name };
  };
  for (const node of nodes) {
    const section = sectionOf(node.text);
    if (section !== null) {
      if (section === "known") {
        current = { ...current, section };
        continue;
      }
      current = {
        ...current,
        section,
        entityType: null,
        entityName: null,
        category: null,
        inBugFix: section === "bugfixes",
        lastEntity: null,
      };
      current = walkNodes(node.children, [...ancestors, node.text], current, sentences, shared, out);
      continue;
    }
    if (PLATFORM_PATTERN.test(node.text)) continue;
    if (END_PATTERN.test(node.text)) break;
    if (current.section === "none" || current.section === "known") continue;
    if (CAPTION_PATTERN.test(node.text) && node.children.length === 0) continue;

    if (node.children.length > 0) {
      const header = cleanHeader(node.text);
      if (header === "") {
        current = walkNodes(node.children, ancestors, current, sentences, shared, out);
        continue;
      }
      if (/map\s+pool/i.test(header)) {
        setEntity("system", "Map Pool");
        current = walkNodes(
          node.children,
          [...ancestors, node.text],
          { ...current, category: "map_pool" },
          sentences,
          shared,
          out
        );
        current = { ...current, entityType: null, entityName: null, category: null };
        continue;
      }
      if (GROUP_PATTERN.test(header)) {
        // Grouping header ("General", "Weapons", "Maps"): entity context for
        // its subtree, cleared afterwards. Never a change itself.
        setEntity(groupEntityType(header), header);
        current = walkNodes(
          node.children,
          [...ancestors, node.text],
          { ...current, category: null },
          sentences,
          shared,
          out
        );
        current = { ...current, entityType: null, entityName: null, category: null, lastEntity: null };
        continue;
      }
      const entityEligible =
        (current.section === "agents" ||
          current.section === "weapons" ||
          current.section === "maps" ||
          current.section === "bugfixes") &&
        current.entityName === null &&
        header.split(/\s+/).length <= 4 &&
        !BUGFIX_LEAD_PATTERN.test(header) &&
        !header.includes(ARROW);
      if (entityEligible) {
        const headerType: ValorantEntityType =
          current.section === "weapons"
            ? "weapon"
            : current.section === "maps"
              ? "map"
              : current.section === "bugfixes"
                ? inferBugfixType([...ancestors, node.text])
                : "agent";
        setEntity(headerType, header);
        current = walkNodes(
          node.children,
          [...ancestors, node.text],
          { ...current, category: null },
          sentences,
          shared,
          out
        );
        current = { ...current, entityType: null, entityName: null, category: null };
        continue;
      }
      // Category-level header (abilities, map sub-areas, system features).
      // The active entity survives category subtrees; sibling entity
      // headers overwrite it and section changes clear it.
      const next = {
        ...current,
        entityType:
          current.entityType ??
          (current.section === "weapons"
            ? ("weapon" as const)
            : current.section === "maps"
              ? ("map" as const)
              : current.section === "agents"
                ? ("agent" as const)
                : ("system" as const)),
        entityName:
          current.entityName ??
          (current.section === "agents" || current.section === "weapons" || current.section === "maps"
            ? "General"
            : (SECTION_LABELS[current.section as keyof typeof SECTION_LABELS] ?? "General")),
        category: headerCategory(header),
      };
      current = walkNodes(node.children, [...ancestors, node.text], next, sentences, shared, out);
      current = { ...current, category: null };
      continue;
    }

    // Single-token leaves are dangling headers (e.g. "- Cypher" whose fixes
    // lost a nesting level): remember the entity, emit no change.
    if (/^\S+$/.test(node.text)) {
      if (
        current.section === "agents" ||
        current.section === "weapons" ||
        current.section === "maps" ||
        current.section === "bugfixes"
      ) {
        const header = cleanHeader(node.text);
        if (header !== "" && !BUGFIX_LEAD_PATTERN.test(header)) {
          const headerType: ValorantEntityType =
            current.section === "weapons"
              ? "weapon"
              : current.section === "maps"
                ? "map"
                : current.section === "bugfixes"
                  ? inferBugfixType(ancestors)
                  : "agent";
          current.lastEntity = { type: headerType, name: header };
        }
      }
      continue;
    }
    const raw = emitLeaf(node.text, ancestors, current, sentences, shared);
    if (raw !== null) {
      out.push(raw);
      if (current.entityName !== null && current.entityType !== null) {
        current.lastEntity = { type: current.entityType, name: current.entityName };
      }
    }
  }
  return current;
}

/** Parse one article block into raw changes. Never throws on data shape. */
export function parseValorantArticle(input: ParseValorantInput): RawPatchChange[] {
  const block = input.block as { lines?: unknown };
  if (typeof block !== "object" || block === null || !Array.isArray(block.lines)) return [];
  const lines = (block.lines as unknown[]).filter(
    (line): line is { depth: number; text: string } =>
      typeof line === "object" &&
      line !== null &&
      typeof (line as { depth?: unknown }).depth === "number" &&
      typeof (line as { text?: unknown }).text === "string" &&
      ((line as { text: string }).text as string).length > 0
  );
  const tree = buildTree(lines);
  const sentences = introSentences(tree);
  const out: RawPatchChange[] = [];
  const shared = {
    upstreamCommit: input.upstreamCommit,
    aliasMap: input.aliasMap,
    ordinalByKey: new Map<string, number>(),
  };
  walkNodes(
    tree,
    [],
    { section: "none", entityType: null, entityName: null, category: null, inBugFix: false, lastEntity: null },
    sentences,
    shared,
    out
  );
  return out;
}
