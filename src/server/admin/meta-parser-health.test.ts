import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";

const mockRequireSuperAdmin = vi.fn(async () => ({ id: "admin-1" }));
vi.mock("@/lib/auth/require-super-admin", () => ({
  requireSuperAdmin: (...args: []) => mockRequireSuperAdmin(...args),
}));

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: mockFrom })),
}));

const mockLedgerSummaries = vi.fn();
vi.mock("@/server/cron/run-ledger", () => ({
  getCronLedgerSummaries: (...args: [string[]]) => mockLedgerSummaries(...args),
}));

import {
  determineMetaParserStatus,
  getMetaParserHealth,
  META_PARSER_HEALTH_GAMES,
  META_PARSER_HEALTHY_WINDOW_HOURS,
} from "./meta-parser-health";
import { META_PARSER_JOB_ID, metaParserJobIdForGame } from "@/features/meta-parser/services/job-id";

const NOW = "2026-10-17T00:00:00.000Z";
const hoursAgo = (h: number): string => new Date(Date.parse(NOW) - h * 3_600_000).toISOString();

interface PatchFixture {
  id: string;
  game_slug: string;
  patch_version: string;
  title: string;
  source_url: string;
  source_published_at: string | null;
  revision: number;
  status: string;
  content_hash: string;
}

interface LedgerOpts {
  lastRunStatus?: "running" | "succeeded" | "failed";
  lastRunAt?: string;
  lastSuccessAt?: string | null;
  lastFailureAt?: string | null;
  failureSummary?: string | null;
  totalRuns?: number;
}

let patchRows: PatchFixture[] = [];
let changeCounts: Record<string, number> = {};
let activeGames: string[] = [];
let ledgerByJob: Record<string, LedgerOpts> = {};

function ledgerSummary(jobId: string, opts: LedgerOpts): unknown {
  const run = (status: "running" | "succeeded" | "failed", startedAt: string, errorSummary: string | null = null) => ({
    id: `${jobId}-${status}`,
    jobId,
    runId: `${jobId}-${status}-run`,
    status,
    startedAt,
    completedAt: startedAt,
    errorSummary,
  });
  return {
    jobId,
    lastRun: opts.lastRunStatus ? run(opts.lastRunStatus, opts.lastRunAt ?? hoursAgo(18)) : null,
    lastSuccess:
      opts.lastSuccessAt === null || opts.lastSuccessAt === undefined ? null : run("succeeded", opts.lastSuccessAt),
    lastFailure:
      opts.lastFailureAt === null || opts.lastFailureAt === undefined
        ? null
        : run("failed", opts.lastFailureAt, opts.failureSummary ?? null),
    totalRuns: opts.totalRuns ?? (opts.lastRunStatus ? 3 : 0),
  };
}

/** Minimal fixture-driven Supabase query fake: eq/neq/order + await/maybeSingle. */
function makeQuery(table: string): unknown {
  const eqs: Array<[string, unknown]> = [];
  const neqs: Array<[string, unknown]> = [];
  let orderCol = "";
  let ascending = true;
  const api: Record<string, (...args: never[]) => unknown> = {};
  const resolveList = (): unknown => {
    if (table === "meta_parser_patches") {
      let rows = patchRows.filter((row) =>
        eqs.every(([col, val]) => (row as unknown as Record<string, unknown>)[col] === val)
      );
      rows = rows.filter((row) => neqs.every(([col, val]) => (row as unknown as Record<string, unknown>)[col] !== val));
      if (orderCol !== "") {
        rows = [...rows].sort((a, b) => {
          const av = (a as unknown as Record<string, unknown>)[orderCol] as string | null;
          const bv = (b as unknown as Record<string, unknown>)[orderCol] as string | null;
          if (av === null && bv === null) return 0;
          if (av === null) return 1;
          if (bv === null) return -1;
          if (av === bv) return 0;
          return ascending ? (av < bv ? -1 : 1) : (av > bv ? -1 : 1);
        });
      }
      return { data: rows, error: null };
    }
    if (table === "meta_parser_changes") {
      const patchId = eqs.find(([col]) => col === "patch_id")?.[1];
      return { count: typeof patchId === "string" ? (changeCounts[patchId] ?? 0) : 0, error: null };
    }
    return { data: [], error: null };
  };
  api["select"] = () => api;
  api["eq"] = ((col: string, val: unknown) => {
    eqs.push([col, val]);
    return api;
  }) as never;
  api["neq"] = ((col: string, val: unknown) => {
    neqs.push([col, val]);
    return api;
  }) as never;
  api["order"] = ((col: string, opts?: { ascending?: boolean }) => {
    orderCol = col;
    ascending = opts?.ascending ?? true;
    return api;
  }) as never;
  api["limit"] = () => api;
  api["maybeSingle"] = () => {
    if (table === "meta_parser_games") {
      const slug = eqs.find(([col]) => col === "slug")?.[1];
      const gated = eqs.some(([col, val]) => col === "is_active" && val === true);
      const found = typeof slug === "string" && gated && activeGames.includes(slug);
      return Promise.resolve({ data: found ? { slug } : null, error: null });
    }
    const resolved = resolveList() as { data: unknown[] };
    return Promise.resolve({ data: resolved.data[0] ?? null, error: null });
  };
  api["then"] = (resolve: (value: unknown) => unknown) => Promise.resolve(resolveList()).then(resolve);
  return api;
}

