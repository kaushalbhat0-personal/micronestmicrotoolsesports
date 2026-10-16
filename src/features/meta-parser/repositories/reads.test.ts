import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  META_PARSER_READ_DEFAULT_LIMIT,
  META_PARSER_READ_MAX_LIMIT,
  getPatch,
  listChanges,
  listGames,
  listPatchEntityNames,
  listPatchEntityTypes,
  listPatches,
} from "./reads";

/**
 * Publication-boundary tests for the Facts read repository.
 *
 * An in-memory PostgREST stub applies eq/neq/order/range/head semantics so
 * tests prove the reader predicate (status = complete AND content_hash <> '')
 * and the patch-gated change path without a database.
 */

interface Filter {
  op: "eq" | "neq";
  col: string;
  val: unknown;
}

interface Seen {
  table: string;
  filters: Filter[];
  head: boolean;
}

type Row = Record<string, unknown>;

const GAME_ROWS: Row[] = [
  { slug: "dota-2", name: "Dota 2", is_active: true },
  { slug: "dead-game", name: "Dead Game", is_active: false },
];

const PATCH_ROWS: Row[] = [
  {
    id: "patch-741",
    game_slug: "dota-2",
    patch_version: "7.41",
    title: "dota-2 7.41",
    source_url: "https://www.dota2.com/patches/7.41",
    source_published_at: "2025-06-01T00:00:00Z",
    content_hash: "hash-7_41",
    revision: 1,
    status: "complete",
  },
  {
    id: "patch-740",
    game_slug: "dota-2",
    patch_version: "7.40",
    title: "dota-2 7.40",
    source_url: "https://www.dota2.com/patches/7.40",
    source_published_at: "2025-05-01T00:00:00Z",
    content_hash: "hash-7_40",
    revision: 1,
    status: "complete",
  },
  // Staging row with partial changes — the reader-isolation fixture.
  {
    id: "patch-739",
    game_slug: "dota-2",
    patch_version: "7.39",
    title: "dota-2 7.39",
    source_url: "https://www.dota2.com/patches/7.39",
    source_published_at: "2025-04-01T00:00:00Z",
    content_hash: "hash-7_39",
    revision: 1,
    status: "ingested",
  },
  // Provisional hash with published status — must still be invisible.
  {
    id: "patch-738",
    game_slug: "dota-2",
    patch_version: "7.38",
    title: "dota-2 7.38",
    source_url: "https://www.dota2.com/patches/7.38",
    source_published_at: "2025-03-01T00:00:00Z",
    content_hash: "",
    revision: 1,
    status: "complete",
  },
  {
    id: "patch-737",
    game_slug: "dota-2",
    patch_version: "7.37",
    title: "dota-2 7.37",
    source_url: "https://www.dota2.com/patches/7.37",
    source_published_at: "2025-02-01T00:00:00Z",
    content_hash: "hash-7_37",
    revision: 1,
    status: "parse_failed",
  },
];

function changeRow(
  patchId: string,
  stableKey: string,
  entityType: string,
  entityNormalized: string,
  changeType: string
): Row {
  return {
    id: `change-${stableKey}`,
    patch_id: patchId,
    stable_key: stableKey,
    entity_type: entityType,
    entity_name: entityNormalized,
    entity_normalized: entityNormalized,
    entity_key: null,
    category: "test",
    attribute: null,
    old_text: null,
    new_text: null,
    old_numeric: null,
    new_numeric: null,
    unit: null,
    change_type: changeType,
    confidence: "high",
    description: `desc ${stableKey}`,
    metadata: {},
  };
}

