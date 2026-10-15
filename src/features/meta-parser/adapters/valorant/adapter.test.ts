import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { htmlToLines } from "./html";
import { ingestGamePatches, type MetaParserStore } from "../../services/ingest";
import { safeFetchText } from "../../services/safe-fetch";
import {
  VALORANT_ADAPTER_KEY,
  VALORANT_ADAPTER_VERSION,
  VALORANT_ALLOWED_HOSTS,
  VALORANT_GAME_SLUG,
  VALORANT_PARSER_VERSION,
  VALORANT_PATCH_INDEX_MAX_BYTES,
  VALORANT_PATCH_INDEX_URL,
  datasetKeyToVersion,
  patchSlugToVersion,
  upstreamIdForVersion,
  valorantPatchUrl,
  versionToDatasetKey,
  versionToPatchSlug,
} from "./sources";
import { valorantAdapter } from "./adapter";

describe("valorant adapter contract", () => {
  it("exposes stable identity, versions, and provenance URLs", () => {
    expect(valorantAdapter.adapterKey).toBe("valorant");
    expect(valorantAdapter.gameSlug).toBe("valorant");
    expect(valorantAdapter.parserVersion).toBe("valorant-html.1");
    expect(valorantAdapter.adapterVersion).toBe("valorant.1");
    expect(VALORANT_ADAPTER_KEY).toBe("valorant");
    expect(VALORANT_GAME_SLUG).toBe("valorant");
    expect(VALORANT_ADAPTER_VERSION).toBe("valorant.1");
    expect(VALORANT_PARSER_VERSION).toBe("valorant-html.1");
    expect(valorantAdapter.sourceUrlFor("13.01")).toBe(
      "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-01"
    );
    expect(valorantPatchUrl("13.08")).toBe(
      "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-08"
    );
  });

  it("maps slugs, versions, dataset keys, and upstream ids deterministically", () => {
    expect(patchSlugToVersion("13-08")).toBe("13.08");
    expect(patchSlugToVersion("notes")).toBeNull();
    expect(versionToPatchSlug("13.01")).toBe("13-01");
    expect(versionToPatchSlug("13")).toBeNull();
    expect(versionToDatasetKey("13.08")).toBe("13_08");
    expect(datasetKeyToVersion("13_01")).toBe("13.01");
    expect(datasetKeyToVersion("nope")).toBeNull();
    expect(upstreamIdForVersion("13.08")).toBe(13008);
    expect(upstreamIdForVersion("13.01")).toBe(13001);
    expect(upstreamIdForVersion("bad")).toBeNull();
  });

  it("allowlist is exactly the verified V1 host", () => {
    expect([...VALORANT_ALLOWED_HOSTS]).toEqual(["playvalorant.com"]);
  });

  it("extracts patch blocks with stable content hashes", () => {
    const corpus = JSON.stringify({
      "13_01": { lines: [{ depth: 0, text: "AGENTS UPDATES" }] },
    });
    const first = valorantAdapter.extractPatchBlock(corpus, "13_01");
    const second = valorantAdapter.extractPatchBlock(corpus, "13_01");
    expect(first.blockHash).toBe(second.blockHash);
    expect(first.blockHash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => valorantAdapter.extractPatchBlock(corpus, "13_08")).toThrow();
    expect(() => valorantAdapter.extractPatchBlock("not json", "13_01")).toThrow();
  });

  it("parses through the shared block entry point and tolerates bad shapes", () => {
    expect(valorantAdapter.parseBlock(null, { upstreamCommit: null, aliasMap: new Map() })).toEqual([]);
    expect(valorantAdapter.parseBlock("text", { upstreamCommit: null, aliasMap: new Map() })).toEqual([]);
  });

  it("returns an empty alias map through the established fallback", async () => {
    await expect(valorantAdapter.fetchAliasMap()).resolves.toEqual(new Map());
  });

  it("runs end-to-end through the unmodified shared ingestion pipeline", async () => {
    const html = readFileSync(
      join(process.cwd(), "src/features/meta-parser/adapters/valorant/fixtures/patch-13-01.html"),
      "utf8"
    );
    const corpus = JSON.stringify({ "13_01": { lines: htmlToLines(html) } });
    let aliasGame = "";
    let storedCount = 0;
    const store: MetaParserStore = {
      async getGame(slug: string) {
        if (slug !== "valorant") return null;
        return { slug, adapterKey: "valorant", isActive: true };
      },
      async getPatchByVersion() {
        return null;
      },
      async getMaxUpstreamId() {
        return null;
      },
      async insertPatch(input) {
        return {
          id: `patch-${input.version}`,
          gameSlug: input.gameSlug,
          version: input.version,
          contentHash: input.contentHash,
          revision: 1,
          upstreamId: input.upstreamId,
          status: "ingested",
        };
      },
      async bumpPatchRevision() {},
      async markPatchStaging() {},
      async replacePatchChanges(_patchId: string, changes) {
        storedCount = changes.length;
        return changes.length;
      },
      async countPatchChanges() {
        return storedCount;
      },
      async deletePatch() {},
      async upsertAliases(gameSlug: string, aliases) {
        aliasGame = gameSlug;
        return aliases.length;
      },
    };
    const selectiveAdapter = {
      ...valorantAdapter,
      async discover() {
        return {
          patches: [
            { version: "13.01", releasedAt: "2026-07-14T13:00:00.000Z", upstreamId: 13001, datasetKey: "13_01" },
          ],
          latest: {
            version: "13.01",
            releasedAt: "2026-07-14T13:00:00.000Z",
            upstreamId: 13001,
            datasetKey: "13_01",
          },
        };
      },
      async fetchCorpus() {
        return { text: corpus, upstreamCommit: null as string | null, viaFallback: false };
      },
    };
    const report = await ingestGamePatches({
      adapter: selectiveAdapter,
      store,
      gameSlug: "valorant",
    });
    expect(report.failed).toBe(0);
    expect(report.inserted).toBe(1);
    expect(report.outcomes[0]?.changeCount).toBeGreaterThan(0);
    expect(aliasGame).toBe("valorant");
  });
});