function healthyLedger(recentIso: string): LedgerOpts {
  return { lastRunStatus: "succeeded", lastRunAt: recentIso, lastSuccessAt: recentIso, totalRuns: 5 };
}

function baselinePatches(): { rows: PatchFixture[]; counts: Record<string, number> } {
  const rows: PatchFixture[] = [
    {
      id: "patch-dota-741",
      game_slug: "dota-2",
      patch_version: "7.41",
      title: "dota-2 7.41",
      source_url: "https://example.invalid/dota/7.41",
      source_published_at: "2026-10-10T00:00:00.000Z",
      revision: 1,
      status: "complete",
      content_hash: "hash-dota-741",
    },
    {
      id: "patch-val-1308",
      game_slug: "valorant",
      patch_version: "13.08",
      title: "valorant 13.08",
      source_url: "https://example.invalid/val/13.08",
      source_published_at: "2026-10-09T00:00:00.000Z",
      revision: 1,
      status: "complete",
      content_hash: "hash-val-1308",
    },
    {
      id: "patch-lol-2620",
      game_slug: "lol",
      patch_version: "26.20",
      title: "lol 26.20",
      source_url: "https://example.invalid/lol/26.20",
      source_published_at: "2026-10-08T00:00:00.000Z",
      revision: 1,
      status: "complete",
      content_hash: "hash-lol-2620",
    },
  ];
  return { rows, counts: { "patch-dota-741": 1726, "patch-val-1308": 187, "patch-lol-2620": 238 } };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSuperAdmin.mockResolvedValue({ id: "admin-1" });
  const base = baselinePatches();
  patchRows = base.rows;
  changeCounts = base.counts;
  activeGames = ["dota-2", "valorant", "lol"];
  ledgerByJob = {
    [metaParserJobIdForGame("dota-2")]: healthyLedger(hoursAgo(18)),
    [metaParserJobIdForGame("valorant")]: healthyLedger(hoursAgo(18)),
    [metaParserJobIdForGame("lol")]: healthyLedger(hoursAgo(18)),
    [META_PARSER_JOB_ID]: healthyLedger(hoursAgo(18)),
  };
  mockFrom.mockImplementation((table: string) => makeQuery(table) as never);
  mockLedgerSummaries.mockImplementation(async (jobIds: string[]) =>
    jobIds.map((jobId) => ledgerSummary(jobId, ledgerByJob[jobId] ?? {}))
  );
});