// Deliberately unsorted stable_keys prove ORDER BY stable_key.
const CHANGE_ROWS: Row[] = [
  changeRow("patch-741", "hero:zeta:general:3", "hero", "zeta", "nerf"),
  changeRow("patch-741", "general:general:-:1", "system", "general", "adjustment"),
  changeRow("patch-741", "hero:alchemist:general:2", "hero", "alchemist", "buff"),
  changeRow("patch-741", "item:blink:general:4", "item", "blink dagger", "buff"),
  changeRow("patch-741", "hero:alchemist:talents:5", "hero", "alchemist", "nerf"),
  // Partial staging set for the ingested 7.39 row.
  changeRow("patch-739", "hero:partial:general:1", "hero", "partial", "buff"),
  changeRow("patch-739", "hero:partial:general:2", "hero", "partial", "buff"),
];

interface StubState {
  filters: Filter[];
  orders: Array<{ col: string; asc: boolean }>;
  range: [number, number] | null;
  head: boolean;
}

function freshState(): StubState {
  return { filters: [], orders: [], range: null, head: false };
}

function makeClient(): {
  client: unknown;
  seen: Seen[];
  tables: Record<string, Row[]>;
} {
  const seen: Seen[] = [];
  const tables: Record<string, Row[]> = {
    meta_parser_games: GAME_ROWS.map((row) => ({ ...row })),
    meta_parser_patches: PATCH_ROWS.map((row) => ({ ...row })),
    meta_parser_changes: CHANGE_ROWS.map((row) => ({ ...row })),
  };

  function apply(table: string, state: StubState): Row[] {
    let rows = tables[table] ?? [];
    for (const filter of state.filters) {
      rows =
        filter.op === "eq"
          ? rows.filter((row) => row[filter.col] === filter.val)
          : rows.filter((row) => row[filter.col] !== filter.val);
    }
    for (const order of state.orders) {
      rows = [...rows].sort((a, b) => {
        const left = a[order.col];
        const right = b[order.col];
        if (left === right) return 0;
        if (left === null || left === undefined) return 1;
        if (right === null || right === undefined) return 1;
        return (left < right ? -1 : 1) * (order.asc ? 1 : -1);
      });
    }
    if (state.range !== null) {
      rows = rows.slice(state.range[0], state.range[1] + 1);
    }
    return rows;
  }

  const chain = (table: string, state: StubState): Record<string, unknown> => ({
    select: (_columns: string, options?: { count?: string; head?: boolean }) =>
      chain(table, { ...state, head: options?.head === true }),
    eq: (col: string, val: unknown) =>
      chain(table, { ...state, filters: [...state.filters, { op: "eq", col, val }] }),
    neq: (col: string, val: unknown) =>
      chain(table, { ...state, filters: [...state.filters, { op: "neq", col, val }] }),
    order: (col: string, options?: { ascending?: boolean }) =>
      chain(table, {
        ...state,
        orders: [...state.orders, { col, asc: options?.ascending !== false }],
      }),
    range: (from: number, to: number) => chain(table, { ...state, range: [from, to] }),
    maybeSingle: () => {
      seen.push({ table, filters: state.filters, head: state.head });
      const rows = apply(table, state);
      return Promise.resolve({ data: rows[0] ?? null, error: null });
    },
    then: (resolve: (value: unknown) => void) => {
      seen.push({ table, filters: state.filters, head: state.head });
      if (state.head) {
        resolve({ data: [], count: apply(table, state).length, error: null });
        return;
      }
      resolve({ data: apply(table, state), error: null });
    },
  });

  return { client: { from: (table: string) => chain(table, freshState()) }, seen, tables };
}

function patchPredicates(filters: Filter[]): { status: unknown; hash: unknown } {
  return {
    status: filters.find((f) => f.op === "eq" && f.col === "status")?.val,
    hash: filters.find((f) => f.op === "neq" && f.col === "content_hash")?.val,
  };
}

