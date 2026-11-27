/**
 * IMPLEMENT-02A: real-Postgres proof for consume_draft_ban_completion.
 *
 * Exercises the ACTUAL shipped SQL (extracted verbatim from
 * supabase/migrations/20251028000001_draft_ban_free_completion.sql) against
 * a real multi-backend PostgreSQL server (embedded-postgres). Every race
 * test uses independent pg Pools (= independent backends; PIDs asserted
 * distinct).
 *
 * Covers the 30 required proofs: quota, ledger permanence across deletion,
 * idempotency, concurrency, paid/All Access bypass, security, timezone/DST,
 * and regression isolation.
 *
 * Lane: starts one embedded server per file (~10s). Not skippable.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import {
  startDraftBanTestPostgres,
  truncateDraftBanTables,
  seedDraftBanWorkspace,
  insertMatch,
  type TestPostgres,
  type DraftBanSeed,
} from "./draft-ban-pg-harness";

type CompleteResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; code: string; message: string };

// Multi-round-trip tests share one embedded server; under full-suite load
// individual round trips slow down, so the default 5s per-test timeout is
// raised (assertions unchanged — timeouts prove nothing about atomicity).
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

async function complete(
  pool: Pool,
  seed: DraftBanSeed,
  matchId: string,
  userId?: string,
): Promise<CompleteResult> {
  const client = await pool.connect();
  try {
    // SELECT * FROM evaluates a side-effecting function exactly once.
    const res = await client.query("select * from public.consume_draft_ban_completion($1,$2,$3)", [
      seed.orgId,
      matchId,
      userId ?? seed.userId,
    ]);
    return { ok: true, row: res.rows[0] as Record<string, unknown> };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, code: String(err.code ?? "?"), message: String(err.message ?? e).slice(0, 300) };
  } finally {
    client.release();
  }
}

async function ledgerCount(orgId: string): Promise<number> {
  const r = await pg.query(
    "select count(*)::int as n from public.draft_ban_monthly_completions where organization_id = $1",
    [orgId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

async function completedCount(orgId: string): Promise<number> {
  const r = await pg.query("select count(*)::int as n from public.draft_matches where organization_id = $1 and status = 'completed'", [
    orgId,
  ]);
  return Number(r.rows[0]?.n ?? 0);
}

async function backendPid(pool: Pool): Promise<number> {
  const r = await pool.query("select pg_backend_pid() as pid");
  return Number((r.rows[0] as Record<string, unknown>).pid);
}

/** Current workspace-local month key, computed exactly like the RPC. */
async function localMonthKey(tz: string): Promise<string> {
  const r = await pg.query("select to_char(now() at time zone $1, 'YYYY-MM') as k", [tz]);
  return String(r.rows[0]?.k ?? "");
}