describe("meta-parser health status rules (pure)", () => {
  it("healthy on recent success, even with an in-progress latest run", () => {
    expect(
      determineMetaParserStatus({
        lastRunStatus: "succeeded",
        lastSuccessAt: hoursAgo(18),
        lastFailureAt: null,
        hasPublishedPatch: true,
        hasAnyRun: true,
        nowMs: Date.parse(NOW),
      })
    ).toEqual({ status: "healthy", reason: "recent-success" });
    expect(
      determineMetaParserStatus({
        lastRunStatus: "running",
        lastSuccessAt: hoursAgo(18),
        lastFailureAt: null,
        hasPublishedPatch: true,
        hasAnyRun: true,
        nowMs: Date.parse(NOW),
      }).status
    ).toBe("healthy");
  });

  it("stale when the last success is older than the 48h scheduler window", () => {
    expect(META_PARSER_HEALTHY_WINDOW_HOURS).toBe(48);
    expect(
      determineMetaParserStatus({
        lastRunStatus: "succeeded",
        lastSuccessAt: hoursAgo(120),
        lastFailureAt: null,
        hasPublishedPatch: true,
        hasAnyRun: true,
        nowMs: Date.parse(NOW),
      })
    ).toEqual({ status: "stale", reason: "success-too-old" });
  });

  it("failed latest attempt keeps the previous success visible, not overwritten", () => {
    expect(
      determineMetaParserStatus({
        lastRunStatus: "failed",
        lastSuccessAt: hoursAgo(20),
        lastFailureAt: hoursAgo(2),
        hasPublishedPatch: true,
        hasAnyRun: true,
        nowMs: Date.parse(NOW),
      })
    ).toEqual({ status: "failed", reason: "last-run-failed" });
  });

  it("failed with no success on record is failed, not stale or healthy", () => {
    expect(
      determineMetaParserStatus({
        lastRunStatus: "failed",
        lastSuccessAt: null,
        lastFailureAt: hoursAgo(2),
        hasPublishedPatch: false,
        hasAnyRun: true,
        nowMs: Date.parse(NOW),
      })
    ).toEqual({ status: "failed", reason: "last-run-failed-no-success" });
  });

  it("no runs and no patch is no-data", () => {
    expect(
      determineMetaParserStatus({
        lastRunStatus: null,
        lastSuccessAt: null,
        lastFailureAt: null,
        hasPublishedPatch: false,
        hasAnyRun: false,
        nowMs: Date.parse(NOW),
      })
    ).toEqual({ status: "no-data", reason: "no-runs-no-patch" });
  });

  it("an older failure does not mask a newer success", () => {
    expect(
      determineMetaParserStatus({
        lastRunStatus: "succeeded",
        lastSuccessAt: hoursAgo(18),
        lastFailureAt: hoursAgo(50),
        hasPublishedPatch: true,
        hasAnyRun: true,
        nowMs: Date.parse(NOW),
      }).status
    ).toBe("healthy");
  });

  it("unparseable timestamps never yield healthy or failed", () => {
    expect(
      determineMetaParserStatus({
        lastRunStatus: "succeeded",
        lastSuccessAt: "not-a-date",
        lastFailureAt: null,
        hasPublishedPatch: true,
        hasAnyRun: true,
        nowMs: Date.parse(NOW),
      }).status
    ).toBe("no-data");
  });
});

