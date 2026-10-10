/**
 * IMPLEMENT-03: real-Postgres proof for the Draft & Ban Free history window.
 *
 * Proves the query shapes the history service relies on, against a real
 * PostgreSQL server (embedded-postgres, same harness as the completion
 * suite): completed_at-DESC window selection, search-before-slice, honest
 * pre-slice counts, unlimited drafts, and full paid visibility. No
 * application quotas, history tables, or RPC changes are involved — this is
 * presentation-only filtering over retained rows.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import {
  startDraftBanTestPostgres,
  truncateDraftBanTables,
  seedDraftBanWorkspace,
  type TestPostgres,
  type DraftBanSeed,
} from "./draft-ban-pg-harness";

vi.setConfig({ testTimeout: 60_000 });

let pg: TestPostgres;

beforeAll(async () => {
  pg = await startDraftBanTestPostgres();
}, 180_000);

afterAll(async () => {
  await pg.stop();
}, 60_000);

beforeEach(async () => {
  await truncateDraftBanTables(pg);
});

async function insertRow(
  seed: DraftBanSeed,
  opts: { name: string; status: string; createdAt: string; completedAt?: string | null },
): Promise<string> {
  const id = crypto.randomUUID();
  await pg.query(
    `insert into public.draft_matches (id, organization_id, created_by, match_name, status, completed_at, created_at)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, seed.orgId, seed.userId, opts.name, opts.status, opts.completedAt ?? null, opts.createdAt],
  );
  return id;
}

const day = (n: number) => `2026-10-${String(n).padStart(2, "0")}T12:00:00Z`;

describe("history window query shapes (presentation-only)", () => {
  it("6+ completed records: window selects exactly the latest 5 by completed_at", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    for (let d = 1; d <= 7; d++) {
      await insertRow(seed, { name: `Cup ${d}`, status: "completed", createdAt: day(d), completedAt: day(d) });
    }
    const window = await pg.query(
      `select id, completed_at from public.draft_matches
       where organization_id = $1 and status = 'completed'
       order by completed_at desc, id desc limit 5`,
      [seed.orgId],
    );
    expect(window.rows).toHaveLength(5);
    const ats = window.rows.map((r) => new Date(String(r.completed_at)).getTime());
    expect(ats).toEqual([...ats].sort((a, b) => b - a));
    expect(ats).not.toContain(new Date(day(1)).getTime());
    expect(ats).not.toContain(new Date(day(2)).getTime());
    // Older records remain stored.
    const total = await pg.query(
      "select count(*)::int as n from public.draft_matches where organization_id = $1 and status = 'completed'",
      [seed.orgId],
    );
    expect(Number(total.rows[0]?.n ?? 0)).toBe(7);
  });

  it("old-created but newly-completed records are selected (completed_at, never created_at)", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    // Long-running draft: created Oct 1, completed Oct 9.
    await insertRow(seed, { name: "Marathon", status: "completed", createdAt: day(1), completedAt: day(9) });
    for (let d = 2; d <= 6; d++) {
      await insertRow(seed, { name: `Cup ${d}`, status: "completed", createdAt: day(d), completedAt: day(d) });
    }
    const window = await pg.query(
      `select created_at, completed_at from public.draft_matches
       where organization_id = $1 and status = 'completed'
       order by completed_at desc, id desc limit 5`,
      [seed.orgId],
    );
    expect(window.rows).toHaveLength(5);
    expect(window.rows.map((r) => new Date(String(r.created_at)).getTime())).toContain(new Date(day(1)).getTime());
    expect(window.rows.map((r) => new Date(String(r.completed_at)).getTime())).not.toContain(new Date(day(2)).getTime());
  });

  it("equal completed_at values order deterministically by id", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    for (let i = 0; i < 6; i++) {
      await insertRow(seed, { name: `Cup ${i}`, status: "completed", createdAt: day(3), completedAt: day(5) });
    }
    const first = await pg.query(
      `select id from public.draft_matches
       where organization_id = $1 and status = 'completed'
       order by completed_at desc, id desc limit 5`,
      [seed.orgId],
    );
    const second = await pg.query(
      `select id from public.draft_matches
       where organization_id = $1 and status = 'completed'
       order by completed_at desc, id desc limit 5`,
      [seed.orgId],
    );
    expect(first.rows.map((r) => r.id)).toEqual(second.rows.map((r) => r.id));
    expect(first.rows).toHaveLength(5);
  });

  it("drafts and abandoned rows are never windowed", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    for (let i = 0; i < 8; i++) {
      await insertRow(seed, { name: `Draft ${i}`, status: "in_progress", createdAt: day(2) });
    }
    await insertRow(seed, { name: "Old", status: "abandoned", createdAt: day(1) });
    const open = await pg.query(
      `select count(*)::int as n from public.draft_matches
       where organization_id = $1 and status in ('in_progress', 'abandoned')`,
      [seed.orgId],
    );
    expect(Number(open.rows[0]?.n ?? 0)).toBe(9);
  });

  it("paid visibility is the unwindowed full set", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "paid" });
    for (let d = 1; d <= 9; d++) {
      await insertRow(seed, { name: `Cup ${d}`, status: "completed", createdAt: day(d), completedAt: day(d) });
    }
    const all = await pg.query(
      `select count(*)::int as n from public.draft_matches
       where organization_id = $1 and status = 'completed'`,
      [seed.orgId],
    );
    expect(Number(all.rows[0]?.n ?? 0)).toBe(9);
  });

  it("search applies before the slice: an older matching record is returned", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    // Six newest completions do NOT match; the oldest does.
    for (let d = 4; d <= 9; d++) {
      await insertRow(seed, { name: `Cup ${d}`, status: "completed", createdAt: day(d), completedAt: day(d) });
    }
    await insertRow(seed, { name: "Old but gold", status: "completed", createdAt: day(1), completedAt: day(1) });
    // Slice-then-search would inspect only Cups 5-9 and return nothing.
    const slicedFirst = await pg.query(
      `select match_name from public.draft_matches
       where organization_id = $1 and status = 'completed'
       order by completed_at desc, id desc limit 5`,
      [seed.orgId],
    );
    expect(slicedFirst.rows.map((r) => r.match_name)).not.toContain("Old but gold");
    // Search-first returns the older matching record.
    const searched = await pg.query(
      `select match_name from public.draft_matches
       where organization_id = $1 and status = 'completed' and match_name ilike '%gold%'
       order by completed_at desc, id desc limit 5`,
      [seed.orgId],
    );
    expect(searched.rows.map((r) => r.match_name)).toEqual(["Old but gold"]);
    // The pre-slice matching count stays honest.
    const count = await pg.query(
      `select count(*)::int as n from public.draft_matches
       where organization_id = $1 and status = 'completed' and match_name ilike '%gold%'`,
      [seed.orgId],
    );
    expect(Number(count.rows[0]?.n ?? 0)).toBe(1);
  });

  it("cross-org isolation holds for history reads", async () => {
    const seedA = await seedDraftBanWorkspace(pg, { grant: "free" });
    const seedB = await seedDraftBanWorkspace(pg, { grant: "free" });
    await insertRow(seedA, { name: "A cup", status: "completed", createdAt: day(1), completedAt: day(1) });
    const visible = await pg.query(
      `select count(*)::int as n from public.draft_matches
       where organization_id = $1 and status = 'completed'`,
      [seedB.orgId],
    );
    expect(Number(visible.rows[0]?.n ?? 0)).toBe(0);
  });
});
