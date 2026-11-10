import { describe, expect, it } from "vitest";
import {
  META_PARSER_GROUPED_GROUPS_PER_PAGE,
  groupPublishedChanges,
  listGroupedChanges,
  type PublishedChange,
} from "./reads";

/**
 * Grouped-read tests (RCCF-META-PARSER-UX-07).
 *
 * Same in-memory PostgREST stub shape as reads.test.ts (eq/neq/order/range
 * semantics) so grouping, atomic pagination, and the publication gate are
 * proven without a database.
 */

interface Filter {
  op: "eq" | "neq";
  col: string;
  val: unknown;
}

type Row = Record<string, unknown>;

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
    id: "patch-staging",
    game_slug: "dota-2",
    patch_version: "7.39",
    title: "dota-2 7.39",
    source_url: "https://www.dota2.com/patches/7.39",
    source_published_at: "2025-04-01T00:00:00Z",
    content_hash: "hash-7_39",
    revision: 1,
    status: "ingested",
  },
];

function changeRow(
  patchId: string,
  stableKey: string,
  entityType: string,
  entityName: string,
  entityNormalized: string,
  changeType: string,
  overrides: Partial<Row> = {}
): Row {
  return {
    id: `change-${stableKey}`,
    patch_id: patchId,
    stable_key: stableKey,
    entity_type: entityType,
    entity_name: entityName,
    entity_normalized: entityNormalized,
    entity_key: null,
    category: "ability",
    attribute: null,
    old_text: null,
    new_text: null,
    old_numeric: null,
    new_numeric: null,
    unit: null,
    change_type: changeType,
    confidence: "medium",
    description: `desc ${stableKey}`,
    metadata: {},
    ...overrides,
  };
}

const CHANGE_ROWS: Row[] = [
  changeRow("patch-741", "hero:abaddon:a:1", "hero", "Abaddon", "abaddon", "buff"),
  changeRow("patch-741", "hero:abaddon:b:2", "hero", "Abaddon", "abaddon", "buff"),
  changeRow("patch-741", "hero:abaddon:c:3", "hero", "Abaddon", "abaddon", "nerf"),
  // Same hero, different category + different display-name casing source.
  changeRow("patch-741", "hero:abaddon:t:4", "hero", "Abaddon", "abaddon", "adjustment", {
    category: "talents",
  }),
  changeRow("patch-741", "hero:abaddon:g:5", "hero", "Abaddon", "abaddon", "adjustment", {
    category: "general",
  }),
  changeRow("patch-741", "hero:abaddon:r:6", "hero", "Abaddon", "abaddon", "adjustment", {
    category: "ability",
    confidence: "low",
  }),
  // Same normalized name under a DIFFERENT entity type stays separate.
  changeRow("patch-741", "system:general:-:1", "system", "General", "general", "adjustment", {
    category: "system",
  }),
  changeRow("patch-741", "item:general:-:2", "item", "General", "general", "new"),
  changeRow("patch-741", "hero:zeus:a:7", "hero", "Zeus", "zeus", "rework"),
  changeRow("patch-741", "hero:zeus:b:8", "hero", "Zeus", "zeus", "bugfix"),
  changeRow("patch-741", "hero:zeus:c:9", "hero", "Zeus", "zeus", "neutral"),
  // Staging rows must never leak through the grouped path.
  changeRow("patch-staging", "hero:partial:a:1", "hero", "Partial", "partial", "buff"),
];

interface StubState {
  filters: Filter[];
  orders: Array<{ col: string; asc: boolean }>;
  range: [number, number] | null;
}

function makeClient(rows: Row[] = CHANGE_ROWS): { client: unknown; calls: number } {
  let calls = 0;
  const tables: Record<string, Row[]> = {
    meta_parser_patches: PATCH_ROWS.map((row) => ({ ...row })),
    meta_parser_changes: rows.map((row) => ({ ...row })),
  };
  function apply(table: string, state: StubState): Row[] {
    let out = tables[table] ?? [];
    for (const filter of state.filters) {
      out =
        filter.op === "eq"
          ? out.filter((row) => row[filter.col] === filter.val)
          : out.filter((row) => row[filter.col] !== filter.val);
    }
    for (const order of state.orders) {
      out = [...out].sort((a, b) => {
        const left = a[order.col];
        const right = b[order.col];
        if (left === right) return 0;
        if (left === null || left === undefined) return 1;
        if (right === null || right === undefined) return 1;
        return (left < right ? -1 : 1) * (order.asc ? 1 : -1);
      });
    }
    if (state.range !== null) out = out.slice(state.range[0], state.range[1] + 1);
    return out;
  }
  const chain = (table: string, state: StubState): Record<string, unknown> => ({
    select: () => chain(table, state),
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
      calls += 1;
      const found = apply(table, state);
      return Promise.resolve({ data: found[0] ?? null, error: null });
    },
    then: (resolve: (value: unknown) => void) => {
      calls += 1;
      resolve({ data: apply(table, state), error: null });
    },
  });
  const fresh = (): StubState => ({ filters: [], orders: [], range: null });
  return {
    client: { from: (table: string) => chain(table, fresh()) },
    get calls() {
      return calls;
    },
  };
}

