import { describe, expect, it } from "vitest";
import type { MetaParserAdapter } from "../adapters/registry";
import { parseDotaPatchBlock } from "../adapters/dota-2/parse";
import { CHECKED_IN_ALIASES } from "../adapters/dota-2/hero-aliases";
import patchIndexFixture from "../adapters/dota-2/fixtures/patch-index.json";
import historyFixture from "../adapters/dota-2/fixtures/patchnotes-history.json";
import patch741Fixture from "../adapters/dota-2/fixtures/patchnotes-7-41.json";
import {
  ingestGamePatches,
  META_PARSER_CONFLICT_CODE,
  type MetaParserStore,
  type PatchChangeInsert,
  type StoredGameRow,
  type StoredPatchRow,
} from "./ingest";

const CORPUS = {
  "7_41": (patch741Fixture as Record<string, unknown>)["7_41"],
  "7_40x": (historyFixture as Record<string, unknown>)["7_40"],
} as Record<string, unknown>;

interface TestStore extends MetaParserStore {
  patches: StoredPatchRow[];
  changeCounts: Map<string, number>;
  changeWrites: number;
  aliasWrites: number;
  deletes: number;
  stagingCalls: number;
  /** Every status assignment in order (insert → ingested, demote → ingested, promote → complete). */
  statusLog: string[];
  /** Next replace fails after a partial write ("partial") or before any write ("clean"). */
  failNextReplace: "partial" | "clean" | null;
  /** Next compensation delete fails. */
  failNextDelete: boolean;
}

function makeStore(): TestStore {
  const patches: StoredPatchRow[] = [];
  const changeCounts = new Map<string, number>();
  const statusLog: string[] = [];
  const state = { failNextReplace: null as "partial" | "clean" | null, failNextDelete: false, changeWrites: 0, aliasWrites: 0, deletes: 0, stagingCalls: 0 };
  return {
    patches,
    changeCounts,
    statusLog,
    get changeWrites() {
      return state.changeWrites;
    },
    get aliasWrites() {
      return state.aliasWrites;
    },
    get deletes() {
      return state.deletes;
    },
    get stagingCalls() {
      return state.stagingCalls;
    },
    get failNextReplace() {
      return state.failNextReplace;
    },
    set failNextReplace(value: "partial" | "clean" | null) {
      state.failNextReplace = value;
    },
    get failNextDelete() {
      return state.failNextDelete;
    },
    set failNextDelete(value: boolean) {
      state.failNextDelete = value;
    },
    async getGame(slug: string): Promise<StoredGameRow | null> {
      if (slug !== "dota-2") return null;
      return { slug, adapterKey: "dota-2", isActive: true };
    },
    async getPatchByVersion(_gameSlug: string, version: string): Promise<StoredPatchRow | null> {
      return patches.find((row) => row.version === version) ?? null;
    },
    async getMaxUpstreamId(): Promise<number | null> {
      if (patches.length === 0) return null;
      return Math.max(...patches.map((row) => row.upstreamId ?? -1));
    },
    async insertPatch(input): Promise<StoredPatchRow> {
      const row: StoredPatchRow = {
        id: `patch-${input.version}`,
        gameSlug: input.gameSlug,
        version: input.version,
        contentHash: input.contentHash,
        revision: 1,
        upstreamId: input.upstreamId,
        parserVersion: input.parserVersion,
        // Mirrors the Supabase store: new rows are staged, never published.
        status: "ingested",
      };
      statusLog.push("ingested");
      patches.push(row);
      return row;
    },
    async bumpPatchRevision(
      patchId: string,
      contentHash: string,
      revision: number,
      parserVersion: string
    ): Promise<void> {
      const row = patches.find((r) => r.id === patchId);
      if (row) {
        patches.splice(patches.indexOf(row), 1, { ...row, contentHash, revision, parserVersion, status: "complete" });
        statusLog.push("complete");
      }
    },
    async markPatchStaging(patchId: string): Promise<void> {
      state.stagingCalls += 1;
      const row = patches.find((r) => r.id === patchId);
      if (row) {
        patches.splice(patches.indexOf(row), 1, { ...row, status: "ingested" });
        statusLog.push("ingested");
      }
    },
    async replacePatchChanges(patchId: string, changes: readonly PatchChangeInsert[]): Promise<number> {
      state.changeWrites += 1;
      if (state.failNextReplace !== null) {
        const mode = state.failNextReplace;
        state.failNextReplace = null;
        if (mode === "partial") {
          // Simulate a mid-operation failure AFTER a partial write.
          changeCounts.set(patchId, Math.floor(changes.length / 2));
        }
        throw new Error("injected replace failure");
      }
      changeCounts.set(patchId, changes.length);
      return changes.length;
    },
    async countPatchChanges(patchId: string): Promise<number> {
      return changeCounts.get(patchId) ?? 0;
    },
    async deletePatch(patchId: string): Promise<void> {
      if (state.failNextDelete) {
        state.failNextDelete = false;
        throw new Error("injected delete failure");
      }
      state.deletes += 1;
      const index = patches.findIndex((row) => row.id === patchId);
      if (index >= 0) patches.splice(index, 1);
      changeCounts.delete(patchId);
    },
    async upsertAliases(): Promise<number> {
      state.aliasWrites += 1;
      return 1;
    },
  };
}

