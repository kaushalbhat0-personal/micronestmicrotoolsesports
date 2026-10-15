import { describe, expect, it } from "vitest";
import { META_PARSER_CONFLICT_CODE } from "../services/conflict";
import { createSupabaseMetaParserStore } from "./store";

/**
 * Minimal PostgREST chain stub. Terminals resolve from the handler;
 * intermediate builders record operations for assertions.
 */
type Handler = (table: string, ops: string[]) => unknown;

function stubClient(handler: Handler): unknown {
  const chain = (table: string, ops: string[]): Record<string, unknown> => {
    const self: Record<string, unknown> = {
      select: () => chain(table, [...ops, "select"]),
      eq: () => chain(table, [...ops, "eq"]),
      not: () => chain(table, [...ops, "not"]),
      order: () => chain(table, [...ops, "order"]),
      limit: () => chain(table, [...ops, "limit"]),
      insert: () => chain(table, [...ops, "insert"]),
      upsert: () => chain(table, [...ops, "upsert"]),
      update: () => chain(table, [...ops, "update"]),
      delete: () => chain(table, [...ops, "delete"]),
      maybeSingle: () => Promise.resolve(handler(table, [...ops, "maybeSingle"])),
      single: () => Promise.resolve(handler(table, [...ops, "single"])),
      then: (resolve: (value: unknown) => void) => resolve(handler(table, ops)),
    };
    return self;
  };
  return { from: (table: string) => chain(table, ["from"]) };
}

const GAME_ROW = { slug: "dota-2", adapter_key: "dota-2", is_active: true };
const PATCH_ROW = {
  id: "patch-1",
  game_slug: "dota-2",
  patch_version: "7.41",
  content_hash: "hash-7_41",
  revision: 1,
  upstream_id: 60,
  status: "complete",
};

describe("supabase meta-parser store reads", () => {
  it("getGame returns the row on success", async () => {
    const store = createSupabaseMetaParserStore(
      stubClient(() => ({ data: GAME_ROW, error: null })) as never
    );
    expect(await store.getGame("dota-2")).toEqual({ slug: "dota-2", adapterKey: "dota-2", isActive: true });
  });

  it("getGame returns null only when no row exists", async () => {
    const store = createSupabaseMetaParserStore(
      stubClient(() => ({ data: null, error: null })) as never
    );
    expect(await store.getGame("mobile-legends")).toBeNull();
  });

  it("getGame throws on database failure (never mistaken for absence)", async () => {
    const store = createSupabaseMetaParserStore(
      stubClient(() => ({ data: null, error: { message: "connection reset" } })) as never
    );
    await expect(store.getGame("dota-2")).rejects.toThrow("Failed to load game");
  });

  it("getPatchByVersion distinguishes row / missing / failure", async () => {
    const found = createSupabaseMetaParserStore(stubClient(() => ({ data: PATCH_ROW, error: null })) as never);
    expect(await found.getPatchByVersion("dota-2", "7.41")).toMatchObject({ version: "7.41", revision: 1, status: "complete" });
    const missing = createSupabaseMetaParserStore(stubClient(() => ({ data: null, error: null })) as never);
    expect(await missing.getPatchByVersion("dota-2", "7.40")).toBeNull();
    const broken = createSupabaseMetaParserStore(
      stubClient(() => ({ data: null, error: { message: "timeout" } })) as never
    );
    await expect(broken.getPatchByVersion("dota-2", "7.41")).rejects.toThrow("Failed to load patch");
  });

  it("getMaxUpstreamId returns max / null / throws", async () => {
    const full = createSupabaseMetaParserStore(
      stubClient(() => ({ data: [{ upstream_id: 60 }], error: null })) as never
    );
    expect(await full.getMaxUpstreamId("dota-2")).toBe(60);
    const empty = createSupabaseMetaParserStore(stubClient(() => ({ data: [], error: null })) as never);
    expect(await empty.getMaxUpstreamId("dota-2")).toBeNull();
    const broken = createSupabaseMetaParserStore(
      stubClient(() => ({ data: null, error: { message: "timeout" } })) as never
    );
    await expect(broken.getMaxUpstreamId("dota-2")).rejects.toThrow("Failed to load max upstream id");
  });
});