describe("monthly quota (1 per workspace-local month, ledger-based)", () => {
  it("1. first Free completion succeeds and writes exactly one ledger row", async () => {
    const seed = await seedDraftBanWorkspace(pg, { timezone: "Asia/Kolkata", grant: "free" });
    const before = new Date();
    const res = await complete(pg.pool, seed, await insertMatch(pg, seed));
    const after = new Date();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.row.status).toBe("completed");
      expect(res.row.completed_at).toBeTruthy();
      // 20. completed_at is database-generated (within the call window).
      const at = new Date(String(res.row.completed_at)).getTime();
      expect(at).toBeGreaterThanOrEqual(before.getTime() - 1000);
      expect(at).toBeLessThanOrEqual(after.getTime() + 1000);
    }
    // 3. Ledger contains exactly one row after first completion.
    expect(await ledgerCount(seed.orgId)).toBe(1);
    const key = await pg.query(
      "select month_key from public.draft_ban_monthly_completions where organization_id = $1",
      [seed.orgId],
    );
    expect(key.rows[0]?.month_key).toBe(await localMonthKey("Asia/Kolkata"));
  });

  it("2. second Free completion same month fails with a stable quota error", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
    const second = await complete(pg.pool, seed, await insertMatch(pg, seed));
    expect(second.ok).toBe(false);
    if (!second.ok) {
      expect(second.code).toBe("DBQ01");
      expect(second.message).toMatch(/quota_exceeded/);
      expect(second.message).not.toMatch(/postgres|SQLSTATE|consume_draft_ban_completion/i);
    }
    expect(await ledgerCount(seed.orgId)).toBe(1);
    expect(await completedCount(seed.orgId)).toBe(1);
  });

  it("4/5/6/30. deleting a completed match keeps the ledger row; quota stays exhausted", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const id = await insertMatch(pg, seed);
    expect((await complete(pg.pool, seed, id)).ok).toBe(true);
    expect(await ledgerCount(seed.orgId)).toBe(1);
    // 4. Delete the completed match (existing UX preserved).
    await pg.query("delete from public.draft_matches where id = $1", [id]);
    expect(await completedCount(seed.orgId)).toBe(0);
    // 5. Ledger row remains after deletion.
    expect(await ledgerCount(seed.orgId)).toBe(1);
    // 6/30. Second completion still fails after deletion.
    const retry = await complete(pg.pool, seed, await insertMatch(pg, seed));
    expect(retry.ok).toBe(false);
    if (!retry.ok) expect(retry.code).toBe("DBQ01");
  });

  it("7. abandoned matches consume nothing and cannot complete afterwards", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const doomed = await insertMatch(pg, seed);
    await pg.query("update public.draft_matches set status = 'abandoned' where id = $1", [doomed]);
    const res = await complete(pg.pool, seed, doomed);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBD01");
    expect(await ledgerCount(seed.orgId)).toBe(0);
    // The monthly slot is intact: a fresh match still completes.
    expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
    expect(await ledgerCount(seed.orgId)).toBe(1);
  });

  it("8. failed/rejected completions (missing match) consume nothing", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const res = await complete(pg.pool, seed, crypto.randomUUID());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
    expect(await ledgerCount(seed.orgId)).toBe(0);
    expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
  });

  it("draft creation stays unlimited while quota is exhausted", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
    // New drafts can still be created (INSERT path untouched by quota).
    const draft = await insertMatch(pg, seed, { status: "in_progress" });
    const check = await pg.query("select status from public.draft_matches where id = $1", [draft]);
    expect(check.rows[0]?.status).toBe("in_progress");
  });
});

describe("idempotency (same-match replay consumes zero additional quota)", () => {
  it("9. sequential replay returns the existing record with no second ledger row", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const id = await insertMatch(pg, seed);
    const first = await complete(pg.pool, seed, id);
    expect(first.ok).toBe(true);
    const second = await complete(pg.pool, seed, id);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.row.id).toBe(first.row.id);
      expect(new Date(String(second.row.completed_at)).getTime()).toBe(
        new Date(String(first.row.completed_at)).getTime(),
      );
    }
    expect(await ledgerCount(seed.orgId)).toBe(1);
    expect(await completedCount(seed.orgId)).toBe(1);
  });

  it("10. concurrent finalizations of the same match converge idempotently", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const id = await insertMatch(pg, seed);
    const pools = [pg.newPool(), pg.newPool(), pg.newPool()];
    try {
      const pids = await Promise.all(pools.map(backendPid));
      expect(new Set(pids).size).toBe(3);
      const results = await Promise.all(pools.map((p) => complete(p, seed, id)));
      expect(results.every((r) => r.ok)).toBe(true);
      const ats = new Set(
        results.map((r) => new Date(String((r as { ok: true; row: Record<string, unknown> }).row.completed_at)).getTime()),
      );
      expect(ats.size).toBe(1);
      // Exactly one lifecycle transition and one ledger row — no
      // immutable-transition error for the losing replays.
      expect(await ledgerCount(seed.orgId)).toBe(1);
      expect(await completedCount(seed.orgId)).toBe(1);
    } finally {
      await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
    }
  });
});

