import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { htmlToLines } from "./html";
import { ingestGamePatches, type MetaParserStore } from "../../services/ingest";
import { safeFetchText } from "../../services/safe-fetch";
import {
  LOL_ADAPTER_KEY,
  LOL_ADAPTER_VERSION,
  LOL_ALLOWED_HOSTS,
  LOL_GAME_SLUG,
  LOL_PARSER_VERSION,
  LOL_PATCH_INDEX_MAX_BYTES,
  datasetKeyToVersion,
  isLoLArticlePath,
  lolDdragonDatasetUrl,
  lolDdragonVersionsUrl,
  lolPatchUrl,
  patchSlugToVersion,
  upstreamIdForVersion,
  versionToDatasetKey,
  versionToPatchSlug,
} from "./sources";
import { lolAdapter } from "./adapter";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lol adapter contract", () => {
  it("exposes stable identity, versions, and provenance URLs", () => {
    expect(lolAdapter.adapterKey).toBe("lol");
    expect(lolAdapter.gameSlug).toBe("lol");
    expect(lolAdapter.parserVersion).toBe("lol-html.1");
    expect(lolAdapter.adapterVersion).toBe("lol.1");
    expect(LOL_ADAPTER_KEY).toBe("lol");
    expect(LOL_GAME_SLUG).toBe("lol");
    expect(LOL_ADAPTER_VERSION).toBe("lol.1");
    expect(LOL_PARSER_VERSION).toBe("lol-html.1");
    expect(lolAdapter.sourceUrlFor("26.20")).toBe(
      "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-notes-26-20"
    );
    expect(lolPatchUrl("26.19")).toBe(
      "https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-notes-26-19"
    );
  });

  it("maps slugs, versions, dataset keys, and upstream ids deterministically", () => {
    expect(patchSlugToVersion("26-20")).toBe("26.20");
    expect(patchSlugToVersion("notes")).toBeNull();
    expect(versionToPatchSlug("26.20")).toBe("26-20");
    expect(versionToPatchSlug("26")).toBeNull();
    expect(versionToDatasetKey("26.20")).toBe("26_20");
    expect(datasetKeyToVersion("26_20")).toBe("26.20");
    expect(datasetKeyToVersion("nope")).toBeNull();
    expect(upstreamIdForVersion("26.20")).toBe(26020);
    expect(upstreamIdForVersion("26.16")).toBe(26016);
    expect(upstreamIdForVersion("bad")).toBeNull();
  });

  it("allowlist is exactly the verified V1 host set", () => {
    expect([...LOL_ALLOWED_HOSTS]).toEqual([
      "www.leagueoflegends.com",
      "leagueoflegends.com",
      "ddragon.leagueoflegends.com",
    ]);
  });

  it("constrains article paths to official patch-note URLs", () => {
    expect(isLoLArticlePath("/en-us/news/game-updates/league-of-legends-patch-26-20-notes")).toBe(true);
    expect(isLoLArticlePath("/en-us/news/game-updates/league-of-legends-patch-26-20-notes/")).toBe(true);
    expect(isLoLArticlePath("/en-us/news/game-updates/some-skin-reveal")).toBe(false);
    expect(isLoLArticlePath("/en-us/news/tags/patch-notes/")).toBe(false);
    expect(isLoLArticlePath("https://evil.example.com/en-us/news/game-updates/league-of-legends-patch-26-20-notes")).toBe(
      false
    );
  });

  it("supports the apex -> www redirect through the allowlist", async () => {
    const encoded = new TextEncoder().encode("<html></html>");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        url: "https://www.leagueoflegends.com/en-us/news/game-updates/",
        headers: new Headers(),
        body: new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(encoded);
            controller.close();
          },
        }),
      }))
    );
    const result = await safeFetchText("https://leagueoflegends.com/en-us/news/game-updates/", {
      allowedHosts: LOL_ALLOWED_HOSTS,
      maxBytes: LOL_PATCH_INDEX_MAX_BYTES,
      accept: "text/html",
    });
    expect(result.body).toBe("<html></html>");
  });

  it("rejects off-allowlist hosts and oversized listings", async () => {
    await expect(
      safeFetchText("https://cmsassets.rgpub.io/image.png", {
        allowedHosts: LOL_ALLOWED_HOSTS,
        maxBytes: LOL_PATCH_INDEX_MAX_BYTES,
      })
    ).rejects.toMatchObject({ code: "INTEGRATION_ERROR" });
    expect(LOL_PATCH_INDEX_MAX_BYTES).toBe(1024 * 1024);
  });

  it("extracts patch blocks with stable content hashes", () => {
    const corpus = JSON.stringify({
      "26_20": { lines: [{ depth: 0, text: "Champions" }] },
    });
    const first = lolAdapter.extractPatchBlock(corpus, "26_20");
    const second = lolAdapter.extractPatchBlock(corpus, "26_20");
    expect(first.blockHash).toBe(second.blockHash);
    expect(first.blockHash).toMatch(/^[0-9a-f]{64}$/);
    expect(() => lolAdapter.extractPatchBlock(corpus, "26_19")).toThrow();
    expect(() => lolAdapter.extractPatchBlock("not json", "26_20")).toThrow();
  });

  it("parses through the shared block entry point and tolerates bad shapes", () => {
    expect(lolAdapter.parseBlock(null, { upstreamCommit: null, aliasMap: new Map() })).toEqual([]);
    expect(lolAdapter.parseBlock("text", { upstreamCommit: null, aliasMap: new Map() })).toEqual([]);
  });

  it("pins the Data Dragon version and builds the alias map from it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: unknown) => {
        const target = String(url);
        const payload =
          target === lolDdragonVersionsUrl()
            ? ["16.20.1", "16.19.1"]
            : target === lolDdragonDatasetUrl("16.20.1", "champion")
              ? { data: { MonkeyKing: { id: "MonkeyKing", name: "Wukong" } } }
              : { data: { "223152": { name: "Hextech Rocketbelt" } } };
        const encoded = new TextEncoder().encode(JSON.stringify(payload));
        return {
          ok: true,
          status: 200,
          url: target,
          headers: new Headers(),
          body: new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(encoded);
              controller.close();
            },
          }),
        };
      })
    );
    const bundle = await lolAdapter.fetchAliasMap();
    expect(bundle.aliasVersion).toBe("16.20.1");
    expect(bundle.aliasMap.get("wukong")).toBe("MonkeyKing");
    expect(bundle.aliasMap.get("hextech rocketbelt")).toBe("223152");
  });

  it("keeps parse metadata run-local across concurrent version flows", () => {
    // Two runs with different pinned versions parse the same block: each
    // emitted fact must carry its own run's version. No shared mutable
    // state exists, so interleaving cannot cross-contaminate labels.
    const block = {
      lines: [
        { depth: 0, text: "Champions", heading: true, level: 2 },
        { depth: 0, text: "Ashe", heading: true, level: 3 },
        { depth: 0, text: "Base Stats", heading: true, level: 4 },
        { depth: 0, text: "Attack Damage: 62 ⇒ 64" },
      ],
    };
    const first = lolAdapter.parseBlock(block, {
      upstreamCommit: null,
      aliasMap: new Map(),
      aliasVersion: "16.20.1",
    });
    const second = lolAdapter.parseBlock(block, {
      upstreamCommit: null,
      aliasMap: new Map(),
      aliasVersion: "16.19.1",
    });
    expect(first).toHaveLength(1);
    expect(second).toHaveLength(1);
    expect(first[0]?.metadata["ddragon_version"]).toBe("16.20.1");
    expect(second[0]?.metadata["ddragon_version"]).toBe("16.19.1");
    // Absent version degrades to null metadata, never a foreign pin.
    const third = lolAdapter.parseBlock(block, { upstreamCommit: null, aliasMap: new Map() });
    expect(third[0]?.metadata["ddragon_version"]).toBeNull();
  });

  it("runs end-to-end through the unmodified shared ingestion pipeline", async () => {
    const html = readFileSync(
      join(process.cwd(), "src/features/meta-parser/adapters/lol/fixtures/patch-26-20.html"),
      "utf8"
    );
    const corpus = JSON.stringify({ "26_20": { lines: htmlToLines(html) } });
    let aliasGame = "";
    let storedCount = 0;
    let storedMeta: Readonly<Record<string, string | number | boolean | null>> | null = null;
    const store: MetaParserStore = {
      async getGame(slug: string) {
        if (slug !== "lol") return null;
        return { slug, adapterKey: "lol", isActive: true };
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
        storedMeta = changes[0]?.metadata ?? null;
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
      ...lolAdapter,
      async discover() {
        return {
          patches: [
            { version: "26.20", releasedAt: "2026-10-06T18:00:00.000Z", upstreamId: 26020, datasetKey: "26_20" },
          ],
          latest: {
            version: "26.20",
            releasedAt: "2026-10-06T18:00:00.000Z",
            upstreamId: 26020,
            datasetKey: "26_20",
          },
        };
      },
      async fetchCorpus() {
        return { text: corpus, upstreamCommit: null as string | null, viaFallback: false };
      },
      async fetchAliasMap() {
        // Canned run-local bundle: no network, and the pin below must
        // reach stored fact metadata through the shared pipeline.
        return { aliasMap: new Map([["ashe", "Ashe"]]), aliasVersion: "16.20.1" };
      },
    };
    const report = await ingestGamePatches({
      adapter: selectiveAdapter,
      store,
      gameSlug: "lol",
    });
    expect(report.failed).toBe(0);
    expect(report.inserted).toBe(1);
    expect(report.outcomes[0]?.changeCount).toBeGreaterThan(0);
    expect(aliasGame).toBe("lol");
    // The run-local alias version traveled the shared pipeline into facts.
    expect(storedMeta?.["ddragon_version"]).toBe("16.20.1");
  });
});
