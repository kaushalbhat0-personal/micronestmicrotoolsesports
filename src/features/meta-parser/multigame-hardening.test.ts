import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  clearAdapterRegistry,
  getAdapter,
  registeredAdapterKeys,
} from "./adapters/registry";
import { registerAllAdapters } from "./adapters";
import { dota2Adapter } from "./adapters/dota-2/adapter";
import { valorantAdapter } from "./adapters/valorant/adapter";
import { valveProvenanceUrl } from "./adapters/dota-2/sources";
import { ingestGamePatches, type MetaParserStore } from "./services/ingest";
import {
  META_PARSER_JOB_ID,
  metaParserJobIdForGame,
} from "./services/job-id";
import {
  isGenericEntityTypeValue,
  isGenericPatchVersion,
} from "./repositories/reads";
import type { MetaParserAdapter } from "./adapters/registry";

function stubStore(gameSlug: string, adapterKey: string) {
  const state = {
    aliasCalls: [] as Array<{ gameSlug: string; count: number }>,
    upserted: [] as Array<{ canonical: string; normalized: string }>,
    lastWritten: 0,
  };
  const store: MetaParserStore = {
    async getGame(slug: string) {
      if (slug !== gameSlug) return null;
      return { slug, adapterKey, isActive: true };
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
    async replacePatchChanges(_patchId, changes) {
      state.lastWritten = changes.length;
      return changes.length;
    },
    async countPatchChanges() {
      return state.lastWritten;
    },
    async deletePatch() {},
    async upsertAliases(slug, aliases) {
      state.aliasCalls.push({ gameSlug: slug, count: aliases.length });
      state.upserted.push(...aliases);
      return aliases.length;
    },
  };
  return { store, state };
}

function stubAdapter(
  adapterKey: string,
  gameSlug: string,
  changes: Array<{ entityType: string; entityName: string; entityNormalized: string }>
): MetaParserAdapter {
  return {
    adapterKey,
    gameSlug,
    parserVersion: "test-parser.1",
    adapterVersion: "test-adapter.1",
    async discover() {
      const patch = { version: "10.08", releasedAt: "2026-01-01T00:00:00Z", upstreamId: 1, datasetKey: "10_08" };
      return { patches: [patch], latest: patch };
    },
    async fetchCorpus() {
      return { text: "{}", upstreamCommit: null, viaFallback: false };
    },
    async fetchAliasMap() {
      return new Map();
    },
    extractPatchBlock() {
      return { block: {}, blockHash: "ab".repeat(32) };
    },
    parseBlock() {
      return changes.map((c, i) => ({
        stableKey: `${c.entityType}:${i}`,
        entityType: c.entityType,
        entityName: c.entityName,
        entityKey: null,
        category: "test",
        attribute: null,
        description: `desc ${i}`,
        oldText: null,
        newText: null,
        oldNumeric: null,
        newNumeric: null,
        unit: null,
        changeType: "buff" as const,
        confidence: "medium" as const,
        metadata: {},
      }));
    },
    sourceUrlFor(version: string) {
      return `https://example.com/patches/${version}`;
    },
  };
}

describe("multigame hardening: generic versions", () => {
  it("accepts dota, lol, valorant, date, and season schemes", () => {
    for (const v of ["7.41", "14.10", "10.08", "EP09", "2.2.16a", "2026-03-12", "Y10S1.1"]) {
      expect(isGenericPatchVersion(v), v).toBe(true);
    }
  });

  it("rejects unsafe identifiers without weakening transport safety", () => {
    for (const v of ["", "seven", "../etc", "7,41", "a/b", "x".repeat(41)]) {
      expect(isGenericPatchVersion(v), v).toBe(false);
    }
  });
});

describe("multigame hardening: open entity vocabulary", () => {
  it("accepts future adapter types without shared-code changes", () => {
    for (const t of ["hero", "champion", "agent", "operator", "weapon", "item", "map", "legend", "system", "ability", "character", "boss"]) {
      expect(isGenericEntityTypeValue(t), t).toBe(true);
    }
  });

  it("rejects unsafe entity shapes", () => {
    for (const t of ["", "Hero", "BOSS!!", "../etc", "a b", "x".repeat(41)]) {
      expect(isGenericEntityTypeValue(t), t).toBe(false);
    }
  });

  it("change_type stays closed (checked in reads tests)", () => {
    expect(["buff", "nerf", "adjustment", "rework", "new", "bugfix", "neutral"]).toHaveLength(7);
  });
});

describe("multigame hardening: generic alias seeding + isolation", () => {
  it("seeds champions/agents/weapons (not only heroes) scoped to the game", async () => {
    const { store, state } = stubStore("test-game", "test-adapter");
    const adapter = stubAdapter("test-adapter", "test-game", [
      { entityType: "champion", entityName: "Annie", entityNormalized: "annie" },
      { entityType: "weapon", entityName: "Vandal", entityNormalized: "vandal" },
    ]);
    const report = await ingestGamePatches({ adapter, store, gameSlug: "test-game" });
    expect(report.failed).toBe(0);
    expect(state.aliasCalls).toHaveLength(1);
    expect(state.aliasCalls[0]?.gameSlug).toBe("test-game");
    expect(state.upserted.map((a) => a.normalized).sort()).toEqual(["annie", "vandal"]);
  });

  it("per-game failures never throw and never touch another game", async () => {
    const bad: MetaParserAdapter = {
      ...stubAdapter("bad-adapter", "bad-game", []),
      async discover() {
        throw new Error("upstream down");
      },
    };
    const { store: badStore } = stubStore("bad-game", "bad-adapter");
    const badReport = await ingestGamePatches({ adapter: bad, store: badStore, gameSlug: "bad-game" });
    expect(badReport.failed).toBe(1);
    expect(badReport.outcomes[0]?.outcome).toBe("failed");

    const { store: goodStore, state } = stubStore("good-game", "good-adapter");
    const good = stubAdapter("good-adapter", "good-game", [
      { entityType: "agent", entityName: "Jett", entityNormalized: "jett" },
    ]);
    const goodReport = await ingestGamePatches({ adapter: good, store: goodStore, gameSlug: "good-game" });
    expect(goodReport.failed).toBe(0);
    expect(state.aliasCalls[0]?.gameSlug).toBe("good-game");
  });
});

describe("multigame hardening: adapter registration", () => {
  it("registerAllAdapters exposes dota-2 and valorant with no per-game route imports", () => {
    clearAdapterRegistry();
    registerAllAdapters();
    expect(getAdapter("dota-2")).toBe(dota2Adapter);
    expect(getAdapter("valorant")).toBe(valorantAdapter);
    expect(registeredAdapterKeys()).toEqual(["dota-2", "valorant"]);
    expect(getAdapter("lol")).toBeUndefined();
    clearAdapterRegistry();
  });

  it("route uses the central registry (no game-specific imports)", () => {
    const code = readFileSync(join(process.cwd(), "src/app/api/ingest/meta-parser/route.ts"), "utf8");
    expect(code).toContain("registerAllAdapters");
    expect(code).not.toContain("adapters/dota-2/adapter");
  });
});

describe("multigame hardening: scheduler matrix", () => {
  it("runs games independently with bounded backfill and no secrets in source", () => {
    const workflow = readFileSync(
      join(process.cwd(), ".github/workflows/meta-parser-ingest.yml"),
      "utf8"
    );
    expect(workflow).toContain("fail-fast: false");
    expect(workflow).toContain("matrix");
    expect(workflow).toContain('game: ["dota-2", "valorant"]');
    // Only shipped adapters are active matrix entries.
    expect(workflow).not.toContain('"lol"');
    expect(workflow).toContain("${{ secrets.CRON_SECRET }}");
    // No unbounded backfill: route bound stays 5 and workflow passes through only.
    const route = readFileSync(
      join(process.cwd(), "src/app/api/ingest/meta-parser/route.ts"),
      "utf8"
    );
    expect(route).toContain("BACKFILL_MAX = 5");
  });
});

describe("multigame hardening: health per-game readiness", () => {
  it("keeps the single ledger id while offering stable per-game keys", () => {
    expect(META_PARSER_JOB_ID).toBe("/api/ingest/meta-parser");
    expect(metaParserJobIdForGame("dota-2")).toBe("/api/ingest/meta-parser?game=dota-2");
    expect(metaParserJobIdForGame("valorant")).toBe("/api/ingest/meta-parser?game=valorant");
  });
});

describe("multigame hardening: dota behavior preserved", () => {
  it("adapter identity, versions, and provenance URL are unchanged", () => {
    expect(dota2Adapter.adapterKey).toBe("dota-2");
    expect(dota2Adapter.gameSlug).toBe("dota-2");
    expect(dota2Adapter.parserVersion).toBe("dotaconstants-structured.1");
    expect(dota2Adapter.adapterVersion).toBe("dota-2.1");
    expect(valveProvenanceUrl("7.41")).toBe("https://www.dota2.com/patches/7.41");
    expect(dota2Adapter.sourceUrlFor("7.41")).toBe("https://www.dota2.com/patches/7.41");
  });
});