describe("getMetaParserHealth — loader", () => {
  it("all three games healthy with production baselines and deterministic order", async () => {
    const result = await getMetaParserHealth(NOW);
    expect(result.totalSources).toBe(3);
    expect(result.healthyCount).toBe(3);
    expect(result.games.map((g) => g.slug)).toEqual(["dota-2", "valorant", "lol"]);
    expect(result.games.map((g) => g.name)).toEqual(["Dota 2", "VALORANT", "League of Legends"]);
    const bySlug = new Map(result.games.map((g) => [g.slug, g] as const));
    expect(bySlug.get("dota-2")).toMatchObject({ status: "healthy", latestPatch: "7.41", changeCount: 1726 });
    expect(bySlug.get("valorant")).toMatchObject({ status: "healthy", latestPatch: "13.08", changeCount: 187 });
    expect(bySlug.get("lol")).toMatchObject({ status: "healthy", latestPatch: "26.20", changeCount: 238 });
    for (const game of result.games) {
      expect(game.lastSuccessAt).toBe(hoursAgo(18));
      expect(game.lastRunStatus).toBe("succeeded");
    }
  });

  it("stale ingestion on one game does not affect the others", async () => {
    ledgerByJob[metaParserJobIdForGame("dota-2")] = {
      lastRunStatus: "succeeded",
      lastRunAt: hoursAgo(120),
      lastSuccessAt: hoursAgo(120),
      totalRuns: 9,
    };
    const result = await getMetaParserHealth(NOW);
    const bySlug = new Map(result.games.map((g) => [g.slug, g] as const));
    expect(bySlug.get("dota-2")?.status).toBe("stale");
    expect(bySlug.get("valorant")?.status).toBe("healthy");
    expect(bySlug.get("lol")?.status).toBe("healthy");
    expect(result.healthyCount).toBe(2);
  });

  it("failed latest attempt with a previous successful run reports failed + keeps the success", async () => {
    ledgerByJob[metaParserJobIdForGame("valorant")] = {
      lastRunStatus: "failed",
      lastRunAt: hoursAgo(2),
      lastSuccessAt: hoursAgo(20),
      lastFailureAt: hoursAgo(2),
      failureSummary: "1 patch(es) failed: 13.08",
      totalRuns: 6,
    };
    const result = await getMetaParserHealth(NOW);
    const bySlug = new Map(result.games.map((g) => [g.slug, g] as const));
    const valorant = bySlug.get("valorant");
    expect(valorant?.status).toBe("failed");
    expect(valorant?.statusReason).toBe("last-run-failed");
    expect(valorant?.lastSuccessAt).toBe(hoursAgo(20));
    expect(valorant?.lastFailureSummary).toBe("1 patch(es) failed: 13.08");
    expect(valorant?.latestPatch).toBe("13.08");
    expect(bySlug.get("dota-2")?.status).toBe("healthy");
    expect(bySlug.get("lol")?.status).toBe("healthy");
  });

  it("no ingestion data yields no-data for every game", async () => {
    ledgerByJob = {};
    patchRows = [];
    mockLedgerSummaries.mockImplementation(async (jobIds: string[]) =>
      jobIds.map((jobId) => ledgerSummary(jobId, { totalRuns: 0, lastSuccessAt: null, lastFailureAt: null }))
    );
    const result = await getMetaParserHealth(NOW);
    expect(result.healthyCount).toBe(0);
    for (const game of result.games) {
      expect(game.status).toBe("no-data");
      expect(game.latestPatch).toBeNull();
      expect(game.changeCount).toBeNull();
      expect(game.lastSuccessAt).toBeNull();
    }
  });

  it("no new patch but healthy ingestion stays healthy (version change is not health)", async () => {
    const lol = patchRows.find((row) => row.game_slug === "lol");
    if (lol) lol.source_published_at = "2026-09-17T00:00:00.000Z";
    const result = await getMetaParserHealth(NOW);
    const bySlug = new Map(result.games.map((g) => [g.slug, g] as const));
    expect(bySlug.get("lol")?.status).toBe("healthy");
    expect(bySlug.get("lol")?.latestPatch).toBe("26.20");
  });

  it("falls back to legacy scheduler history for freshness before per-game rows exist", async () => {
    ledgerByJob = { [META_PARSER_JOB_ID]: healthyLedger(hoursAgo(18)) };
    mockLedgerSummaries.mockImplementation(async (jobIds: string[]) =>
      jobIds.map((jobId) => ledgerSummary(jobId, ledgerByJob[jobId] ?? { totalRuns: 0 }))
    );
    const result = await getMetaParserHealth(NOW);
    for (const game of result.games) {
      expect(game.status).toBe("healthy");
      expect(game.lastSuccessAt).toBe(hoursAgo(18));
      expect(game.lastRunStatus).toBeNull();
    }
  });

  it("picks the latest published patch and never staging or provisional rows", async () => {
    patchRows.push(
      {
        id: "patch-dota-740",
        game_slug: "dota-2",
        patch_version: "7.40",
        title: "dota-2 7.40",
        source_url: "https://example.invalid/dota/7.40",
        source_published_at: "2026-09-01T00:00:00.000Z",
        revision: 2,
        status: "complete",
        content_hash: "hash-dota-740",
      },
      {
        id: "patch-dota-staged-row",
        game_slug: "dota-2",
        patch_version: "7.42",
        title: "dota-2 7.42",
        source_url: "https://example.invalid/dota/7.42",
        source_published_at: "2026-10-16T00:00:00.000Z",
        revision: 1,
        status: "ingested",
        content_hash: "hash-dota-742",
      },
      {
        id: "patch-dota-provisional",
        game_slug: "dota-2",
        patch_version: "7.43",
        title: "dota-2 7.43",
        source_url: "https://example.invalid/dota/7.43",
        source_published_at: "2026-10-16T00:00:00.000Z",
        revision: 1,
        status: "complete",
        content_hash: "",
      }
    );
    const result = await getMetaParserHealth(NOW);
    const dota = new Map(result.games.map((g) => [g.slug, g] as const)).get("dota-2");
    expect(dota?.latestPatch).toBe("7.41");
    expect(dota?.changeCount).toBe(1726);
  });

  it("no cross-game contamination in patches or ledger attribution", async () => {
    patchRows = patchRows.filter((row) => row.game_slug === "dota-2");
    ledgerByJob[metaParserJobIdForGame("dota-2")] = {
      lastRunStatus: "failed",
      lastRunAt: hoursAgo(2),
      lastSuccessAt: null,
      lastFailureAt: hoursAgo(2),
      failureSummary: "discovery failed",
      totalRuns: 1,
    };
    const result = await getMetaParserHealth(NOW);
    const bySlug = new Map(result.games.map((g) => [g.slug, g] as const));
    expect(bySlug.get("dota-2")?.status).toBe("failed");
    expect(bySlug.get("dota-2")?.latestPatch).toBe("7.41");
    expect(bySlug.get("valorant")?.status).toBe("healthy");
    expect(bySlug.get("valorant")?.latestPatch).toBeNull();
    expect(bySlug.get("valorant")?.lastFailureAt).toBeNull();
    expect(bySlug.get("lol")?.status).toBe("healthy");
    expect(bySlug.get("lol")?.latestPatch).toBeNull();
  });

  it("supports exactly the three wired games — no BGMI, no speculative games", () => {
    expect(META_PARSER_HEALTH_GAMES.map((g) => g.slug)).toEqual(["dota-2", "valorant", "lol"]);
    expect(META_PARSER_HEALTH_GAMES.map((g) => g.slug)).not.toContain("bgmi");
  });

  it("rejects non-Superadmin callers before touching data", async () => {
    mockRequireSuperAdmin.mockRejectedValueOnce(new Error("Super admin access required"));
    await expect(getMetaParserHealth(NOW)).rejects.toThrow("Super admin access required");
    expect(mockLedgerSummaries).not.toHaveBeenCalled();
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockRequireSuperAdmin).toHaveBeenCalled();
  });
});