const VERSIONS = ["7.37", "7.38", "7.39", "7.40", "7.41"] as const;

function makeAdapter(overrides?: Partial<MetaParserAdapter>): MetaParserAdapter {
  return {
    adapterKey: "dota-2",
    gameSlug: "dota-2",
    parserVersion: "test-parser.1",
    adapterVersion: "dota-2.1",
    async discover() {
      const rows = patchIndexFixture as Array<{ name: string; date: string; id: number }>;
      const patches = rows
        .filter((row) => (VERSIONS as readonly string[]).includes(row.name))
        .map((row) => ({
          version: row.name,
          releasedAt: row.date,
          upstreamId: row.id,
          datasetKey: row.name.replace(".", "_"),
        }));
      const latest = patches[patches.length - 1];
      if (latest === undefined) throw new Error("empty");
      return { patches, latest };
    },
    async fetchCorpus() {
      return { text: JSON.stringify(CORPUS), upstreamCommit: "test-commit", viaFallback: false };
    },
    async fetchAliasMap() {
      return { aliasMap: CHECKED_IN_ALIASES, aliasVersion: null };
    },
    extractPatchBlock(corpusText: string, datasetKey: string) {
      const corpus = JSON.parse(corpusText) as Record<string, unknown>;
      const key = datasetKey === "7_40" ? "7_40x" : datasetKey;
      // Test stub: unmapped versions reuse the 7.41 block shape.
      const block = corpus[key] ?? corpus["7_41"];
      if (block === undefined) throw new Error("missing block");
      return { block, blockHash: `hash-${datasetKey}` };
    },
    parseBlock(block, opts) {
      return parseDotaPatchBlock({ block: block as never, upstreamCommit: opts.upstreamCommit, aliasMap: opts.aliasMap });
    },
    sourceUrlFor(version: string) {
      return `https://www.dota2.com/patches/${version}`;
    },
    ...overrides,
  };
}