describe("concurrency (independent backends)", () => {
  it("11. two different matches, one slot → exactly one succeeds", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const a = await insertMatch(pg, seed);
    const b = await insertMatch(pg, seed);
    const [pa, pb] = [pg.newPool(), pg.newPool()];
    try {
      const pids = await Promise.all([backendPid(pa), backendPid(pb)]);
      expect(new Set(pids).size).toBe(2);
      const [ra, rb] = await Promise.all([complete(pa, seed, a), complete(pb, seed, b)]);
      const oks = [ra, rb].filter((r) => r.ok);
      const denied = [ra, rb].filter((r) => !r.ok);
      expect(oks.length).toBe(1);
      expect(denied.length).toBe(1);
      expect((denied[0] as { code: string }).code).toBe("DBQ01");
      expect(await ledgerCount(seed.orgId)).toBe(1);
      expect(await completedCount(seed.orgId)).toBe(1);
    } finally {
      await Promise.all([pa.end().catch(() => undefined), pb.end().catch(() => undefined)]);
    }
  });
});

describe("paid / all-access bypass (no ledger rows)", () => {
  it("12. paid orgs complete multiple matches with zero ledger rows", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "paid" });
    for (let i = 0; i < 3; i++) {
      expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
    }
    expect(await completedCount(seed.orgId)).toBe(3);
    expect(await ledgerCount(seed.orgId)).toBe(0);
  });

  it("13. all-access orgs complete multiple matches with zero ledger rows", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "all-access" });
    for (let i = 0; i < 3; i++) {
      expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
    }
    expect(await completedCount(seed.orgId)).toBe(3);
    expect(await ledgerCount(seed.orgId)).toBe(0);
  });

  it("14. expired paid + Free uses the Free quota", async () => {
    // Unique (organization_id, tool_id) forbids two per-tool rows, so the
    // coexistable production shape is: expired paid All Access + Free
    // per-tool grant. Paid coverage is expired → Free quota must apply.
    const seed = await seedDraftBanWorkspace(pg, { grant: null });
    const tool = await pg.query("select id from public.tools where slug = 'draft-ban'");
    const toolId = String(tool.rows[0]?.id ?? "");
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, null, true, 'subscription', $2)",
      [seed.orgId, new Date(Date.now() - 86400000).toISOString()],
    );
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, $2, false, 'free', null)",
      [seed.orgId, toolId],
    );
    expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
    const second = await complete(pg.pool, seed, await insertMatch(pg, seed));
    expect(second.ok).toBe(false);
    if (!second.ok) expect(second.code).toBe("DBQ01");
  });
});