describe("facts read repository games and patches", () => {
  it("listGames returns active games only (with data-driven provenance)", async () => {
    const { client } = makeClient();
    expect(await listGames(client as never)).toEqual([
      {
        slug: "dota-2",
        name: "Dota 2",
        provenance: { sourceLabel: null, datasetLabel: null, datasetUrl: null, license: null },
      },
    ]);
  });

  it("listGames parses expected_fields.provenance without game-specific code", async () => {
    const { client, tables } = makeClient();
    const games = tables["meta_parser_games"];
    if (games?.[0]) {
      games[0]["expected_fields"] = {
        provenance: {
          sourceLabel: "Test Source",
          datasetLabel: "Test Dataset",
          datasetUrl: "https://example.com/dataset",
          license: "Test License",
        },
      };
    }
    const listed = await listGames(client as never);
    expect(listed[0]?.provenance).toEqual({
      sourceLabel: "Test Source",
      datasetLabel: "Test Dataset",
      datasetUrl: "https://example.com/dataset",
      license: "Test License",
    });
    // Cross-game isolation: provenance never leaks default values.
    const { client: fresh } = makeClient();
    expect((await listGames(fresh as never))[0]?.provenance?.sourceLabel).toBeNull();
  });

  it("listPatches returns published patches newest first, hiding staging/provisional/failed", async () => {
    const { client } = makeClient();
    const patches = await listPatches(client as never, "dota-2");
    expect(patches.map((p) => p.patchVersion)).toEqual(["7.41", "7.40"]);
  });

  it("listPatches returns [] for unknown or inactive games, throws for malformed slugs", async () => {
    const { client } = makeClient();
    expect(await listPatches(client as never, "unknown-game")).toEqual([]);
    expect(await listPatches(client as never, "dead-game")).toEqual([]);
    await expect(listPatches(client as never, "DOTA!!")).rejects.toThrow();
  });

  it("getPatch returns the header with an exact total for published patches", async () => {
    const { client } = makeClient();
    const patch = await getPatch(client as never, "dota-2", "7.41");
    expect(patch?.patchVersion).toBe("7.41");
    expect(patch?.revision).toBe(1);
    expect(patch?.sourceUrl).toBe("https://www.dota2.com/patches/7.41");
    expect(patch?.changeCount).toBe(5);
  });

  it("getPatch returns null for missing, staging, provisional, and failed patches", async () => {
    const { client } = makeClient();
    expect(await getPatch(client as never, "dota-2", "9.99")).toBeNull();
    expect(await getPatch(client as never, "dota-2", "7.39")).toBeNull();
    expect(await getPatch(client as never, "dota-2", "7.38")).toBeNull();
    expect(await getPatch(client as never, "dota-2", "7.37")).toBeNull();
  });

  it("getPatch validates game and version inputs", async () => {
    const { client } = makeClient();
    await expect(getPatch(client as never, "DOTA!!", "7.41")).rejects.toThrow();
    await expect(getPatch(client as never, "dota-2", "seven")).rejects.toThrow();
  });

  it("patch projections exclude ingestion internals", async () => {
    const { client } = makeClient();
    const patch = await getPatch(client as never, "dota-2", "7.41");
    expect(patch).not.toBeNull();
    for (const key of ["contentHash", "upstreamId", "upstreamCommit", "status", "metadata"]) {
      expect(patch, `must not expose ${key}`).not.toHaveProperty(key);
    }
  });

  it("every patch query enforces status complete and non-empty hash", async () => {
    const first = makeClient();
    await listPatches(first.client as never, "dota-2");
    const second = makeClient();
    await getPatch(second.client as never, "dota-2", "7.41");
    for (const { seen } of [first, second]) {
      const patchQueries = seen.filter((s) => s.table === "meta_parser_patches" && !s.head);
      expect(patchQueries.length).toBeGreaterThan(0);
      for (const query of patchQueries) {
        expect(patchPredicates(query.filters)).toEqual({ status: "complete", hash: "" });
      }
    }
  });
});

