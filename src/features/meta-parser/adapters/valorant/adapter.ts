/**
 * VALORANT adapter — official Riot patch-note articles behind the shared contract.
 *
 * Discovery: listing page (KBs, every run). Corpus: newest article pages
 * as structured text lines (bounded window, only when discovery proves a
 * target patch is missing or when hashing). No fallback source, no alias
 * API in V1 — heading-derived names with the pipeline empty-map fallback.
 */

import { createHash } from "node:crypto";
import { validationError } from "@/lib/errors";
import { safeFetchText } from "../../services/safe-fetch";
import type { RawPatchChange } from "../../types";
import { htmlToLines } from "./html";
import { latestNPatchVersions, parseListingHtml } from "./discovery";
import { parseValorantArticle } from "./parse";
import {
  VALORANT_ADAPTER_KEY,
  VALORANT_ADAPTER_VERSION,
  VALORANT_ALLOWED_HOSTS,
  VALORANT_CORPUS_PAGES_MAX,
  VALORANT_GAME_SLUG,
  VALORANT_PARSER_VERSION,
  VALORANT_PATCH_INDEX_MAX_BYTES,
  VALORANT_PATCH_INDEX_URL,
  VALORANT_PATCH_PAGE_MAX_BYTES,
  valorantPatchUrl,
} from "./sources";
import type { AliasFetch, CorpusFetch, DiscoveredPatch, MetaParserAdapter } from "../registry";

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const valorantAdapter: MetaParserAdapter = {
  adapterKey: VALORANT_ADAPTER_KEY,
  gameSlug: VALORANT_GAME_SLUG,
  parserVersion: VALORANT_PARSER_VERSION,
  adapterVersion: VALORANT_ADAPTER_VERSION,

  async discover(): Promise<{ patches: readonly DiscoveredPatch[]; latest: DiscoveredPatch }> {
    const result = await safeFetchText(VALORANT_PATCH_INDEX_URL, {
      allowedHosts: VALORANT_ALLOWED_HOSTS,
      maxBytes: VALORANT_PATCH_INDEX_MAX_BYTES,
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
    const index = await safeFetchText(VALORANT_PATCH_INDEX_URL, {
      allowedHosts: VALORANT_ALLOWED_HOSTS,
      maxBytes: VALORANT_PATCH_INDEX_MAX_BYTES,
      accept: "text/html",
    });
    const discovery = parseListingHtml(index.body);
    const targets = latestNPatchVersions(discovery, VALORANT_CORPUS_PAGES_MAX);
    const pages: Record<string, { lines: Array<{ depth: number; text: string }> }> = {};
    for (const target of targets) {
      const page = await safeFetchText(target.articleUrl, {
        allowedHosts: VALORANT_ALLOWED_HOSTS,
        maxBytes: VALORANT_PATCH_PAGE_MAX_BYTES,
        accept: "text/html",
      });
      pages[target.datasetKey] = { lines: htmlToLines(page.body) };
    }
    return { text: JSON.stringify(pages), upstreamCommit: null, viaFallback: false };
  },

  async fetchAliasMap(): Promise<AliasFetch> {
    // V1: heading-derived display names (parseBlock resolves them directly).
    // Empty map flows through the pipeline's established fallback.
    // No versioned alias source exists: aliasVersion stays null.
    return { aliasMap: new Map(), aliasVersion: null };
  },

  extractPatchBlock(corpusText: string, datasetKey: string): { block: unknown; blockHash: string } {
    let corpus: unknown;
    try {
      corpus = JSON.parse(corpusText) as unknown;
    } catch {
      throw validationError("VALORANT patch corpus is not valid JSON");
    }
    if (typeof corpus !== "object" || corpus === null || Array.isArray(corpus)) {
      throw validationError("VALORANT patch corpus has an unexpected shape");
    }
    const block = (corpus as Record<string, unknown>)[datasetKey];
    if (block === undefined) {
      throw validationError(`VALORANT patch ${datasetKey} not found in corpus`);
    }
    return { block, blockHash: sha256Hex(JSON.stringify(block)) };
  },

  parseBlock(
    block: unknown,
    opts: { upstreamCommit: string | null; aliasMap: ReadonlyMap<string, string> }
  ): RawPatchChange[] {
    return parseValorantArticle({ block, upstreamCommit: opts.upstreamCommit, aliasMap: opts.aliasMap });
  },

  sourceUrlFor(version: string): string {
    return valorantPatchUrl(version);
  },
};

export { VALORANT_ADAPTER_VERSION, VALORANT_PARSER_VERSION };