describe("security (fail closed)", () => {
  it("15. org without any grant cannot complete (DBN01)", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: null });
    const res = await complete(pg.pool, seed, await insertMatch(pg, seed));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
    expect(await ledgerCount(seed.orgId)).toBe(0);
  });

  it("16. non-member cannot complete (DBN01)", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const res = await complete(pg.pool, seed, await insertMatch(pg, seed), crypto.randomUUID());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
    expect(await ledgerCount(seed.orgId)).toBe(0);
  });

  it("17. foreign organization id cannot be injected (DBN01)", async () => {
    const seedA = await seedDraftBanWorkspace(pg, { grant: "free" });
    const seedB = await seedDraftBanWorkspace(pg, { grant: "free" });
    const idA = await insertMatch(pg, seedA);
    const res = await complete(pg.pool, seedB, idA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
  });

  it("27. sponsorship user grant alone cannot unlock Draft & Ban (DBN01)", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: null });
    const sponsor = await pg.query("select id from public.tools where slug = 'sponsor-sentinel'");
    await pg.query(
      "insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at) values ($1, $2, 'subscription', null)",
      [seed.userId, String(sponsor.rows[0]?.id ?? "")],
    );
    const res = await complete(pg.pool, seed, await insertMatch(pg, seed));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
    expect(await ledgerCount(seed.orgId)).toBe(0);
  });

  it("18. direct status→completed writes are rejected (DBK01) — the RPC path is mandatory", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const id = await insertMatch(pg, seed);
    const attempt = await pg
      .query("update public.draft_matches set status = 'completed', completed_at = now() where id = $1", [id])
      .then(
        () => ({ blocked: false }),
        (e: { code?: string }) => ({ blocked: true, code: String(e.code ?? "?") }),
      );
    expect(attempt.blocked).toBe(true);
    expect((attempt as { code?: string }).code).toBe("DBK01");
    expect(await completedCount(seed.orgId)).toBe(0);
    expect(await ledgerCount(seed.orgId)).toBe(0);
  });

  it("21. forged completed_at updates are rejected (DBK01) even without a status change", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const id = await insertMatch(pg, seed);
    const attempt = await pg
      .query("update public.draft_matches set completed_at = now() where id = $1", [id])
      .then(
        () => ({ blocked: false }),
        (e: { code?: string }) => ({ blocked: true, code: String(e.code ?? "?") }),
      );
    expect(attempt.blocked).toBe(true);
    expect((attempt as { code?: string }).code).toBe("DBK01");
  });

  it("19. legitimate in_progress → abandoned still works", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const id = await insertMatch(pg, seed);
    await pg.query("update public.draft_matches set status = 'abandoned' where id = $1", [id]);
    const check = await pg.query("select status from public.draft_matches where id = $1", [id]);
    expect(check.rows[0]?.status).toBe("abandoned");
    expect(await ledgerCount(seed.orgId)).toBe(0);
  });

  it("invalid workspace timezones cannot be stored (defense in depth)", async () => {
    const userId = crypto.randomUUID();
    await pg.query("insert into public.profiles (id) values ($1)", [userId]);
    const attempt = await pg
      .query("insert into public.organizations (id, name, slug, owner_id, timezone) values ($1, 'Bad', $2, $3, 'Not/AZone')", [
        crypto.randomUUID(),
        `bad-${userId.slice(0, 8)}`,
        userId,
      ])
      .then(
        () => ({ blocked: false }),
        () => ({ blocked: true }),
      );
    expect(attempt.blocked).toBe(true);
  });
});

describe("cross-org isolation", () => {
  it("org A's quota never affects org B", async () => {
    const seedA = await seedDraftBanWorkspace(pg, { timezone: "Asia/Kolkata", grant: "free" });
    const orgB = crypto.randomUUID();
    await pg.query("insert into public.organizations (id, name, slug, owner_id, timezone) values ($1, 'OrgB', $2, $3, 'Asia/Kolkata')", [
      orgB,
      `orgb-${orgB.slice(0, 8)}`,
      seedA.userId,
    ]);
    await pg.query("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')", [orgB, seedA.userId]);
    const tool = await pg.query("select id from public.tools where slug = 'draft-ban'");
    await pg.query("insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, $2, false, 'free', null)", [
      orgB,
      String(tool.rows[0]?.id ?? ""),
    ]);
    const seedB = { userId: seedA.userId, orgId: orgB, toolId: String(tool.rows[0]?.id ?? "") };

    expect((await complete(pg.pool, seedA, await insertMatch(pg, seedA))).ok).toBe(true);
    const blockedA = await complete(pg.pool, seedA, await insertMatch(pg, seedA));
    expect(blockedA.ok).toBe(false);

    expect((await complete(pg.pool, seedB, await insertMatch(pg, seedB))).ok).toBe(true);
    expect(await ledgerCount(seedB.orgId)).toBe(1);
    expect(await ledgerCount(seedA.orgId)).toBe(1);
  });
});