describe("ingestGamePatches idempotency", () => {
  it("inserts the latest patch on first run", async () => {
    const report = await ingestGamePatches({ adapter: makeAdapter(), store: makeStore(), gameSlug: "dota-2" });
    expect(report.attempted).toBe(1);
    expect(report.inserted).toBe(1);
    expect(report.outcomes[0]?.outcome).toBe("inserted");
  });

  it("second run with identical content is a no-op (no duplicates)", async () => {
    const store = makeStore();
    const first = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(first.inserted).toBe(1);
    const writesAfterFirst = store.changeWrites;
    const second = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(second.unchanged).toBe(1);
    expect(second.inserted).toBe(0);
    expect(store.patches).toHaveLength(1);
    expect(store.changeWrites).toBe(writesAfterFirst);
  });

  it("changed upstream content bumps revision instead of duplicating", async () => {
    const store = makeStore();
    await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    const changed = makeAdapter();
    const originalExtract = changed.extractPatchBlock.bind(changed);
    changed.extractPatchBlock = (text: string, key: string) => {
      const result = originalExtract(text, key);
      return { ...result, blockHash: "hash-changed" };
    };
    const report = await ingestGamePatches({ adapter: changed, store, gameSlug: "dota-2" });
    expect(report.revised).toBe(1);
    expect(store.patches).toHaveLength(1);
    expect(store.patches[0]?.revision).toBe(2);
  });

  it("backfills the latest 5 through the same code path", async () => {
    const store = makeStore();
    const report = await ingestGamePatches({
      adapter: makeAdapter(),
      store,
      gameSlug: "dota-2",
      backfillLatestN: 5,
    });
    expect(report.attempted).toBe(5);
    expect(report.inserted).toBe(5);
    expect(store.patches).toHaveLength(5);
  });

  it("skips cleanly for unknown or inactive games (MLBB stays untouched)", async () => {
    const store = makeStore();
    const report = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "mobile-legends" });
    expect(report.attempted).toBe(0);
  });

  it("reports versions and fallback provenance without schema changes", async () => {
    const report = await ingestGamePatches({ adapter: makeAdapter(), store: makeStore(), gameSlug: "dota-2" });
    expect(report.parserVersion).toBe("test-parser.1");
    expect(report.adapterVersion).toBe("dota-2.1");
    expect(report.viaFallback).toBe(false);
    const fallback = makeAdapter({
      fetchCorpus: async () => ({ text: JSON.stringify(CORPUS), upstreamCommit: null, viaFallback: true }),
    });
    const fallbackReport = await ingestGamePatches({ adapter: fallback, store: makeStore(), gameSlug: "dota-2" });
    expect(fallbackReport.viaFallback).toBe(true);
  });
});

describe("ingestGamePatches revision safety", () => {
  it("mid-replace failure on a new patch leaves no partial row behind", async () => {
    const store = makeStore();
    store.failNextReplace = "partial";
    const failed = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(failed.failed).toBe(1);
    // Compensation delete ran: no patch row, no partial changes survive.
    expect(store.patches).toHaveLength(0);
    expect(store.deletes).toBe(1);
    // Retry converges to a complete insert.
    const retry = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(retry.inserted).toBe(1);
    expect(store.patches).toHaveLength(1);
    expect(store.patches[0]?.revision).toBe(1);
    expect(store.changeCounts.get("patch-7.41")).toBeGreaterThan(0);
  });

  it("mid-replace failure on a revision keeps the old hash so retry converges", async () => {
    const store = makeStore();
    await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    const before = store.patches[0];
    const changed = makeAdapter();
    const originalExtract = changed.extractPatchBlock.bind(changed);
    changed.extractPatchBlock = (text: string, key: string) => {
      const result = originalExtract(text, key);
      return { ...result, blockHash: "hash-changed" };
    };
    store.failNextReplace = "partial";
    const failed = await ingestGamePatches({ adapter: changed, store, gameSlug: "dota-2" });
    expect(failed.failed).toBe(1);
    // Hash/revision untouched: the incomplete replacement is not committed.
    expect(store.patches[0]?.contentHash).toBe(before?.contentHash);
    expect(store.patches[0]?.revision).toBe(1);
    const retry = await ingestGamePatches({ adapter: changed, store, gameSlug: "dota-2" });
    expect(retry.revised).toBe(1);
    expect(store.patches).toHaveLength(1);
    expect(store.patches[0]?.revision).toBe(2);
  });

  it("double failure (replace + compensation) preserves both causes and never reports unchanged", async () => {
    const store = makeStore();
    store.failNextReplace = "partial";
    store.failNextDelete = true;
    const failed = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    // 1-2. Ingestion fails and the compensation failure is not swallowed.
    expect(failed.failed).toBe(1);
    const message = failed.outcomes[0]?.error ?? "";
    expect(message).toContain("Replacement failed");
    expect(message).toContain("compensation failed");
    // 3. The surviving row does NOT carry the real source hash.
    expect(store.patches).toHaveLength(1);
    expect(store.patches[0]?.contentHash).toBe("");
    // 4. Retry re-enters replacement instead of returning unchanged.
    const retry = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(retry.failed).toBe(0);
    expect(retry.unchanged).toBe(0);
    // 5-9. Full convergence: real hash, revision 1, complete changes, one row.
    expect(retry.inserted).toBe(0);
    expect(retry.revised).toBe(1);
    expect(store.patches).toHaveLength(1);
    expect(store.patches[0]?.contentHash).toBe("hash-7_41");
    expect(store.patches[0]?.revision).toBe(1);
    expect(store.changeCounts.get("patch-7.41")).toBeGreaterThan(0);
  });

  it("clean replace failure (zero rows written) still converges on retry", async () => {
    const store = makeStore();
    store.failNextReplace = "clean";
    const failed = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(failed.failed).toBe(1);
    expect(store.patches).toHaveLength(0);
    const retry = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(retry.inserted).toBe(1);
    expect(store.patches).toHaveLength(1);
    expect(store.patches[0]?.contentHash).toBe("hash-7_41");
  });
});