describe("valorant listing size cap (production regression)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function stubListingFetch(totalBytes: number): void {
    const pieces: string[] = [];
    let remaining = totalBytes;
    const unit = "x".repeat(1024);
    while (remaining > 0) {
      const size = Math.min(unit.length, remaining);
      pieces.push(unit.slice(0, size));
      remaining -= size;
    }
    const encoded = pieces.map((part) => new TextEncoder().encode(part));
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of encoded) controller.enqueue(chunk);
        controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: VALORANT_PATCH_INDEX_URL,
        headers: new Headers(),
        body,
      }))
    );
  }

  function fetchListing(): Promise<{ bytes: number }> {
    return safeFetchText(VALORANT_PATCH_INDEX_URL, {
      allowedHosts: VALORANT_ALLOWED_HOSTS,
      maxBytes: VALORANT_PATCH_INDEX_MAX_BYTES,
      accept: "text/html",
    });
  }

  it("pins the listing cap at 1 MiB", () => {
    expect(VALORANT_PATCH_INDEX_MAX_BYTES).toBe(1024 * 1024);
  });

  it("accepts a production-sized listing above the old 512 KiB cap", async () => {
    // Production measured 554,440 bytes on 2026-10-15; the previous 512 KiB
    // cap rejected it during discovery before any patch was persisted.
    stubListingFetch(600 * 1024);
    const result = await fetchListing();
    expect(result.bytes).toBe(600 * 1024);
  });

  it("still rejects a listing exceeding the new cap", async () => {
    stubListingFetch(1024 * 1024 + 1);
    await expect(fetchListing()).rejects.toMatchObject({ code: "INTEGRATION_ERROR" });
  });
});