function publishedChange(partial: Partial<PublishedChange> & { id: string }): PublishedChange {
  return {
    entityType: "hero",
    entityName: "Abaddon",
    entityNormalized: "abaddon",
    entityKey: null,
    category: "ability",
    attribute: null,
    oldText: null,
    newText: null,
    oldNumeric: null,
    newNumeric: null,
    unit: null,
    changeType: "buff",
    confidence: "medium",
    description: "desc",
    ...partial,
  };
}

describe("groupPublishedChanges fold", () => {
  it("collapses same-entity rows into one group across categories", () => {
    const groups = groupPublishedChanges([
      publishedChange({ id: "1", category: "ability", changeType: "buff" }),
      publishedChange({ id: "2", category: "talents", changeType: "nerf" }),
      publishedChange({ id: "3", category: "general", changeType: "adjustment" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.changes.map((c) => c.id)).toEqual(["1", "2", "3"]);
    expect(groups[0]?.counts).toEqual({
      total: 3,
      buff: 1,
      nerf: 1,
      adjustment: 1,
      rework: 0,
      new: 0,
      bugfix: 0,
      neutral: 0,
    });
  });

  it("keeps different entity types and normalized entities separate", () => {
    const groups = groupPublishedChanges([
      publishedChange({ id: "1", entityType: "system", entityName: "General", entityNormalized: "general" }),
      publishedChange({ id: "2", entityType: "item", entityName: "General", entityNormalized: "general" }),
      publishedChange({ id: "3", entityType: "hero", entityName: "Zeus", entityNormalized: "zeus" }),
    ]);
    expect(groups.map((g) => `${g.entityType}:${g.entityNormalized}`)).toEqual([
      "system:general",
      "item:general",
      "hero:zeus",
    ]);
  });

  it("ignores entityKey and display-name variance when grouping", () => {
    const groups = groupPublishedChanges([
      publishedChange({ id: "1", entityKey: "k1", entityName: "Abaddon" }),
      publishedChange({ id: "2", entityKey: "k2", entityName: "ABADDON" }),
      publishedChange({ id: "3", entityKey: null, entityName: "Abaddon" }),
    ]);
    expect(groups).toHaveLength(1);
    // Display name comes from the first row in stable_key order — deterministic.
    expect(groups[0]?.entityName).toBe("Abaddon");
  });

  it("counts all seven stored classifications without reinterpretation", () => {
    const groups = groupPublishedChanges(
      (["buff", "nerf", "adjustment", "rework", "new", "bugfix", "neutral"] as const).map(
        (changeType, i) =>
          publishedChange({ id: String(i), changeType, confidence: changeType === "adjustment" ? "low" : "medium" })
      )
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]?.counts).toEqual({
      total: 7,
      buff: 1,
      nerf: 1,
      adjustment: 1,
      rework: 1,
      new: 1,
      bugfix: 1,
      neutral: 1,
    });
  });
});

describe("listGroupedChanges repository", () => {
  it("groups a patch into atomic entity groups with patch-global counts", async () => {
    const { client } = makeClient();
    const result = await listGroupedChanges(client as never, "patch-741", {}, { groupLimit: 15, groupOffset: 0 });
    expect(result.published).toBe(true);
    expect(result.groupTotal).toBe(4);
    expect(result.changeTotal).toBe(11);
    expect(result.hasMore).toBe(false);
    const abaddon = result.groups.find((g) => g.entityNormalized === "abaddon");
    expect(abaddon?.changes).toHaveLength(6);
    expect(abaddon?.counts).toMatchObject({ total: 6, buff: 2, nerf: 1, adjustment: 3 });
    expect(result.entityTypeTotals).toEqual({
      hero: { groups: 2, changes: 9 },
      system: { groups: 1, changes: 1 },
      item: { groups: 1, changes: 1 },
    });
  });

  it("uses 15 groups per page by default", async () => {
    expect(META_PARSER_GROUPED_GROUPS_PER_PAGE).toBe(15);
    const { client } = makeClient();
    const result = await listGroupedChanges(client as never, "patch-741");
    expect(result.groupLimit).toBe(15);
  });

  it("never splits a group across pages (atomic pagination)", async () => {
    const { client } = makeClient();
    const page1 = await listGroupedChanges(client as never, "patch-741", {}, { groupLimit: 2, groupOffset: 0 });
    const page2 = await listGroupedChanges(client as never, "patch-741", {}, { groupLimit: 2, groupOffset: 2 });
    expect(page1.hasMore).toBe(true);
    expect(page2.hasMore).toBe(false);
    const keys1 = page1.groups.map((g) => `${g.entityType}:${g.entityNormalized}`);
    const keys2 = page2.groups.map((g) => `${g.entityType}:${g.entityNormalized}`);
    expect(new Set([...keys1, ...keys2]).size).toBe(4);
    expect(keys1.some((k) => keys2.includes(k))).toBe(false);
    // Repeated pagination is deterministic.
    const repeat = await listGroupedChanges(client as never, "patch-741", {}, { groupLimit: 2, groupOffset: 2 });
    expect(repeat.groups.map((g) => g.entityNormalized)).toEqual(
      page2.groups.map((g) => g.entityNormalized)
    );
  });

  it("keeps a large entity group intact on a single page", async () => {
    const rows: Row[] = Array.from({ length: 100 }, (_, i) =>
      changeRow("patch-741", `hero:big:c:${i}`, "hero", "Big", "big", "buff")
    );
    rows.push(changeRow("patch-741", "hero:zeus:a:1", "hero", "Zeus", "zeus", "nerf"));
    const { client } = makeClient(rows);
    const result = await listGroupedChanges(client as never, "patch-741", {}, { groupLimit: 15, groupOffset: 0 });
    expect(result.groupTotal).toBe(2);
    expect(result.groups[0]?.changes).toHaveLength(100);
    expect(result.groups[0]?.counts.total).toBe(100);
  });

  it("applies existing filter semantics and reports filtered totals", async () => {
    const { client } = makeClient();
    const heroes = await listGroupedChanges(client as never, "patch-741", { entityType: "hero" });
    expect(heroes.groupTotal).toBe(2);
    expect(heroes.changeTotal).toBe(9);
    const nerfs = await listGroupedChanges(client as never, "patch-741", { changeType: "nerf" });
    expect(nerfs.changeTotal).toBe(1);
    expect(nerfs.groups[0]?.entityNormalized).toBe("abaddon");
    const search = await listGroupedChanges(client as never, "patch-741", { entityNormalized: "Zeus" });
    expect(search.groupTotal).toBe(1);
    expect(search.groups[0]?.entityName).toBe("Zeus");
    await expect(listGroupedChanges(client as never, "patch-741", { changeType: "mega-buff" })).rejects.toThrow();
  });

  it("fetches large patches in bounded chunks without per-entity queries", async () => {
    const rows: Row[] = Array.from({ length: 1200 }, (_, i) =>
      changeRow(
        "patch-741",
        `hero:bulk:c:${String(i).padStart(4, "0")}`,
        "hero",
        `Bulk ${i % 10}`,
        `bulk-${i % 10}`,
        "buff"
      )
    );
    const stub = makeClient(rows);
    const result = await listGroupedChanges(stub.client as never, "patch-741", {}, { groupLimit: 5, groupOffset: 0 });
    expect(result.groupTotal).toBe(10);
    expect(result.changeTotal).toBe(1200);
    expect(result.groups).toHaveLength(5);
    // Gate + 2 fetch chunks; zero per-entity round trips.
    expect(stub.calls).toBe(3);
  });

  it("hides staging patches entirely (published: false, no rows)", async () => {
    const { client } = makeClient();
    const result = await listGroupedChanges(client as never, "patch-staging");
    expect(result).toMatchObject({ published: false, groups: [], groupTotal: 0, changeTotal: 0, hasMore: false });
  });

  it("rejects malformed patch ids and clamps group pagination", async () => {
    const { client } = makeClient();
    await expect(listGroupedChanges(client as never, "")).rejects.toThrow();
    const result = await listGroupedChanges(client as never, "patch-741", {}, { groupLimit: 0, groupOffset: -5 });
    expect(result.groupLimit).toBe(1);
    expect(result.groupOffset).toBe(0);
  });
});
