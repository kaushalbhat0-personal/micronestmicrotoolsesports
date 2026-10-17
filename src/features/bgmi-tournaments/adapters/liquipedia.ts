/**
 * BGMI Tournament Hub — Liquipedia adapter.
 *
 * The ONLY module that knows Liquipedia template syntax. Everything
 * downstream (validation, ingestion, reads, UI) consumes the normalized
 * `BgmiStageDataset` — never wikitext.
 *
 * Source contract (verified 2026-10-17, page `BGMI Masters Series/Season 5`,
 * rev 720523):
 * - Stage sections: `===Playoffs===`, `===Grand Finals===` containing one
 *   `{{Bracket|...|R1M1={{Match|...}}}}` block each.
 * - Scoring params on `{{Match}}`: `p_kill`, `p1..p8`.
 * - Per-map schedule: `|mapN={{Map|date=…|finished=…|map=…|vod=…}}`.
 * - Per-team cells: `|opponentN={{TeamOpponent|<name>|startingpoints=N
 *   |placement=N|mK={{MS|<placement>|<finishes>}}}}`; `{{MS|-}}` and
 *   `{{MS|-|}}` both mean the team sat out that map (group rotation).
 *   No other `MS` spelling is a sat-out — anything else unparseable
 *   fails the run closed.
 * - Smash Rule finals carry `|matchpoint=N` on `{{Match}}`.
 *
 * Anything outside this contract fails closed: the stage is rejected with
 * a descriptive error and the previous published data stays intact.
 */

import { integrationError } from "@/lib/errors";
import type { BgmiStageDataset } from "../types";
import { BGMI_FINISH_POINT_VALUE_2026, BGMI_POINTS_TABLE_2026, matchTotal } from "../services/points";
import { assertSafePageTitle, safeFetchLiquipediaJson } from "./safe-fetch";

export const LIQUIPEDIA_ADAPTER_VERSION = "1.0.0";
export const LIQUIPEDIA_PARSER_VERSION = "1.0.0";

/** Stages the adapter knows how to parse (bounded contract). */
export const SUPPORTED_STAGE_KEYS = ["playoffs", "grand-finals", "last-chance", "semi-finals"] as const;
export type SupportedStageKey = (typeof SUPPORTED_STAGE_KEYS)[number];

/**
 * Rotation-aware stages (BMPS-03): completed matches may list a strict
 * subset of bracket teams (K participants with placements exactly 1..K)
 * and every team must finish with an equal maps-played count.
 *
 * Explicit opt-in only — every other stage keeps the standard
 * full-participation contract (completed match = every bracket team
 * plays, placements exactly 1..N).
 */
export const ROTATION_STAGE_KEYS = ["semi-finals"] as const;
export type RotationStageKey = (typeof ROTATION_STAGE_KEYS)[number];

/**
 * True only for explicitly registered rotation contexts
 * (tournament + stage). Nothing else weakens validation.
 */
export function isRotationStage(tournamentSlug: string, stageSlug: string): boolean {
  if (tournamentSlug !== "bmps-2026") return false;
  return (ROTATION_STAGE_KEYS as readonly string[]).includes(stageSlug);
}

/**
 * Expected completed-map count per team for rotation stages that declare
 * one (audit-established). Enforced in ADDITION to the generic
 * all-teams-equal invariant — never instead of it.
 */
export const ROTATION_STAGE_EXPECTED_MAPS: Readonly<Record<string, number>> = {
  "bmps-2026/semi-finals": 16,
};

const STAGE_HEADINGS: Record<SupportedStageKey, { readonly heading: string; readonly name: string }> = {
  playoffs: { heading: "Playoffs", name: "Playoffs" },
  "grand-finals": { heading: "Grand Finals", name: "Grand Finals" },
  // Phase 1 (BMPS-02) registered Last Chance only; Phase 2 (BMPS-03) adds
  // Semi Finals group-rotation parsing/validation. Qualifiers and Survival
  // Stage remain out of scope and are NOT registered.
  "last-chance": { heading: "Last Chance", name: "Last Chance" },
  "semi-finals": { heading: "Semi Finals", name: "Semi Finals" },
};

export interface LiquipediaSourceSnapshot {
  readonly pageTitle: string;
  readonly wikitext: string;
  readonly revisionId: number | null;
  readonly lastUpdatedAt: string | null;
  readonly sourceUrl: string;
}

