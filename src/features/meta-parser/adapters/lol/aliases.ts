/**
 * League of Legends alias resolution via Riot Data Dragon (keyless static
 * JSON). Canonical display names come from patch headings in situ; Data
 * Dragon supplies the stable IDs (champion `id`, item numeric id) used as
 * `entityKey` and as the stable-key base.
 *
 * Verified edge cases (live audit): Wukong → MonkeyKing, Nunu & Willump →
 * Nunu, K'Sante → KSante, Kai'Sa → Kaisa, Cho'Gath → Chogath, Rek'Sai →
 * RekSai, Dr. Mundo → DrMundo, Bel'Veth → Belveth, Kha'Zix → Khazix,
 * Vel'Koz → Velkoz, LeBlanc → Leblanc, Renata Glasc → Renata,
 * Lee Sin → LeeSin, Miss Fortune → MissFortune, Twisted Fate → TwistedFate.
 *
 * Lookup is exact normalized match only (no fuzzy matching). Unknown
 * headings fall back to the cleaned heading with a null key — the shared
 * pipeline seeds observed names per game. Alias storage stays game-scoped
 * via the shared `(game_slug, entity_normalized)` constraint.
 */

import { validationError } from "@/lib/errors";
import { normalizeEntityName } from "../../services/entity-normalize";
import { safeFetchText } from "../../services/safe-fetch";
import {
  LOL_ALLOWED_HOSTS,
  LOL_DDRAGON_MAX_BYTES,
  lolDdragonDatasetUrl,
  lolDdragonVersionsUrl,
} from "./sources";

export type LolAliasHit = "canonical" | "fallback";

export interface LolAliasResolution {
  readonly displayName: string;
  readonly entityKey: string | null;
  readonly normalized: string;
  readonly hit: LolAliasHit;
}

/** Run-local Data Dragon alias bundle (map + the pinned source version). */
export interface LolAliasFetch {
  readonly aliasMap: ReadonlyMap<string, string>;
  readonly aliasVersion: string;
}

/**
 * Deterministic version-selection rule: `versions.json` is served newest
 * first, so the run pins index 0 — fetched once at run start and reused
 * for every dataset in that run (never switched mid-run, never hardcoded).
 * V1 ingests only latest-era patches, whose names the latest dataset
 * covers; article-era artwork lag does not affect names.
 */
export function selectDdragonVersion(versions: unknown): string {
  if (!Array.isArray(versions) || versions.length === 0) {
    throw validationError("LoL Data Dragon versions index is empty");
  }
  const latest = versions[0];
  if (typeof latest !== "string" || !/^\d+\.\d+\.\d+$/.test(latest)) {
    throw validationError("LoL Data Dragon versions index has an unexpected shape");
  }
  return latest;
}

export interface DdragonChampionEntry {
  readonly id: string;
  readonly name: string;
}

export interface DdragonItemEntry {
  readonly id: string;
  readonly name: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Parse champion.json `data` into valid entries, skipping malformed rows. */
export function parseChampionEntries(payload: unknown): DdragonChampionEntry[] {
  if (!isRecord(payload) || !isRecord(payload["data"])) return [];
  const out: DdragonChampionEntry[] = [];
  for (const row of Object.values(payload["data"])) {
    if (!isRecord(row) || typeof row["id"] !== "string" || typeof row["name"] !== "string") continue;
    const id = row["id"].trim();
    const name = row["name"].trim();
    if (id === "" || name === "") continue;
    out.push({ id, name });
  }
  return out;
}

/** Parse item.json `data` into valid entries, skipping malformed rows. */
export function parseItemEntries(payload: unknown): DdragonItemEntry[] {
  if (!isRecord(payload) || !isRecord(payload["data"])) return [];
  const out: DdragonItemEntry[] = [];
  for (const [key, row] of Object.entries(payload["data"])) {
    if (!isRecord(row) || typeof row["name"] !== "string") continue;
    const name = (row["name"] as string).trim();
    if (name === "") continue;
    out.push({ id: key, name });
  }
  return out;
}

/**
 * Build the LoL alias map: normalized display name → stable Data Dragon ID.
 * Champion names win on collision (champions are the primary V1 entity);
 * item entries fill remaining keys. Normalized IDs map to themselves so
 * link slugs and dataset keys resolve without invention.
 */
export function buildLoLAliasMap(
  champions: readonly DdragonChampionEntry[],
  items: readonly DdragonItemEntry[]
): ReadonlyMap<string, string> {
  const map = new Map<string, string>();
  for (const entry of champions) {
    const byName = normalizeEntityName(entry.name);
    if (byName !== "" && !map.has(byName)) map.set(byName, entry.id);
    const byId = normalizeEntityName(entry.id);
    if (byId !== "" && !map.has(byId)) map.set(byId, entry.id);
  }
  for (const entry of items) {
    const byName = normalizeEntityName(entry.name);
    if (byName !== "" && !map.has(byName)) map.set(byName, entry.id);
  }
  return map;
}

/** Strip markdown/bold remnants and collapse whitespace (keeps casing). */
export function canonicalizeLoLName(raw: string): string {
  return raw
    .replace(/\*\*/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/**
 * Resolve a patch heading: display name stays the cleaned heading (patch
 * notes use display names); stable key comes from the Data Dragon ID when
 * the normalized heading hits the map, else null (heading fallback).
 */
export function resolveLoLName(
  heading: string,
  aliasMap: ReadonlyMap<string, string>
): LolAliasResolution {
  const canonical = canonicalizeLoLName(heading);
  if (canonical === "") return { displayName: heading, entityKey: null, normalized: "", hit: "fallback" };
  const hit = aliasMap.get(canonical) ?? aliasMap.get(normalizeEntityName(canonical));
  if (hit !== undefined) {
    return { displayName: canonical, entityKey: hit, normalized: normalizeEntityName(hit), hit: "canonical" };
  }
  return { displayName: canonical, entityKey: null, normalized: normalizeEntityName(canonical), hit: "fallback" };
}

async function fetchDdragonJson(url: string): Promise<unknown> {
  const result = await safeFetchText(url, {
    allowedHosts: LOL_ALLOWED_HOSTS,
    maxBytes: LOL_DDRAGON_MAX_BYTES,
    accept: "application/json",
  });
  try {
    return JSON.parse(result.body) as unknown;
  } catch {
    throw validationError("LoL Data Dragon resource is not valid JSON");
  }
}

/**
 * Fetch + pin the Data Dragon version for this run, then build the alias
 * map from that pinned version's champion/item datasets. The returned
 * bundle keeps the map and its source version together so the caller can
 * thread both run-locally — no module-global pin exists, so a failed
 * versions lookup cannot resurrect a previous run's pin and concurrent
 * runs cannot cross-contaminate metadata. Throws on versions-index
 * failure (the pipeline degrades to heading fallback with a null
 * version); malformed dataset rows are skipped, never fatal.
 */
export async function fetchLoLAliasMap(): Promise<LolAliasFetch> {
  // Clear-before-fetch is structural now: failure throws before any bundle
  // exists, so no stale pin can survive — there is nowhere to store one.
  const versions = await fetchDdragonJson(lolDdragonVersionsUrl());
  const pinned = selectDdragonVersion(versions);
  const [championsPayload, itemsPayload] = await Promise.all([
    fetchDdragonJson(lolDdragonDatasetUrl(pinned, "champion")),
    fetchDdragonJson(lolDdragonDatasetUrl(pinned, "item")),
  ]);
  return {
    aliasMap: buildLoLAliasMap(parseChampionEntries(championsPayload), parseItemEntries(itemsPayload)),
    aliasVersion: pinned,
  };
}