describe("facts read repository changes", () => {
  it("reader isolation: staging patches with partial changes read as unpublished with no rows", async () => {
    const { client, tables } = makeClient();
    const staged = await listChanges(client as never, "patch-739");
    expect(staged.published).toBe(false);
    expect(staged.changes).toEqual([]);
    // Promote the same rows: the complete dataset becomes readable untouched.
    const row = tables["meta_parser_patches"]?.find((r) => r["id"] === "patch-739");
    if (row) {
      row["status"] = "complete";
    }
    const published = await listChanges(client as never, "patch-739");
    expect(published.published).toBe(true);
    expect(published.changes).toHaveLength(2);
  });

  it("missing or provisional patches read as unpublished", async () => {
    const { client } = makeClient();
    expect((await listChanges(client as never, "patch-missing")).published).toBe(false);
    expect((await listChanges(client as never, "patch-738")).published).toBe(false);
    expect((await listChanges(client as never, "patch-738")).changes).toEqual([]);
  });

  it("orders deterministically by stable_key", async () => {
    const { client } = makeClient();
    const result = await listChanges(client as never, "patch-741", {}, { limit: 100 });
    expect(result.published).toBe(true);
    expect(result.changes.map((c) => c.description)).toEqual([
      "desc general:general:-:1",
      "desc hero:alchemist:general:2",
      "desc hero:alchemist:talents:5",
      "desc hero:zeta:general:3",
      "desc item:blink:general:4",
    ]);
  });

  it("filters by entity_type, change_type, and normalized entity text (combined too)", async () => {
    const { client } = makeClient();
    const heroes = await listChanges(client as never, "patch-741", { entityType: "hero" });
    expect(heroes.changes).toHaveLength(3);
    const buffs = await listChanges(client as never, "patch-741", { changeType: "buff" });
    expect(buffs.changes).toHaveLength(2);
    // Unnormalized input (" Alchemist ") matches via server-side normalization.
    const alchemist = await listChanges(
      client as never,
      "patch-741",
      { entityType: "hero", entityNormalized: " Alchemist " }
    );
    expect(alchemist.changes).toHaveLength(2);
    const combined = await listChanges(
      client as never,
      "patch-741",
      { entityType: "hero", changeType: "nerf" }
    );
    expect(combined.changes).toHaveLength(2);
  });

  it("rejects unsafe filter values but accepts any safe entity type (open vocabulary)", async () => {
    const { client } = makeClient();
    // change_type stays closed vocabulary.
    await expect(listChanges(client as never, "patch-741", { changeType: "mega-buff" })).rejects.toThrow();
    // Unsafe entity_type shapes still rejected.
    await expect(listChanges(client as never, "patch-741", { entityType: "BOSS!!" })).rejects.toThrow();
    await expect(listChanges(client as never, "patch-741", { entityType: "../etc" })).rejects.toThrow();
    await expect(listChanges(client as never, "patch-741", { entityNormalized: "   " })).rejects.toThrow();
    // Adapter-defined types need no shared-code change: safe values filter, not throw.
    const champions = await listChanges(client as never, "patch-741", { entityType: "champion" });
    expect(champions.published).toBe(true);
    expect(champions.changes).toEqual([]);
    const boss = await listChanges(client as never, "patch-741", { entityType: "boss" });
    expect(boss.published).toBe(true);
  });

  it("paginates with default 50, clamps to max 100, and reports hasMore without exact counts", async () => {
    const { client, seen } = makeClient();
    expect(META_PARSER_READ_DEFAULT_LIMIT).toBe(50);
    expect(META_PARSER_READ_MAX_LIMIT).toBe(100);
    const page = await listChanges(client as never, "patch-741", {}, { limit: 2, offset: 0 });
    expect(page.limit).toBe(2);
    expect(page.offset).toBe(0);
    expect(page.changes).toHaveLength(2);
    expect(page.hasMore).toBe(true);
    const tail = await listChanges(client as never, "patch-741", {}, { limit: 2, offset: 4 });
    expect(tail.changes).toHaveLength(1);
    expect(tail.hasMore).toBe(false);
    const beyond = await listChanges(client as never, "patch-741", {}, { limit: 2, offset: 99 });
    expect(beyond.changes).toEqual([]);
    expect(beyond.hasMore).toBe(false);
    const clamped = await listChanges(client as never, "patch-741", {}, { limit: 500 });
    expect(clamped.limit).toBe(100);
    expect(clamped.changes).toHaveLength(5);
    const defaulted = await listChanges(client as never, "patch-741");
    expect(defaulted.limit).toBe(50);
    // Filtered lists never run exact head counts.
    expect(seen.filter((s) => s.head)).toEqual([]);
  });

  it("change projections exclude internal metadata", async () => {
    const { client } = makeClient();
    const result = await listChanges(client as never, "patch-741", {}, { limit: 1 });
    const change = result.changes[0];
    expect(change).not.toHaveProperty("metadata");
    expect(change).not.toHaveProperty("stableKey");
    expect(change?.entityNormalized).toBe("general");
  });

  it("validates patch id input", async () => {
    const { client } = makeClient();
    await expect(listChanges(client as never, "")).rejects.toThrow();
  });

  it("lists distinct published entity types for the Category filter", async () => {
    const { client } = makeClient();
    expect(await listPatchEntityTypes(client as never, "patch-741")).toEqual([
      "hero",
      "item",
      "system",
    ]);
  });

  it("hides filter values for staging, provisional, or missing patches", async () => {
    const { client } = makeClient();
    // patch-739 has changes but is staging (ingested) — invisible.
    expect(await listPatchEntityTypes(client as never, "patch-739")).toEqual([]);
    expect(await listPatchEntityNames(client as never, "patch-739")).toEqual([]);
    // patch-738 is provisional-hash — invisible.
    expect(await listPatchEntityTypes(client as never, "patch-738")).toEqual([]);
    expect(await listPatchEntityNames(client as never, "patch-missing")).toEqual([]);
  });

  it("lists distinct published entity names for Search suggestions", async () => {
    const { client } = makeClient();
    expect(await listPatchEntityNames(client as never, "patch-741")).toEqual([
      "alchemist",
      "blink dagger",
      "general",
      "zeta",
    ]);
  });

  it("caps entity-name suggestions and validates patch id input", async () => {
    const { client } = makeClient();
    expect(await listPatchEntityNames(client as never, "patch-741", 2)).toEqual([
      "alchemist",
      "blink dagger",
    ]);
    await expect(listPatchEntityTypes(client as never, "")).rejects.toThrow();
    await expect(listPatchEntityNames(client as never, "")).rejects.toThrow();
  });
});