describe("meta-parser health — security and read-only structure", () => {
  it("service gates on requireSuperAdmin, uses the admin client, never mutates", () => {
    const svc = readFileSync("src/server/admin/meta-parser-health.ts", "utf8");
    expect(svc).toContain("requireSuperAdmin");
    expect(svc).toContain("createAdminClient");
    expect(svc).not.toMatch(/\.insert\(/);
    expect(svc).not.toMatch(/\.update\(/);
    expect(svc).not.toMatch(/\.delete\(/);
    expect(svc).not.toContain('"use client"');
    expect(svc).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  it("game scope is a fixed allowlist — no user-controlled identifiers", () => {
    const svc = readFileSync("src/server/admin/meta-parser-health.ts", "utf8");
    expect(svc).toContain("META_PARSER_HEALTH_GAMES");
    expect(svc).not.toMatch(/searchParams|params\.game|query\.game/);
  });

  it("ingestion route records per-game ledger rows, summarizes failures, completes unknown adapters", () => {
    const route = readFileSync("src/app/api/ingest/meta-parser/route.ts", "utf8");
    expect(route).toContain("metaParserJobIdForGame");
    expect(route).toContain("patch(es) failed");
    const notFoundAt = route.indexOf("No adapter registered");
    expect(notFoundAt).toBeGreaterThan(-1);
    expect(route.slice(0, notFoundAt)).toContain("recordCronRunComplete");
  });

  it("admin pages expose read-only health with no ingestion controls", () => {
    for (const file of ["src/app/(admin)/admin/system/page.tsx", "src/app/(admin)/admin/page.tsx"]) {
      const page = readFileSync(file, "utf8");
      expect(page).toContain("Meta-Parser Health");
      expect(page).toContain("requireSuperAdmin");
      expect(page).not.toMatch(/\.insert\(/);
      expect(page).not.toMatch(/\.update\(/);
      expect(page).not.toMatch(/\.delete\(/);
      expect(page).not.toContain("createAdminClient");
      expect(page).not.toMatch(/run ingestion|retry ingestion|force publish|manual sync/i);
    }
  });
});