/** UTC instant of the current workspace-local month start (00:00 on the 1st in tz). */
function localMonthStartUtc(now: Date, tz: string): Date {
  const key = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(now);
  const [y, m] = key.split("-").map(Number);
  const target = Date.UTC(y as number, (m as number) - 1, 1, 0, 0, 0);
  const offsetAt = (d: Date): number => {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(d)
        .map((p) => [p.type, p.value]),
    );
    const asUtc = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    );
    return asUtc - d.getTime();
  };
  let guess = target - offsetAt(new Date(target));
  for (let i = 0; i < 3; i++) guess = target - offsetAt(new Date(guess));
  return new Date(guess);
}

describe("workspace-local month boundaries (never UTC)", () => {
  for (const tz of ["Asia/Kolkata", "America/New_York", "Europe/London"]) {
    it(`${tz}: ledger month_key equals the workspace-local month (22/23/24/25)`, async () => {
      const seed = await seedDraftBanWorkspace(pg, { timezone: tz, grant: "free" });
      expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
      const expected = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(new Date());
      const key = await pg.query(
        "select month_key from public.draft_ban_monthly_completions where organization_id = $1",
        [seed.orgId],
      );
      expect(key.rows[0]?.month_key).toBe(expected);
    });

    it(`${tz}: prior-local-month ledger rows do not consume the current month`, async () => {
      const start = localMonthStartUtc(new Date(), tz);
      const beforeKey = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit" }).format(
        new Date(start.getTime() - 60000),
      );
      const seed = await seedDraftBanWorkspace(pg, { timezone: tz, grant: "free" });
      await pg.query(
        "insert into public.draft_ban_monthly_completions (organization_id, month_key, match_id) values ($1, $2, $3)",
        [seed.orgId, beforeKey, crypto.randomUUID()],
      );
      expect((await complete(pg.pool, seed, await insertMatch(pg, seed))).ok).toBe(true);
    });
  }

  it("fixed instants: UTC and workspace months differ exactly as specified", async () => {
    // 2026-10-31T18:45Z is Nov 1 00:15 IST but still Oct 31 UTC.
    const r = await pg.query(
      `select to_char(timestamptz '2026-10-31T18:45:00Z' at time zone 'Asia/Kolkata', 'YYYY-MM') as ist,
              to_char(timestamptz '2026-10-31T18:45:00Z' at time zone 'UTC', 'YYYY-MM') as utc,
              to_char(timestamptz '2026-11-01T03:30:00Z' at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') as ny_oct,
              to_char(timestamptz '2026-11-01T04:05:00Z' at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') as ny_nov`,
    );
    const row = r.rows[0] as Record<string, string>;
    expect(row.ist).toBe("2026-11");
    expect(row.utc).toBe("2026-10");
    expect(row.ny_oct).toBe("2026-10-31 23:30");
    expect(row.ny_nov).toBe("2026-11-01 00:05");
  });

  it("DST transitions resolve in wall time, not fixed offsets (26)", async () => {
    // US spring forward Mar 8 2026 02:00→03:00 EST→EDT; London BST ends Oct 25 2026.
    const r = await pg.query(
      `select to_char(timestamptz '2026-03-08T07:30:00Z' at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') as ny_spring,
              to_char(timestamptz '2026-11-01T05:30:00Z' at time zone 'America/New_York', 'YYYY-MM-DD HH24:MI') as ny_fall,
              to_char(timestamptz '2026-10-25T00:30:00Z' at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI') as london_bst,
              to_char(timestamptz '2026-10-25T01:30:00Z' at time zone 'Europe/London', 'YYYY-MM-DD HH24:MI') as london_gmt`,
    );
    const row = r.rows[0] as Record<string, string>;
    expect(row.ny_spring).toBe("2026-03-08 03:30");
    expect(row.ny_fall).toBe("2026-11-01 01:30");
    expect(row.london_bst).toBe("2026-10-25 01:30");
    expect(row.london_gmt).toBe("2026-10-25 01:30");
  });
});