export function toSourceUrl(pageTitle: string): string {
  return `https://liquipedia.net/pubgmobile/${pageTitle.replace(/ /g, "_")}`;
}

export async function fetchTournamentSource(pageTitle: string): Promise<LiquipediaSourceSnapshot> {
  assertSafePageTitle(pageTitle);
  const [textRes, revRes] = await Promise.all([
    safeFetchLiquipediaJson({ action: "parse", page: pageTitle, prop: "wikitext" }),
    safeFetchLiquipediaJson({ action: "query", titles: pageTitle, prop: "revisions", rvprop: "ids|timestamp" }),
  ]);
  const wikitext = parseWikitextResponse(textRes, pageTitle);
  const { revisionId, lastUpdatedAt } = parseRevisionResponse(revRes);
  return { pageTitle, wikitext, revisionId, lastUpdatedAt, sourceUrl: toSourceUrl(pageTitle) };
}

function parseWikitextResponse(res: unknown, pageTitle: string): string {
  const root = res as { parse?: { wikitext?: string; title?: string } };
  const wikitext = root?.parse?.wikitext;
  if (typeof wikitext !== "string" || wikitext.length === 0) {
    throw integrationError(`Liquipedia page not found or empty: ${pageTitle}`);
  }
  return wikitext;
}

function parseRevisionResponse(res: unknown): { revisionId: number | null; lastUpdatedAt: string | null } {
  try {
    const root = res as { query?: { pages?: Array<{ revisions?: Array<{ revid?: number; timestamp?: string }> }> } };
    const pages = root?.query?.pages;
    const rev = Array.isArray(pages) ? pages[0]?.revisions?.[0] : undefined;
    return {
      revisionId: typeof rev?.revid === "number" ? rev.revid : null,
      lastUpdatedAt: typeof rev?.timestamp === "string" ? rev.timestamp : null,
    };
  } catch {
    return { revisionId: null, lastUpdatedAt: null };
  }
}

// ── Low-level template scanning ──────────────────────────────────

interface TemplateBlock {
  /** Full `{{...}}` text including braces. */
  readonly raw: string;
  /** Inner text between the outer braces. */
  readonly inner: string;
}

/** Extract the template block starting exactly at `start` (text[start..start+1] === "{{"). */
export function extractTemplateAt(text: string, start: number): TemplateBlock | null {
  if (text[start] !== "{" || text[start + 1] !== "{") return null;
  let depth = 0;
  let i = start;
  while (i < text.length - 1) {
    if (text[i] === "{" && text[i + 1] === "{") {
      depth += 1;
      i += 2;
      continue;
    }
    if (text[i] === "}" && text[i + 1] === "}") {
      depth -= 1;
      i += 2;
      if (depth === 0) return { raw: text.slice(start, i), inner: text.slice(start + 2, i - 2) };
      continue;
    }
    i += 1;
  }
  return null;
}

/** Find every top-level `{{Name|...}}` block (nested templates stay inside). */
export function findTemplates(text: string, name: string): TemplateBlock[] {
  const out: TemplateBlock[] = [];
  const needle = `{{${name}`;
  let from = 0;
  while (from < text.length) {
    const at = text.indexOf(needle, from);
    if (at === -1) return out;
    const after = text[at + needle.length] ?? "";
    // The name must end here: a longer template name (e.g. "MatchX" when
    // looking for "Match") must not match. Whitespace/newline after the
    // name (infobox style) is fine.
    if (/[A-Za-z0-9_]/.test(after)) {
      from = at + needle.length;
      continue;
    }
    const block = extractTemplateAt(text, at);
    if (!block) {
      from = at + needle.length;
      continue;
    }
    out.push(block);
    from = at + block.raw.length;
  }
  return out;
}

/** Split template inner text on top-level `|` (depth-0 only). */
export function splitParams(inner: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";
  let i = 0;
  while (i < inner.length) {
    const two = inner.slice(i, i + 2);
    if (two === "{{" || two === "[[") {
      depth += 1;
      current += two;
      i += 2;
      continue;
    }
    if ((two === "}}" || two === "]]") && depth > 0) {
      depth -= 1;
      current += two;
      i += 2;
      continue;
    }
    if (inner[i] === "|" && depth === 0) {
      parts.push(current);
      current = "";
      i += 1;
      continue;
    }
    current += inner[i];
    i += 1;
  }
  parts.push(current);
  return parts;
}

