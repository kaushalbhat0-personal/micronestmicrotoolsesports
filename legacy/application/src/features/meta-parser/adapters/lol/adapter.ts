/**
 * League of Legends adapter — official Riot patch-note articles behind the
 * shared contract.
 *
 * Discovery: listing page (~511 KB measured, every run). Corpus: newest
 * article pages as structured text lines (bounded window, only when
 * discovery proves a target patch is missing or when hashing). Aliases:
 * Riot Data Dragon (keyless, version-pinned per run). No fallback source,
 * no browser, no LLM.
 */

import { createHash } from "node:crypto";
import { validationError } from "@/lib/errors";
import { safeFetchText } from "../../services/safe-fetch";
import type { RawPatchChange } from "../../types";
import { htmlToLines } from "./html";
import { latestNPatchVersions, parseListingHtml } from "./discovery";
import { parseLoLArticle } from "./parse";
import { fetchLoLAliasMap } from "./aliases";
import {
  LOL_ADAPTER_KEY,
  LOL_ADAPTER_VERSION,
  LOL_ALLOWED_HOSTS,
  LOL_CORPUS_PAGES_MAX,
  LOL_GAME_SLUG,
  LOL_PARSER_VERSION,
  LOL_PATCH_INDEX_MAX_BYTES,
  LOL_PATCH_INDEX_URL,
  LOL_PATCH_PAGE_MAX_BYTES,
  isLoLArticlePath,
  lolPatchUrl,
} from "./sources";
import type { AliasFetch, CorpusFetch, DiscoveredPatch, MetaParserAdapter } from "../registry";

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const lolAdapter: MetaParserAdapter = {
  adapterKey: LOL_ADAPTER_KEY,
  gameSlug: LOL_GAME_SLUG,
  parserVersion: LOL_PARSER_VERSION,
  adapterVersion: LOL_ADAPTER_VERSION,

  async discover(): Promise<{ patches: readonly DiscoveredPatch[]; latest: DiscoveredPatch }> {
    const result = await safeFetchText(LOL_PATCH_INDEX_URL, {
      allowedHosts: LOL_ALLOWED_HOSTS,
      maxBytes: LOL_PATCH_INDEX_MAX_BYTES,
      accept: "text/html",
    });
    const discovery = parseListingHtml(result.body);
    return {
      patches: discovery.entries.map((entry) => ({
        version: entry.version,
        releasedAt: entry.releasedAt,
        upstreamId: entry.upstreamId,
        datasetKey: entry.datasetKey,
      })),
      latest: {
        version: discovery.latest.version,
        releasedAt: discovery.latest.releasedAt,
        upstreamId: discovery.latest.upstreamId,
        datasetKey: discovery.latest.datasetKey,
      },
    };
  },

  async fetchCorpus(): Promise<CorpusFetch> {
    const index = await safeFetchText(LOL_PATCH_INDEX_URL, {
      allowedHosts: LOL_ALLOWED_HOSTS,
      maxBytes: LOL_PATCH_INDEX_MAX_BYTES,
      accept: "text/html",
    });
    const discovery = parseListingHtml(index.body);
    const targets = latestNPatchVersions(discovery, LOL_CORPUS_PAGES_MAX);
    const pages: Record<string, { lines: Array<{ depth: number; text: string; heading?: boolean; quote?: boolean }> }> = {};
    for (const target of targets) {
      // Defense in depth: discovery already constrains the shape, but the
      // article path is revalidated before every outbound fetch.
      const article = new URL(target.articleUrl);
      if (!isLoLArticlePath(article.pathname)) {
        throw validationError(`LoL article path rejected: ${article.pathname}`);
      }
      const page = await safeFetchText(target.articleUrl, {
        allowedHosts: LOL_ALLOWED_HOSTS,
        maxBytes: LOL_PATCH_PAGE_MAX_BYTES,
        accept: "text/html",
      });
      pages[target.datasetKey] = { lines: htmlToLines(page.body) };
    }
    return { text: JSON.stringify(pages), upstreamCommit: null, viaFallback: false };
  },

  async fetchAliasMap(): Promise<AliasFetch> {
    // Riot Data Dragon, version-pinned per run (see aliases.ts). The bundle
    // carries the run-local pin alongside the map, so concurrent
    // same-process ingestions can never cross-contaminate metadata.
    // Throws on versions-index failure; the shared pipeline degrades to
    // heading fallback with a null version. Malformed dataset rows are
    // skipped, never fatal.
    return fetchLoLAliasMap();
  },

  extractPatchBlock(corpusText: string, datasetKey: string): { block: unknown; blockHash: string } {
    let corpus: unknown;
    try {
      corpus = JSON.parse(corpusText) as unknown;
    } catch {
      throw validationError("LoL patch corpus is not valid JSON");
    }
    if (typeof corpus !== "object" || corpus === null || Array.isArray(corpus)) {
      throw validationError("LoL patch corpus has an unexpected shape");
    }
    const block = (corpus as Record<string, unknown>)[datasetKey];
    if (block === undefined) {
      throw validationError(`LoL patch ${datasetKey} not found in corpus`);
    }
    return { block, blockHash: sha256Hex(JSON.stringify(block)) };
  },

  parseBlock(
    block: unknown,
    opts: { upstreamCommit: string | null; aliasMap: ReadonlyMap<string, string>; aliasVersion?: string | null }
  ): RawPatchChange[] {
    return parseLoLArticle({
      block,
      upstreamCommit: opts.upstreamCommit,
      aliasMap: opts.aliasMap,
      ddragonVersion: opts.aliasVersion ?? null,
    });
  },

  sourceUrlFor(version: string): string {
    return lolPatchUrl(version);
  },
};

export { LOL_ADAPTER_VERSION, LOL_PARSER_VERSION };