describe("ingestGamePatches concurrent races", () => {
  function makeRacingStore(): TestStore {
    const store = makeStore();
    let inserts = 0;
    const originalInsert = store.insertPatch.bind(store);
    store.insertPatch = (async (input: Parameters<TestStore["insertPatch"]>[0]) => {
      inserts += 1;
      if (inserts === 1) {
        // Force the interleave: first writer pauses until the second
        // writer has also observed "no existing patch".
        await Promise.resolve();
        await Promise.resolve();
      }
      const existing = await store.getPatchByVersion(input.gameSlug, input.version);
      if (existing !== null) {
        const conflict = new Error(`duplicate key value violates unique constraint (23505)`);
        (conflict as { code?: string }).code = META_PARSER_CONFLICT_CODE;
        throw conflict;
      }
      return originalInsert(input);
    }) as TestStore["insertPatch"];
    return store;
  }

  it("two simultaneous ingestions converge on one logical patch", async () => {
    const store = makeRacingStore();
    const adapter = makeAdapter();
    const [first, second] = await Promise.all([
      ingestGamePatches({ adapter, store, gameSlug: "dota-2" }),
      ingestGamePatches({ adapter, store, gameSlug: "dota-2" }),
    ]);
    expect(store.patches).toHaveLength(1);
    expect(first.failed).toBe(0);
    expect(second.failed).toBe(0);
    // Exactly one writer performs the insert; the other converges onto the
    // shared row (unchanged if it arrived after promotion, revised if it
    // completed a provisional row). Either convergence is correct.
    expect(first.inserted + second.inserted).toBe(1);
    expect(first.unchanged + first.revised + second.unchanged + second.revised).toBe(1);
  });

  it("conflict with identical content converges to unchanged (no false failure)", async () => {
    const store = makeStore();
    await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    // Simulate a loser with a stale read: it misses the winner's row, its
    // insert hits the unique constraint, then it must converge.
    let staleReads = 0;
    const originalGet = store.getPatchByVersion.bind(store);
    store.getPatchByVersion = (async (gameSlug: string, version: string) => {
      staleReads += 1;
      // Miss twice: the needsWork check AND the per-patch check, so the
      // pipeline reaches insert and hits the unique violation.
      if (staleReads <= 2) return null;
      return originalGet(gameSlug, version);
    }) as TestStore["getPatchByVersion"];
    const originalInsert = store.insertPatch.bind(store);
    void originalInsert;
    store.insertPatch = (async () => {
      const conflict = new Error(`duplicate key value violates unique constraint (23505)`);
      (conflict as { code?: string }).code = META_PARSER_CONFLICT_CODE;
      throw conflict;
    }) as TestStore["insertPatch"];
    const report = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(report.failed).toBe(0);
    expect(report.unchanged).toBe(1);
    expect(store.patches).toHaveLength(1);
  });

  it("conflict with divergent content revises in place instead of failing", async () => {
    const store = makeStore();
    await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    // Winner holds older content; loser computes the new hash.
    const winner = store.patches[0];
    if (winner) {
      store.patches.splice(store.patches.indexOf(winner), 1, { ...winner, contentHash: "hash-older-content" });
    }
    let staleReads = 0;
    const originalGet = store.getPatchByVersion.bind(store);
    store.getPatchByVersion = (async (gameSlug: string, version: string) => {
      staleReads += 1;
      // Miss twice: the needsWork check AND the per-patch check, so the
      // pipeline reaches insert and hits the unique violation.
      if (staleReads <= 2) return null;
      return originalGet(gameSlug, version);
    }) as TestStore["getPatchByVersion"];
    store.insertPatch = (async () => {
      const conflict = new Error(`duplicate key value violates unique constraint (23505)`);
      (conflict as { code?: string }).code = META_PARSER_CONFLICT_CODE;
      throw conflict;
    }) as TestStore["insertPatch"];
    const report = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(report.failed).toBe(0);
    expect(report.revised).toBe(1);
    expect(store.patches).toHaveLength(1);
    expect(store.patches[0]?.revision).toBe(2);
  });
});

