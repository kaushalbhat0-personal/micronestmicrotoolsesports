/**
 * Dota 2 adapter — dotaconstants structured corpus behind the shared contract.
 *
 * Discovery: patch.json (KBs, every run). Corpus: patchnotes.json (~2.6 MB,
 * only when discovery proves a target patch is missing or when hashing).
 * Fallback: OpenDota /api/constants/patchnotes. Aliases: /api/heroes.
 */

import { createHash } from "node:crypto";
import { z } from "zod";
import { validationError } from "@/lib/errors";
import { parseOrThrow } from "@/lib/validation";
import { safeFetchText } from "../../services/safe-fetch";
import type { RawPatchChange } from "../../types";
import { buildAliasMap, CHECKED_IN_ALIASES } from "./hero-aliases";
import { parsePatchIndex } from "./discovery";
import { parseDotaPatchBlock } from "./parse";
import {
  DOTA_ADAPTER_KEY,
  DOTA_ADAPTER_VERSION,
  DOTA_ALLOWED_HOSTS,
  DOTA_GAME_SLUG,
  DOTA_HEROES_URL,
  DOTA_PARSER_VERSION,
  DOTA_PATCHNOTES_FALLBACK_URL,
  DOTA_PATCHNOTES_MAX_BYTES,
  DOTA_PATCHNOTES_URL,
  DOTA_PATCH_INDEX_MAX_BYTES,
  DOTA_PATCH_INDEX_URL,
  valveProvenanceUrl,
  versionToDatasetKey,
} from "./sources";
import type { CorpusFetch, DiscoveredPatch, MetaParserAdapter } from "../registry";

const heroesRowSchema = z.object({ name: z.string(), localized_name: z.string() });
const heroesResponseSchema = z.array(heroesRowSchema);

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

async function fetchPrimaryIndex(): Promise<string> {
  const result = await safeFetchText(DOTA_PATCH_INDEX_URL, {
    allowedHosts: DOTA_ALLOWED_HOSTS,
    maxBytes: DOTA_PATCH_INDEX_MAX_BYTES,
    accept: "application/json",
  });
  return result.body;
}

async function fetchPrimaryCorpus(): Promise<CorpusFetch> {
  const result = await safeFetchText(DOTA_PATCHNOTES_URL, {
    allowedHosts: DOTA_ALLOWED_HOSTS,
    maxBytes: DOTA_PATCHNOTES_MAX_BYTES,
    accept: "application/json",
  });
  return { text: result.body, upstreamCommit: result.etag, viaFallback: false };
}

async function fetchFallbackCorpus(): Promise<CorpusFetch> {
  const result = await safeFetchText(DOTA_PATCHNOTES_FALLBACK_URL, {
    allowedHosts: DOTA_ALLOWED_HOSTS,
    maxBytes: DOTA_PATCHNOTES_MAX_BYTES,
    accept: "application/json",
  });
  return { text: result.body, upstreamCommit: result.etag, viaFallback: true };
}

export const dota2Adapter: MetaParserAdapter = {
  adapterKey: DOTA_ADAPTER_KEY,
  gameSlug: DOTA_GAME_SLUG,
  parserVersion: DOTA_PARSER_VERSION,
  adapterVersion: DOTA_ADAPTER_VERSION,

  async discover(): Promise<{ patches: readonly DiscoveredPatch[]; latest: DiscoveredPatch }> {
    const body = await fetchPrimaryIndex();
    let parsed: unknown;
    try {
      parsed = JSON.parse(body) as unknown;
    } catch {
      throw validationError("Dota patch index is not valid JSON");
    }
    const discovery = parsePatchIndex(parsed);
    const patches: DiscoveredPatch[] = discovery.entries.map((entry) => {
      const datasetKey = versionToDatasetKey(entry.version);
      if (datasetKey === null) throw new Error(`Unmappable patch version: ${entry.version}`);
      return {
        version: entry.version,
        releasedAt: entry.releasedAt,
        upstreamId: entry.upstreamId,
        datasetKey,
      };
    });
    const latestEntry = discovery.latest;
    const latestKey = versionToDatasetKey(latestEntry.version);
    if (latestKey === null) throw new Error(`Unmappable patch version: ${latestEntry.version}`);
    return {
      patches,
      latest: {
        version: latestEntry.version,
        releasedAt: latestEntry.releasedAt,
        upstreamId: latestEntry.upstreamId,
        datasetKey: latestKey,
      },
    };
  },

  async fetchCorpus(): Promise<CorpusFetch> {
    try {
      return await fetchPrimaryCorpus();
    } catch {
      return fetchFallbackCorpus();
    }
  },

  async fetchAliasMap(): Promise<ReadonlyMap<string, string>> {
    const result = await safeFetchText(DOTA_HEROES_URL, {
      allowedHosts: DOTA_ALLOWED_HOSTS,
      maxBytes: 256 * 1024,
      accept: "application/json",
    });
    const rows = parseOrThrow(heroesResponseSchema, JSON.parse(result.body) as unknown);
    const live = buildAliasMap(rows);
    // Live map wins; checked-in covers any key missing upstream.
    return new Map([...CHECKED_IN_ALIASES, ...live]);
  },

  extractPatchBlock(corpusText: string, datasetKey: string): { block: unknown; blockHash: string } {
    let corpus: unknown;
    try {
      corpus = JSON.parse(corpusText) as unknown;
    } catch {
      throw validationError("Dota patch corpus is not valid JSON");
    }
    if (typeof corpus !== "object" || corpus === null || Array.isArray(corpus)) {
      throw validationError("Dota patch corpus has an unexpected shape");
    }
    const block = (corpus as Record<string, unknown>)[datasetKey];
    if (block === undefined) {
      throw validationError(`Dota patch ${datasetKey} not found in corpus`);
    }
    return { block, blockHash: sha256Hex(JSON.stringify(block)) };
  },

  parseBlock(
    block: unknown,
    opts: { upstreamCommit: string | null; aliasMap: ReadonlyMap<string, string> }
  ): RawPatchChange[] {
    if (typeof block !== "object" || block === null || Array.isArray(block)) {
      return [];
    }
    return parseDotaPatchBlock({
      block: block as { general?: unknown; items?: unknown; heroes?: unknown },
      upstreamCommit: opts.upstreamCommit,
      aliasMap: opts.aliasMap,
    });
  },

  sourceUrlFor(version: string): string {
    return valveProvenanceUrl(version);
  },
};

export { DOTA_ADAPTER_VERSION, DOTA_PARSER_VERSION };