/** `key=value` params → map; bare positional params collected separately. */
export function parseParams(inner: string): { named: Map<string, string>; positional: string[] } {
  const named = new Map<string, string>();
  const positional: string[] = [];
  const parts = splitParams(inner);
  for (let index = 1; index < parts.length; index += 1) {
    const part = (parts[index] ?? "").trim();
    const eq = part.indexOf("=");
    const key = eq > 0 ? part.slice(0, eq).trim().toLowerCase() : "";
    if (eq > 0 && /^[a-z][a-z0-9_]*$/.test(key)) {
      named.set(key, part.slice(eq + 1).trim());
    } else {
      positional.push(part);
    }
  }
  return { named, positional };
}

// ── Section + infobox parsing ────────────────────────────────────

/** Extract the `===Heading===` section body (ends at the next H1–H3). */
export function extractSection(wikitext: string, heading: string): string | null {
  const lines = wikitext.split("\n");
  const marker = heading.trim().toLowerCase();
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? "").trim();
    const match = /^(=+)\s*(.+?)\s*\1\s*$/.exec(line);
    if (!match) continue;
    const level = match[1]?.length ?? 99;
    const title = (match[2] ?? "").trim().toLowerCase();
    if (start === -1) {
      if (level === 3 && title === marker) start = i + 1;
    } else if (level <= 3) {
      return lines.slice(start, i).join("\n");
    }
  }
  if (start === -1) return null;
  return lines.slice(start).join("\n");
}

/**
 * Stage-section location: the plain `===Heading===` form first, then the
 * Showdown-subpage form `=={{Stage|Heading}}==` (H2, template-titled).
 * The alternate is matched explicitly and case-insensitively against the
 * same heading — it cannot match any other section, and existing pages
 * (plain headings) resolve exactly as before.
 */
export function extractStageSection(wikitext: string, heading: string): string | null {
  const direct = extractSection(wikitext, heading);
  if (direct) return direct;
  const marker = heading.trim().toLowerCase();
  const lines = wikitext.split("\n");
  let start = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = (lines[i] ?? "").trim();
    const match = /^(=+)\s*(.+?)\s*\1\s*$/.exec(line);
    if (!match) continue;
    const level = match[1]?.length ?? 99;
    const title = (match[2] ?? "").trim();
    if (start === -1) {
      const stageForm = /^\{\{\s*stage\s*\|\s*(.+?)\s*\}\}$/i.exec(title);
      if (level === 2 && stageForm && (stageForm[1] ?? "").trim().toLowerCase() === marker) {
        start = i + 1;
      }
    } else if (level <= 2) {
      return lines.slice(start, i).join("\n");
    }
  }
  if (start === -1) return null;
  return lines.slice(start).join("\n");
}