describe("facts read repository layering", () => {
  function sourceOf(relativePath: string): string {
    return readFileSync(join(process.cwd(), relativePath), "utf8");
  }

  it("performs no mutations and uses no service-role client", async () => {
    const code = sourceOf("src/features/meta-parser/repositories/reads.ts");
    for (const token of [".insert(", ".update(", ".delete(", ".upsert(", "createAdminClient"]) {
      expect(code, `reads.ts must not contain ${token}`).not.toContain(token);
    }
  });

  it("imports no game adapter (stays game-agnostic)", async () => {
    const code = sourceOf("src/features/meta-parser/repositories/reads.ts");
    expect(code).not.toContain("adapters/dota-2");
    expect(code).not.toContain("dota-2");
  });

  it("is never imported by client components", async () => {
    // Static guard: no "use client" module may reach the read repository.
    const { execSync } = await import("node:child_process");
    let output = "";
    try {
      output = execSync("git grep -l 'meta-parser/repositories/reads' -- '*.tsx' '*.ts'", {
        encoding: "utf8",
      });
    } catch {
      // No importers found (git grep exits 1 on no match) — the ideal state.
      output = "";
    }
    const importers = output
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .filter((line) => !line.endsWith(".test.ts") && !line.endsWith(".test.tsx"));
    for (const file of importers) {
      const code = readFileSync(join(process.cwd(), file), "utf8");
      expect(code, `${file} must not be a client component importing reads`).not.toContain(
        '"use client"'
      );
    }
  });
});