describe("ingestGamePatches publication protocol (Option C)", () => {
  it("new patch stages (ingested + provisional) before publishing (complete + real hash)", async () => {
    const store = makeStore();
    const report = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(report.inserted).toBe(1);
    // Staging first, publication last — never the reverse.
    expect(store.statusLog).toEqual(["ingested", "complete"]);
    expect(store.patches[0]?.status).toBe("complete");
    expect(store.patches[0]?.contentHash).toBe("hash-7_41");
    expect(store.patches[0]?.revision).toBe(1);
  });

  it("new patch failure never publishes: surviving row stays staged for retry", async () => {
    const store = makeStore();
    store.failNextReplace = "partial";
    store.failNextDelete = true;
    const failed = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(failed.failed).toBe(1);
    expect(store.patches).toHaveLength(1);
    expect(store.patches[0]?.status).not.toBe("complete");
    expect(store.patches[0]?.status).toBe("ingested");
    // Retry converges to publication without skipping a revision.
    const retry = await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    expect(retry.failed).toBe(0);
    expect(store.patches[0]?.status).toBe("complete");
    expect(store.patches[0]?.contentHash).toBe("hash-7_41");
    expect(store.patches[0]?.revision).toBe(1);
  });

  it("revision demotes to staging before replacing, then promotes with revision + 1", async () => {
    const store = makeStore();
    await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    const changed = makeAdapter();
    const originalExtract = changed.extractPatchBlock.bind(changed);
    changed.extractPatchBlock = (text: string, key: string) => {
      const result = originalExtract(text, key);
      return { ...result, blockHash: "hash-changed" };
    };
    const report = await ingestGamePatches({ adapter: changed, store, gameSlug: "dota-2" });
    expect(report.revised).toBe(1);
    expect(store.stagingCalls).toBe(1);
    // insert ingested → insert complete → demote ingested → promote complete.
    expect(store.statusLog).toEqual(["ingested", "complete", "ingested", "complete"]);
    expect(store.patches[0]?.status).toBe("complete");
    expect(store.patches[0]?.contentHash).toBe("hash-changed");
    expect(store.patches[0]?.revision).toBe(2);
  });

  it("revision failure after demotion stays staged with the old hash, then retry converges", async () => {
    const store = makeStore();
    await ingestGamePatches({ adapter: makeAdapter(), store, gameSlug: "dota-2" });
    const before = store.patches[0];
    const changed = makeAdapter();
    const originalExtract = changed.extractPatchBlock.bind(changed);
    changed.extractPatchBlock = (text: string, key: string) => {
      const result = originalExtract(text, key);
      return { ...result, blockHash: "hash-changed" };
    };
    store.failNextReplace = "partial";
    const failed = await ingestGamePatches({ adapter: changed, store, gameSlug: "dota-2" });
    expect(failed.failed).toBe(1);
    // Staged, old hash intact — never the new hash, never published.
    expect(store.patches[0]?.status).toBe("ingested");
    expect(store.patches[0]?.contentHash).toBe(before?.contentHash);
    expect(store.patches[0]?.contentHash).not.toBe("hash-changed");
    const retry = await ingestGamePatches({ adapter: changed, store, gameSlug: "dota-2" });
    expect(retry.revised).toBe(1);
    expect(store.patches[0]?.status).toBe("complete");
    expect(store.patches[0]?.contentHash).toBe("hash-changed");
    expect(store.patches[0]?.revision).toBe(2);
  });
});