function cleanWikiText(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/\[\[[^\]|]*\|([^\]]+)\]\]/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/\[https?:[^\s\]]+\s+([^\]]+)\]/g, "$1")
    .replace(/'''?/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface InfoboxMeta {
  readonly name: string | null;
  readonly tickerName: string | null;
  readonly shortName: string | null;
  readonly organizer: string | null;
  readonly startDate: string | null;
  readonly endDate: string | null;
}

export function parseInfoboxLeague(wikitext: string): InfoboxMeta {
  const blocks = findTemplates(wikitext, "Infobox league");
  const inner = blocks[0]?.inner ?? "";
  const { named } = parseParams(inner);
  const get = (key: string): string | null => {
    const raw = named.get(key);
    if (!raw) return null;
    const cleaned = cleanWikiText(raw);
    return cleaned === "" ? null : cleaned;
  };
  return {
    name: get("name"),
    tickerName: get("tickername"),
    shortName: get("shortname"),
    organizer: get("organizer"),
    startDate: get("sdate"),
    endDate: get("edate"),
  };
}

// ── Team identity ────────────────────────────────────────────────

export function normalizeTeamKey(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

export function displayTeamName(name: string): string {
  const base = name
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s*\((indian team|indian player|india)\)\s*$/i, "");
  return base
    .split(" ")
    .map((word) => (word.length === 0 ? word : word[0]?.toUpperCase() + word.slice(1)))
    .join(" ");
}

// ── Match / opponent parsing ─────────────────────────────────────

export interface ParsedMapCell {
  readonly mapName: string | null;
  readonly scheduledAt: string | null;
  readonly finished: boolean;
  readonly vodUrl: string | null;
}

export interface ParsedTeamCell {
  readonly teamName: string;
  readonly startingPoints: number;
  readonly sourcePlacement: number | null;
  /** matchNumber → { placement, finishes } | null (null = sat out). */
  readonly results: Map<number, { placement: number; finishes: number } | null>;
}

export interface ParsedMatchBlock {
  readonly finished: boolean;
  readonly placementPoints: number[];
  readonly finishPointValue: number;
  readonly matchPoint: number | null;
  readonly maps: Map<number, ParsedMapCell>;
  readonly teams: ParsedTeamCell[];
}

function parseStrictInt(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const trimmed = raw.trim();
  if (!/^-?\d+$/.test(trimmed)) return null;
  return Number.parseInt(trimmed, 10);
}

/** "2026-09-04 16:00 {{Abbr/IST}}" → ISO instant (IST = +05:30). Null when unparseable. */
export function parseMapDate(raw: string | undefined): string | null {
  if (!raw) return null;
  const match = /(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/.exec(raw);
  if (!match) return null;
  const [, y, mo, d, h, mi] = match;
  const instant = new Date(`${y}-${mo}-${d}T${h}:${mi}:00+05:30`);
  if (Number.isNaN(instant.getTime())) return null;
  return instant.toISOString();
}

/**
 * Strict sat-out spellings: `{{MS|-}}` (single dash) and `{{MS|-|}}`
 * (dash + empty second param) — both observed on the live BMPS 2026 Semi
 * Finals source, sometimes mixed in one bracket. Anything else —
 * including `{{MS|-|5}}`, `{{MS|5|-}}`, or bare `{{MS}}` — is NOT a
 * sat-out and fails closed downstream.
 */
export function isSatOutMsCell(raw: string): boolean {
  return /\{\{\s*MS\s*\|\s*-\s*(\|\s*)?\}\}/.test(raw);
}

/**
 * Upcoming/no-data cells: `{{MS||}}` or whitespace-only parameters.
 * Editors pre-create these for maps that have not been played yet —
 * they carry no result and must produce no result row (and must not
 * throw). Strictly narrower than sat-out: at least one parameter
 * position must exist, every positional must be blank, and no named
 * params may be present. Bare `{{MS}}` and any populated cell
 * (`{{MS|5|-}}`, `{{MS|foo}}`, …) are NOT empty and still fail closed.
 */
export function isEmptyMsCell(raw: string): boolean {
  const blocks = findTemplates(raw, "MS");
  const block = blocks[0];
  if (!block) return false;
  const { named, positional } = parseParams(block.inner);
  if (named.size > 0) return false;
  return positional.length > 0 && positional.every((part) => part.trim() === "");
}

function parseMsCell(raw: string): { placement: number; finishes: number } | null {
  const blocks = findTemplates(raw, "MS");
  const block = blocks[0];
  if (!block) return null;
  const { positional } = parseParams(block.inner);
  const first = (positional[0] ?? "").trim();
  if (first === "-" || first === "") return null;
  const placement = parseStrictInt(first);
  const finishes = parseStrictInt(positional[1] ?? "");
  if (placement === null || finishes === null) return null;
  return { placement, finishes };
}

function parseMapCell(raw: string): ParsedMapCell {
  const blocks = findTemplates(raw, "Map");
  const block = blocks[0];
  if (!block) return { mapName: null, scheduledAt: null, finished: false, vodUrl: null };
  const { named } = parseParams(block.inner);
  const vod = named.get("vod")?.trim() ?? "";
  return {
    mapName: named.get("map")?.trim() || null,
    scheduledAt: parseMapDate(named.get("date")),
    finished: (named.get("finished") ?? "").trim().toLowerCase() === "true",
    vodUrl: vod === "" ? null : vod,
  };
}

function parseTeamOpponent(raw: string): ParsedTeamCell {
  const blocks = findTemplates(raw, "TeamOpponent");
  const block = blocks[0];
  if (!block) throw integrationError("Match opponent is not a TeamOpponent block");
  const { named, positional } = parseParams(block.inner);
  const teamName = (positional[0] ?? "").trim();
  if (teamName === "") throw integrationError("TeamOpponent is missing its team name");
  const startingPoints = parseStrictInt(named.get("startingpoints") ?? "0") ?? 0;
  const sourcePlacement = parseStrictInt(named.get("placement") ?? undefined);
  const results = new Map<number, { placement: number; finishes: number } | null>();
  for (const [key, value] of named) {
    const m = /^m(\d+)$/.exec(key);
    if (!m) continue;
    const matchNumber = Number.parseInt(m[1] ?? "0", 10);
    if (!Number.isInteger(matchNumber) || matchNumber < 1 || matchNumber > 64) continue;
    const cell = parseMsCell(value);
    if (cell === null) {
      // Upcoming map with no data yet: skip silently (no result row).
      // A finished map left in this state fails later at completed-match
      // validation — gaps can never be published as results.
      if (value.trim() === "" || isEmptyMsCell(value)) continue;
      if (!isSatOutMsCell(value)) {
        throw integrationError(`Unparseable MS cell for team ${teamName} match ${matchNumber}`);
      }
    }
    results.set(matchNumber, cell);
  }
  return { teamName, startingPoints: Math.max(0, startingPoints), sourcePlacement, results };
}

export function parseMatchBlock(rawMatchInner: string): ParsedMatchBlock {
  const { named } = parseParams(rawMatchInner);
  const finished = (named.get("finished") ?? "").trim().toLowerCase() === "true";
  const placementPoints: number[] = [];
  for (let place = 1; place <= 8; place += 1) {
    const value = parseStrictInt(named.get(`p${place}`) ?? undefined);
    if (value === null) throw integrationError(`Match is missing placement points p${place}`);
    placementPoints.push(value);
  }
  const finishPointValue = parseStrictInt(named.get("p_kill") ?? undefined);
  if (finishPointValue === null) throw integrationError("Match is missing p_kill");
  const matchPoint = parseStrictInt(named.get("matchpoint") ?? undefined);
  const maps = new Map<number, ParsedMapCell>();
  const teams: ParsedTeamCell[] = [];
  for (const [key, value] of named) {
    const mapMatch = /^map(\d+)$/.exec(key);
    if (mapMatch) {
      maps.set(Number.parseInt(mapMatch[1] ?? "0", 10), parseMapCell(value));
      continue;
    }
    const oppMatch = /^opponent(\d+)$/.exec(key);
    if (oppMatch) teams.push(parseTeamOpponent(value));
  }
  if (teams.length === 0) throw integrationError("Match block contains no opponents");
  return { finished, placementPoints, finishPointValue, matchPoint, maps, teams };
}

// ── Dataset assembly ─────────────────────────────────────────────

export interface ParseStageOptions {
  readonly tournamentSlug: string;
  readonly tournamentName: string;
  readonly tournamentShortName: string;
  readonly seasonYear: number | null;
  readonly organizer: string | null;
  readonly startsOn: string | null;
  readonly endsOn: string | null;
  readonly sourceUrl: string;
  readonly sourcePage: string;
  readonly sourceRevision: number | null;
  readonly sourceLastUpdatedAt: string | null;
  readonly stageKey: SupportedStageKey;
  readonly nowIso?: string;
}

function tournamentStatus(startsOn: string | null, endsOn: string | null, nowIso: string): "upcoming" | "ongoing" | "completed" {
  if (startsOn && nowIso < startsOn) return "upcoming";
  if (endsOn && nowIso > endsOn) return "completed";
  if (startsOn && endsOn && nowIso >= startsOn && nowIso <= endsOn) return "ongoing";
  return "completed";
}

export function parseStageDataset(wikitext: string, options: ParseStageOptions): BgmiStageDataset {
  const stageDef = STAGE_HEADINGS[options.stageKey];
  const section = extractStageSection(wikitext, stageDef.heading);
  if (!section) throw integrationError(`Stage section not found: ${stageDef.heading}`);
  const bracketBlocks = findTemplates(section, "Bracket");
  if (bracketBlocks.length === 0) throw integrationError(`Stage has no Bracket block: ${stageDef.heading}`);
  const matchBlocks = findTemplates(bracketBlocks[0]?.inner ?? "", "Match");
  if (matchBlocks.length === 0) throw integrationError(`Stage Bracket has no Match block: ${stageDef.heading}`);
  const parsed = parseMatchBlock(matchBlocks[0]?.inner ?? "");

  const nowIso = options.nowIso ?? new Date().toISOString().slice(0, 10);
  const status = tournamentStatus(options.startsOn, options.endsOn, nowIso);

  const matchNumbers = [...parsed.maps.keys()].sort((a, b) => a - b);
  const maxMatch = matchNumbers.length === 0 ? 0 : (matchNumbers[matchNumbers.length - 1] ?? 0);

  const teams = parsed.teams.map((team) => {
    const canonical = normalizeTeamKey(team.teamName);
    const display = displayTeamName(team.teamName);
    return { canonicalName: canonical, displayName: display, shortName: display, logoUrl: null as string | null };
  });

  const matches = matchNumbers.map((matchNumber) => {
    const cell = parsed.maps.get(matchNumber);
    const isFinished = cell?.finished ?? parsed.finished;
    const results = parsed.teams.flatMap((team) => {
      const ms = team.results.get(matchNumber) ?? null;
      if (ms === null) return [];
      const total = matchTotal({
        placement: ms.placement,
        finishes: ms.finishes,
        table: parsed.placementPoints,
        finishPointValue: parsed.finishPointValue,
      });
      return [
        {
          teamCanonical: normalizeTeamKey(team.teamName),
          placement: ms.placement,
          finishes: ms.finishes,
          placementPoints: total.placementPoints,
          finishPoints: total.finishPoints,
          totalPoints: total.total,
        },
      ];
    });
    return {
      matchNumber,
      mapName: cell?.mapName ?? null,
      scheduledAt: cell?.scheduledAt ?? null,
      status: (isFinished ? "completed" : "scheduled") as "scheduled" | "completed",
      vodUrl: cell?.vodUrl ?? null,
      results,
    };
  });

  const completedCount = matches.filter((m) => m.status === "completed").length;
  const stageStatus: "upcoming" | "ongoing" | "completed" =
    maxMatch === 0 || completedCount === 0 ? "upcoming" : completedCount === maxMatch ? "completed" : "ongoing";

  const smashRule = parsed.matchPoint !== null;
  const teamCount = teams.length;
  const dateRange =
    matches.length > 0
      ? `${teamCount} teams · ${maxMatch} matches`
      : `${teamCount} teams`;

  return {
    tournament: {
      slug: options.tournamentSlug,
      name: options.tournamentName,
      shortName: options.tournamentShortName,
      seasonYear: options.seasonYear,
      organizer: options.organizer,
      startsOn: options.startsOn,
      endsOn: options.endsOn,
      rulebookUrl: null,
      sourceUrl: options.sourceUrl,
      sourcePage: options.sourcePage,
      sourceRevision: options.sourceRevision,
      sourceLastUpdatedAt: options.sourceLastUpdatedAt,
      status,
    },
    stage: {
      slug: options.stageKey,
      name: stageDef.name,
      formatNote: dateRange,
      status: stageStatus,
      smashRule,
      matchPointThreshold: parsed.matchPoint,
      sourceUrl: options.sourceUrl,
      sourceRevision: options.sourceRevision,
    },
    teams,
    entries: parsed.teams.map((team) => ({
      teamCanonical: normalizeTeamKey(team.teamName),
      startingPoints: team.startingPoints,
      sourcePlacement: team.sourcePlacement,
    })),
    matches,
    scoring: {
      placementPoints: [...parsed.placementPoints],
      finishPointValue: parsed.finishPointValue,
    },
  };
}

export interface TournamentCatalogEntry {
  readonly slug: string;
  readonly name: string;
  readonly shortName: string;
  readonly seasonYear: number | null;
  /** Exact Liquipedia page title backing this tournament. */
  readonly sourcePage: string;
  /** Stage keys supported for this tournament (subset of SUPPORTED_STAGE_KEYS). */
  readonly stages: readonly SupportedStageKey[];
  /**
   * Deterministic metadata fallback for subpage sources that carry no
   * `{{Infobox league}}` (Showdown stage subpages). Used only when the
   * fetched snapshot provides no value — never inferred at runtime.
   */
  readonly metadataFallback?: {
    readonly organizer: string | null;
    readonly startsOn: string | null;
    readonly endsOn: string | null;
  };
}

/**
 * Bounded tournament catalog — the ONLY tournaments ingestion may fetch.
 * Adding a tournament is a data change here plus a verification run; the
 * fetcher cannot be pointed at arbitrary pages.
 */
export const TOURNAMENT_CATALOG: readonly TournamentCatalogEntry[] = [
  {
    slug: "bmsd-2026",
    name: "BGMI Masters Series 2026",
    shortName: "BMSD 2026",
    seasonYear: 2026,
    sourcePage: "BGMI Masters Series/Season 5",
    stages: ["grand-finals", "playoffs"],
  },
  {
    // Phase 2 (BMPS-03): Grand Finals + Last Chance + Semi Finals.
    // Qualifiers (multi-bracket promotion/relegation) and Survival Stage
    // remain excluded — structurally unrepresentable / out of scope.
    slug: "bmps-2026",
    name: "BGMI Pro Series 2026",
    shortName: "BMPS 2026",
    seasonYear: 2026,
    sourcePage: "Battlegrounds Mobile India Pro Series/2026",
    stages: ["grand-finals", "last-chance", "semi-finals"],
  },
  {
    // Showdown-02: ongoing Showdown Grand Finals experiment. The stage
    // lives on a dedicated subpage (no infobox there), so catalog-carried
    // metadata applies. Slug deliberately avoids the `bmsd-2026` prefix,
    // which belongs to the BGMI Masters Series.
    slug: "bgmi-showdown-2026",
    name: "Battlegrounds Mobile India Showdown 2026",
    shortName: "Showdown 2026",
    seasonYear: 2026,
    sourcePage: "Battlegrounds Mobile India Showdown/2026/Grand Finals",
    stages: ["grand-finals"],
    metadataFallback: {
      organizer: "KRAFTON",
      startsOn: "2026-09-22",
      endsOn: "2026-10-18",
    },
  },
];

export function getCatalogEntry(tournamentSlug: string): TournamentCatalogEntry | null {
  return TOURNAMENT_CATALOG.find((entry) => entry.slug === tournamentSlug) ?? null;
}

/** Parse one catalogued tournament+stage from a fetched snapshot. */
export function parseTournamentStage(
  snapshot: LiquipediaSourceSnapshot,
  entry: TournamentCatalogEntry,
  stageKey: SupportedStageKey,
  nowIso?: string
): BgmiStageDataset {
  const meta = parseInfoboxLeague(snapshot.wikitext);
  const seasonYear = entry.seasonYear ?? parseSeasonYear(meta.name);
  const fallback = entry.metadataFallback;
  return parseStageDataset(snapshot.wikitext, {
    tournamentSlug: entry.slug,
    tournamentName: meta.name ?? entry.name,
    tournamentShortName: entry.shortName,
    seasonYear,
    organizer: meta.organizer ?? fallback?.organizer ?? null,
    startsOn: meta.startDate ?? fallback?.startsOn ?? null,
    endsOn: meta.endDate ?? fallback?.endsOn ?? null,
    sourceUrl: snapshot.sourceUrl,
    sourcePage: snapshot.pageTitle,
    sourceRevision: snapshot.revisionId,
    sourceLastUpdatedAt: snapshot.lastUpdatedAt,
    stageKey,
    ...(nowIso !== undefined ? { nowIso } : {}),
  });
}

function parseSeasonYear(name: string | null): number | null {
  if (!name) return null;
  const match = /(19|20)\d{2}/.exec(name);
  return match ? Number.parseInt(match[0], 10) : null;
}

/** Canonical table guard — source-declared scoring must match 2026 rules. */
export function assertCanonicalScoring(dataset: BgmiStageDataset): void {
  const { placementPoints, finishPointValue } = dataset.scoring;
  const expected = [...BGMI_POINTS_TABLE_2026];
  const matches =
    finishPointValue === BGMI_FINISH_POINT_VALUE_2026 &&
    placementPoints.length === expected.length &&
    placementPoints.every((value, index) => value === expected[index]);
  if (!matches) {
    throw integrationError(
      `Source scoring table changed (p1..p8=${placementPoints.join(",")}, p_kill=${finishPointValue}); refusing to ingest`
    );
  }
}