describe("supabase meta-parser store conflict tagging", () => {
  function conflictStore(message: string) {
    return createSupabaseMetaParserStore(
      stubClient((table, ops) => {
        if (table === "meta_parser_patches" && ops.includes("insert")) {
          return { data: null, error: { message } };
        }
        return { data: null, error: null };
      }) as never
    );
  }

  const input = {
    gameSlug: "dota-2",
    version: "7.41",
    title: "t",
    sourceUrl: "https://www.dota2.com/patches/7.41",
    sourcePublishedAt: null,
    contentHash: "h",
    parserVersion: "p",
    adapterVersion: "a",
    upstreamCommit: null,
    upstreamId: 60,
  };

  it("tags expected 23505 with the conflict code", async () => {
    const store = conflictStore('duplicate key value violates unique constraint "meta_parser_patches_source_url" (23505)');
    const error = await store.insertPatch(input).catch((e: unknown) => e);
    expect((error as { code?: string }).code).toBe(META_PARSER_CONFLICT_CODE);
  });

  it("tags known constraint names even without a numeric code", async () => {
    const store = conflictStore(
      'duplicate key value violates unique constraint "meta_parser_patches_game_version_unique"'
    );
    const error = await store.insertPatch(input).catch((e: unknown) => e);
    expect((error as { code?: string }).code).toBe(META_PARSER_CONFLICT_CODE);
    expect((error as Error).message).toContain("meta_parser_patches_game_version_unique");
  });

  it("does not tag unrelated errors containing the word duplicate", async () => {
    const store = conflictStore("duplicate entry rejected by custom hook");
    const error = await store.insertPatch(input).catch((e: unknown) => e);
    expect((error as { code?: string }).code).not.toBe(META_PARSER_CONFLICT_CODE);
    expect((error as Error).message).toContain("Failed to insert patch");
  });

  it("does not tag non-conflict database errors", async () => {
    const store = conflictStore("connection reset by peer");
    const error = await store.insertPatch(input).catch((e: unknown) => e);
    expect((error as { code?: string }).code).not.toBe(META_PARSER_CONFLICT_CODE);
  });
});

describe("supabase meta-parser store publication transitions", () => {
  /**
   * Payload-capturing stub: records insert()/update() bodies so tests prove
   * staging and promotion payloads without a database.
   */
  function captureClient(captured: { inserts: unknown[]; updates: unknown[] }): unknown {
    const chain = (table: string, ops: string[]): Record<string, unknown> => {
      const self: Record<string, unknown> = {
        select: () => chain(table, [...ops, "select"]),
        eq: () => chain(table, [...ops, "eq"]),
        not: () => chain(table, [...ops, "not"]),
        order: () => chain(table, [...ops, "order"]),
        limit: () => chain(table, [...ops, "limit"]),
        insert: (body: unknown) => {
          captured.inserts.push(body);
          return chain(table, [...ops, "insert"]);
        },
        upsert: () => chain(table, [...ops, "upsert"]),
        update: (body: unknown) => {
          captured.updates.push(body);
          return chain(table, [...ops, "update"]);
        },
        delete: () => chain(table, [...ops, "delete"]),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
        single: () =>
          Promise.resolve({
            data: { ...PATCH_ROW, status: "ingested", content_hash: "" },
            error: null,
          }),
        then: (resolve: (value: unknown) => void) =>
          resolve({ data: null, error: null }),
      };
      return self;
    };
    return { from: (table: string) => chain(table, ["from"]) };
  }

  const input = {
    gameSlug: "dota-2",
    version: "7.41",
    title: "t",
    sourceUrl: "https://www.dota2.com/patches/7.41",
    sourcePublishedAt: null,
    contentHash: "",
    parserVersion: "p",
    adapterVersion: "a",
    upstreamCommit: null,
    upstreamId: 60,
  };

  it("insertPatch stages new rows (status ingested), never published", async () => {
    const captured = { inserts: [] as unknown[], updates: [] as unknown[] };
    const store = createSupabaseMetaParserStore(captureClient(captured) as never);
    const row = await store.insertPatch(input);
    expect(row.status).toBe("ingested");
    expect(captured.inserts).toHaveLength(1);
    expect(captured.inserts[0]).toMatchObject({ status: "ingested" });
  });

  it("bumpPatchRevision promotes (status complete) with hash + revision", async () => {
    const captured = { inserts: [] as unknown[], updates: [] as unknown[] };
    const store = createSupabaseMetaParserStore(captureClient(captured) as never);
    await store.bumpPatchRevision("patch-1", "hash-7_41", 1);
    expect(captured.updates).toHaveLength(1);
    expect(captured.updates[0]).toMatchObject({
      content_hash: "hash-7_41",
      revision: 1,
      status: "complete",
    });
  });

  it("markPatchStaging demotes to ingested without touching hash or revision", async () => {
    const captured = { inserts: [] as unknown[], updates: [] as unknown[] };
    const store = createSupabaseMetaParserStore(captureClient(captured) as never);
    await store.markPatchStaging("patch-1");
    expect(captured.updates).toHaveLength(1);
    expect(captured.updates[0]).toMatchObject({ status: "ingested" });
    expect(captured.updates[0]).not.toMatchObject({ content_hash: expect.anything() });
  });

  it("markPatchStaging surfaces database failures (never silent)", async () => {
    const store = createSupabaseMetaParserStore(
      stubClient(() => ({ data: null, error: { message: "timeout" } })) as never
    );
    await expect(store.markPatchStaging("patch-1")).rejects.toThrow("Failed to stage patch");
  });
});