describe("ingestGamePatches parser-version-aware reparse", () => {
  const BLOCK_HASH = "hash-stable-content";

  function versionAdapter(
    parserVersion: string,
    adapterKey = "lol",
    gameSlug = "lol",
    version = "26.20"
  ): MetaParserAdapter {
    return {
      adapterKey,
      gameSlug,
      parserVersion,
      adapterVersion: `${adapterKey}.1`,
      async discover() {
        const patch = {
          version,
          releasedAt: "2026-10-06T00:00:00Z",
          upstreamId: 26020,
          datasetKey: version.replace(".", "_"),
        };
        return { patches: [patch], latest: patch };
      },
      async fetchCorpus() {
        return { text: "{}", upstreamCommit: null, viaFallback: false };
      },
      async fetchAliasMap() {
        return { aliasMap: new Map(), aliasVersion: null };
      },
      extractPatchBlock() {
        return { block: {}, blockHash: BLOCK_HASH };
      },
      parseBlock() {
        return [
          {
            stableKey: "lol:champion:smolder:passive:super_scorcher:0",
            entityType: "champion",
            entityName: "Smolder",
            entityKey: null,
            category: "passive",
            attribute: "super_scorcher",
            description: "Super Scorcher Bonus Magic Damage: 25 - 55% ⇒ 25 - 60%",
            oldText: "25 - 55%",
            newText: "25 - 60%",
            oldNumeric: null,
            newNumeric: null,
            unit: "%",
            changeType: "buff" as const,
            confidence: "low" as const,
            metadata: {},
          },
        ];
      },
      sourceUrlFor(version: string) {
        return `https://www.leagueoflegends.com/en-us/news/game-updates/league-of-legends-patch-notes-${version.replace(".", "-")}`;
      },
    };
  }

  function versionStore(
    stored: StoredPatchRow | null,
    gameSlug = "lol",
    adapterKey = "lol"
  ): TestStore & { stored: () => StoredPatchRow | null } {
    const store = makeStore();
    if (stored !== null) store.patches.push({ ...stored });
    store.getGame = async (slug: string) =>
      slug === gameSlug ? { slug, adapterKey, isActive: true } : null;
    return Object.assign(store, { stored: () => store.patches[0] ?? null });
  }

  function storedRow(overrides?: Partial<StoredPatchRow>): StoredPatchRow {
    return {
      id: "patch-26.20",
      gameSlug: "lol",
      version: "26.20",
      contentHash: BLOCK_HASH,
      revision: 3,
      upstreamId: 26020,
      parserVersion: "lol-html.1",
      status: "complete",
      ...overrides,
    };
  }

  it("Case A: hash equal + parser version equal → skip (zero writes)", async () => {
    const store = versionStore(storedRow({ parserVersion: "lol-html.2" }));
    const writesBefore = store.changeWrites;
    const report = await ingestGamePatches({
      adapter: versionAdapter("lol-html.2"),
      store,
      gameSlug: "lol",
    });
    expect(report.unchanged).toBe(1);
    expect(report.revised).toBe(0);
    expect(store.changeWrites).toBe(writesBefore);
    expect(store.stored()?.revision).toBe(3);
  });

  it("Case B: hash equal + parser version differs → reparse through promoteExisting", async () => {
    const store = versionStore(storedRow({ parserVersion: "lol-html.1" }));
    const report = await ingestGamePatches({
      adapter: versionAdapter("lol-html.2"),
      store,
      gameSlug: "lol",
    });
    expect(report.revised).toBe(1);
    expect(report.unchanged).toBe(0);
    // Existing stage → replace → count verify → alias seed → revision bump → publish pipeline.
    expect(store.stagingCalls).toBe(1);
    expect(store.statusLog).toEqual(["ingested", "complete"]);
    expect(store.stored()?.status).toBe("complete");
    expect(store.stored()?.revision).toBe(4);
    expect(store.stored()?.contentHash).toBe(BLOCK_HASH);
    // Parser version advances on publish.
    expect(store.stored()?.parserVersion).toBe("lol-html.2");
  });

  it("Case C: hash differs → reparse regardless of parser version", async () => {
    const store = versionStore(storedRow({ contentHash: "hash-older-content", parserVersion: "lol-html.2" }));
    const report = await ingestGamePatches({
      adapter: versionAdapter("lol-html.2"),
      store,
      gameSlug: "lol",
    });
    expect(report.revised).toBe(1);
    expect(store.stored()?.contentHash).toBe(BLOCK_HASH);
  });

  it("Case D: Dota current parser version → no unnecessary reparse", async () => {
    const store = versionStore(
      storedRow({
        gameSlug: "dota-2",
        version: "7.41",
        id: "patch-7.41",
        parserVersion: "dotaconstants-structured.1",
      }),
      "dota-2",
      "dota-2"
    );
    const dota = versionAdapter("dotaconstants-structured.1", "dota-2", "dota-2", "7.41");
    const report = await ingestGamePatches({ adapter: dota, store, gameSlug: "dota-2" });
    expect(report.unchanged).toBe(1);
    expect(report.revised).toBe(0);
  });

  it("Case E: VALORANT current parser version → no unnecessary reparse", async () => {
    const store = versionStore(
      storedRow({
        gameSlug: "valorant",
        version: "13.01",
        id: "patch-13.01",
        parserVersion: "valorant-html.1",
      }),
      "valorant",
      "valorant"
    );
    const valorant = versionAdapter("valorant-html.1", "valorant", "valorant", "13.01");
    const report = await ingestGamePatches({ adapter: valorant, store, gameSlug: "valorant" });
    expect(report.unchanged).toBe(1);
    expect(report.revised).toBe(0);
  });

  it("Case F: second LoL run after healing → hash + parser version equal → skip", async () => {
    const store = versionStore(storedRow({ parserVersion: "lol-html.1" }));
    const adapter = versionAdapter("lol-html.2");
    const first = await ingestGamePatches({ adapter, store, gameSlug: "lol" });
    expect(first.revised).toBe(1);
    expect(store.stored()?.parserVersion).toBe("lol-html.2");
    const writesAfterHealing = store.changeWrites;
    const second = await ingestGamePatches({ adapter, store, gameSlug: "lol" });
    expect(second.unchanged).toBe(1);
    expect(second.revised).toBe(0);
    expect(store.changeWrites).toBe(writesAfterHealing);
  });

  it("legacy rows with a null stored parser version always reparse (safe comparison)", async () => {
    const store = versionStore(storedRow({ parserVersion: null }));
    const report = await ingestGamePatches({
      adapter: versionAdapter("lol-html.2"),
      store,
      gameSlug: "lol",
    });
    expect(report.revised).toBe(1);
    expect(store.stored()?.parserVersion).toBe("lol-html.2");
  });

  it("isCurrentParse requires both hash and version equality", async () => {
    const { isCurrentParse } = await import("./ingest");
    expect(isCurrentParse({ contentHash: "h", parserVersion: "lol-html.2" }, "h", "lol-html.2")).toBe(true);
    expect(isCurrentParse({ contentHash: "h", parserVersion: "lol-html.1" }, "h", "lol-html.2")).toBe(false);
    expect(isCurrentParse({ contentHash: "other", parserVersion: "lol-html.2" }, "h", "lol-html.2")).toBe(false);
    expect(isCurrentParse({ contentHash: "h", parserVersion: null }, "h", "lol-html.2")).toBe(false);
  });
});
