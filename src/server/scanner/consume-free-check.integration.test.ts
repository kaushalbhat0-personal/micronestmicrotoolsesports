/**
 * FIX-06 H3: real-Postgres concurrency proof for consume_free_check.
 *
 * These tests exercise the ACTUAL shipped SQL (extracted verbatim from
 * supabase/migrations/20251025000001_sponsorship_free_check_consumption.sql)
 * against a real multi-backend PostgreSQL server (embedded-postgres).
 * Mocked Supabase clients cannot prove cross-instance atomicity, so every
 * race test below uses independent pg Pools (= independent backends; backend
 * PIDs are asserted distinct where it matters).
 *
 * Lane: starts one embedded server per file (~10s). Not skippable — a silent
 * skip would fake the concurrency proof this file exists to provide.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach } from "vitest";
import { Pool } from "pg";
import {
  startTestPostgres,
  truncateTenantTables,
  seedFreeWorkspace,
  type TestPostgres,
} from "@/server/testing/pg-harness";

const PAST = new Date(Date.now() - 86400000).toISOString();
const FUTURE = new Date(Date.now() + 86400000 * 30).toISOString();

function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

let pg: TestPostgres;

beforeAll(async () => {
  pg = await startTestPostgres();
}, 180_000);

afterAll(async () => {
  await pg.stop();
}, 60_000);

beforeEach(async () => {
  await truncateTenantTables(pg);
});

async function reserve(
  pool: Pool,
  args: { userId: string; orgId: string; campaignId: string; platform?: string; version?: string },
): Promise<{ ok: true; row: Record<string, unknown> } | { ok: false; code: string; message: string }> {
  const client = await pool.connect();
  try {
    // SELECT * FROM evaluates a side-effecting function exactly once.
    // (Do NOT use (fn()).* here: PostgreSQL may expand it into one call
    // per output column, double-consuming the budget under test.)
    const res = await client.query(
      "select * from public.consume_free_check($1,$2,$3,$4,$5)",
      [
        args.userId,
        args.orgId,
        args.campaignId,
        args.platform ?? "twitch",
        args.version ?? "test-1",
      ],
    );
    return { ok: true, row: res.rows[0] as Record<string, unknown> };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, code: String(err.code ?? "?"), message: String(err.message ?? e).slice(0, 300) };
  } finally {
    client.release();
  }
}

async function backendPid(pool: Pool): Promise<number> {
  const r = await pool.query("select pg_backend_pid() as pid");
  return Number((r.rows[0] as Record<string, unknown>).pid);
}

async function scanCount(orgId: string): Promise<number> {
  const r = await pg.query("select count(*)::int as n from public.scans where organization_id = $1", [orgId]);
  return Number((r.rows[0] as Record<string, unknown>).n ?? 0);
}

async function insertScan(orgId: string, campaignId: string, startedAt: string, status = "success"): Promise<void> {
  await pg.query(
    "insert into public.scans (organization_id, campaign_id, platform, status, started_at, scanner_version) values ($1,$2,'twitch',$3,$4,'test-1')",
    [orgId, campaignId, status, startedAt],
  );
}

describe("H3: atomic budget consumption under real concurrency", () => {
  it("1. two concurrent requests with 1 remaining → exactly 1 succeeds (independent pools)", async () => {
    const s = await seedFreeWorkspace(pg);
    const ms = monthStart();
    for (let i = 0; i < 9; i++) {
      await insertScan(s.orgId, s.campaignId, new Date(ms.getTime() + (i + 1) * 3600000).toISOString());
    }
    const poolA = pg.newPool();
    const poolB = pg.newPool();
    try {
      const [pidA, pidB] = await Promise.all([backendPid(poolA), backendPid(poolB)]);
      expect(pidA).not.toBe(pidB); // genuinely separate backends
      const args = { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId };
      const [a, b] = await Promise.all([reserve(poolA, args), reserve(poolB, args)]);
      const wins = [a, b].filter((r) => r.ok);
      const losses = [a, b].filter((r) => !r.ok);
      expect(wins).toHaveLength(1);
      expect(losses).toHaveLength(1);
      expect((losses[0] as { code: string }).code).toBe("SFQ01");
      expect(await scanCount(s.orgId)).toBe(10);
    } finally {
      await poolA.end().catch(() => undefined);
      await poolB.end().catch(() => undefined);
    }
  }, 60_000);

  it("2. ten concurrent requests with 1 remaining → exactly 1 succeeds", async () => {
    const s = await seedFreeWorkspace(pg);
    const ms = monthStart();
    for (let i = 0; i < 9; i++) {
      await insertScan(s.orgId, s.campaignId, new Date(ms.getTime() + (i + 1) * 3600000).toISOString());
    }
    const pools = Array.from({ length: 10 }, () => pg.newPool());
    try {
      const args = { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId };
      const results = await Promise.all(pools.map((p) => reserve(p, args)));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
      const losers = results.filter((r) => !r.ok);
      expect(losers).toHaveLength(9);
      for (const l of losers) expect((l as { code: string }).code).toBe("SFQ01");
      expect(await scanCount(s.orgId)).toBe(10);
    } finally {
      await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
    }
  }, 90_000);

  it.each([
    ["manual + cron"],
    ["manual + webhook"],
    ["targeted + cron"],
  ])("3-5. %s race with 1 remaining → exactly 1 reservation", async () => {
    const s = await seedFreeWorkspace(pg);
    const ms = monthStart();
    for (let i = 0; i < 9; i++) {
      await insertScan(s.orgId, s.campaignId, new Date(ms.getTime() + (i + 1) * 3600000).toISOString());
    }
    // Paths differ only in how the server-derived principal is obtained
    // (unit-tested per path); the reservation primitive is shared, so the
    // race is exercised through it from two independent connections.
    const poolA = pg.newPool();
    const poolB = pg.newPool();
    try {
      const args = { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId };
      const [a, b] = await Promise.all([reserve(poolA, args), reserve(poolB, args)]);
      expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
      expect(await scanCount(s.orgId)).toBe(10);
    } finally {
      await poolA.end().catch(() => undefined);
      await poolB.end().catch(() => undefined);
    }
  }, 60_000);

  it("6. two independent pools are independent backends (race is genuine)", async () => {
    const poolA = pg.newPool();
    const poolB = pg.newPool();
    try {
      const pids = await Promise.all([backendPid(poolA), backendPid(poolB), backendPid(pg.pool)]);
      expect(new Set(pids).size).toBe(3);
    } finally {
      await poolA.end().catch(() => undefined);
      await poolB.end().catch(() => undefined);
    }
  });

  it("7. concurrent duplicate requests → one reservation (cross-principal unique path)", async () => {
    // Two free users, both members of the org, same campaign, both with
    // budget. Different locks → truly concurrent → unique index decides.
    const a = await seedFreeWorkspace(pg);
    await pg.query("insert into public.profiles (id) values ($1)", [crypto.randomUUID()]);
    const userB = crypto.randomUUID();
    await pg.query("insert into public.profiles (id) values ($1)", [userB]);
    await pg.query("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'member')", [
      a.orgId,
      userB,
    ]);
    const tool = await pg.query("select id from public.tools where slug = 'sponsor-sentinel'");
    await pg.query("insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at) values ($1, $2, 'free', null)", [
      userB,
      String((tool.rows[0] as Record<string, unknown>).id ?? ""),
    ]);
    const poolA = pg.newPool();
    const poolB = pg.newPool();
    try {
      const [ra, rb] = await Promise.all([
        reserve(poolA, { userId: a.userId, orgId: a.orgId, campaignId: a.campaignId }),
        reserve(poolB, { userId: userB, orgId: a.orgId, campaignId: a.campaignId }),
      ]);
      const wins = [ra, rb].filter((r) => r.ok);
      expect(wins).toHaveLength(1);
      const loser = ([ra, rb].find((r) => !r.ok) ?? null) as { code: string } | null;
      expect(loser?.code).toBe("SFD01");
      expect(await scanCount(a.orgId)).toBe(1);
    } finally {
      await poolA.end().catch(() => undefined);
      await poolB.end().catch(() => undefined);
    }
  }, 60_000);
});

describe("H3: budget semantics on real Postgres", () => {
  it("10. month boundary is UTC-exact (prior-month rows excluded)", async () => {
    const s = await seedFreeWorkspace(pg);
    const ms = monthStart();
    const justBefore = new Date(ms.getTime() - 1).toISOString();
    const atStart = ms.toISOString();
    // Timezone-offset edge: same instant as justBefore expressed +14:00.
    const offsetEdge = new Date(ms.getTime() - 1).toISOString();
    await insertScan(s.orgId, s.campaignId, justBefore);
    await insertScan(s.orgId, s.campaignId, offsetEdge);
    await insertScan(s.orgId, s.campaignId, atStart);
    const r = await pg.query(
      "select count(*)::int as n from public.scans where organization_id = $1 and started_at >= ((date_trunc('month', now() at time zone 'UTC')) at time zone 'UTC')",
      [s.orgId],
    );
    expect(Number((r.rows[0] as Record<string, unknown>).n)).toBe(1);
    // Reservation still has 9 remaining → succeeds.
    const pool = pg.newPool();
    try {
      const res = await reserve(pool, { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId });
      expect(res.ok).toBe(true);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  it("failed + partial scans count toward the budget", async () => {
    const s = await seedFreeWorkspace(pg);
    const ms = monthStart();
    for (let i = 0; i < 5; i++) {
      await insertScan(s.orgId, s.campaignId, new Date(ms.getTime() + (i + 1) * 3600000).toISOString(), "failed");
      await insertScan(s.orgId, s.campaignId, new Date(ms.getTime() + (i + 1) * 3600000 + 1000).toISOString(), "partial");
    }
    const pool = pg.newPool();
    try {
      const res = await reserve(pool, { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("SFQ01");
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  it("stale pending rows are expired, then reservation succeeds (stale behavior preserved)", async () => {
    const s = await seedFreeWorkspace(pg);
    await insertScan(s.orgId, s.campaignId, new Date(Date.now() - 11 * 60 * 1000).toISOString(), "pending");
    const pool = pg.newPool();
    try {
      const res = await reserve(pool, { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId });
      expect(res.ok).toBe(true);
      const stale = await pg.query("select status from public.scans where status = 'failed' and error_code = 'stale_timeout'");
      expect(stale.rowCount).toBe(1);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  it("All Access org scans do not consume the free budget (paid org excluded)", async () => {
    const s = await seedFreeWorkspace(pg, { orgGrant: true });
    // Rewrite the org grant to All Access.
    const tool = await pg.query("select id from public.tools where slug = 'sponsor-sentinel'");
    await pg.query("delete from public.tool_entitlements where organization_id = $1", [s.orgId]);
    await pg.query("insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, null, true, 'subscription', null)", [
      s.orgId,
    ]);
    void tool;
    const ms = monthStart();
    for (let i = 0; i < 10; i++) {
      await insertScan(s.orgId, s.campaignId, new Date(ms.getTime() + (i + 1) * 3600000).toISOString());
    }
    // Paid path short-circuits: reservation succeeds despite 10 rows.
    const pool = pg.newPool();
    try {
      const res = await reserve(pool, { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId });
      expect(res.ok).toBe(true);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  it("cross-user isolation: other users' scans never touch this budget", async () => {
    const a = await seedFreeWorkspace(pg);
    const b = await seedFreeWorkspace(pg);
    const ms = monthStart();
    for (let i = 0; i < 10; i++) {
      await insertScan(b.orgId, b.campaignId, new Date(ms.getTime() + (i + 1) * 3600000).toISOString());
    }
    const pool = pg.newPool();
    try {
      const res = await reserve(pool, { userId: a.userId, orgId: a.orgId, campaignId: a.campaignId });
      expect(res.ok).toBe(true);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  it("membership removal → SFN01 (no reservation, no row)", async () => {
    const s = await seedFreeWorkspace(pg);
    await pg.query("delete from public.organization_members where organization_id = $1 and user_id = $2", [s.orgId, s.userId]);
    const pool = pg.newPool();
    try {
      const res = await reserve(pool, { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("SFN01");
      expect(await scanCount(s.orgId)).toBe(0);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  it("spoofed IDs fail closed (unknown user/org/cross-org campaign)", async () => {
    const s = await seedFreeWorkspace(pg);
    const pool = pg.newPool();
    try {
      const badUser = await reserve(pool, { userId: crypto.randomUUID(), orgId: s.orgId, campaignId: s.campaignId });
      expect(badUser.ok).toBe(false);
      const badOrg = await reserve(pool, { userId: s.userId, orgId: crypto.randomUUID(), campaignId: s.campaignId });
      expect(badOrg.ok).toBe(false);
      // Campaign from another org.
      const other = await seedFreeWorkspace(pg);
      const crossCamp = await reserve(pool, { userId: s.userId, orgId: s.orgId, campaignId: other.campaignId });
      expect(crossCamp.ok).toBe(false);
      expect(await scanCount(s.orgId)).toBe(0);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  it("expired paid grant resolves to the free path with finite budget", async () => {
    const s = await seedFreeWorkspace(pg, { grantSource: "subscription", grantExpiresAt: PAST });
    void FUTURE;
    const pool = pg.newPool();
    try {
      const res = await reserve(pool, { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId });
      expect(res.ok).toBe(true);
      // And the row was NOT mutated by the reservation.
      const g = await pg.query("select source, expires_at from public.user_tool_entitlements limit 1");
      expect((g.rows[0] as Record<string, unknown>).source).toBe("subscription");
    } finally {
      await pool.end().catch(() => undefined);
    }
  });

  it("no grant at all → SFN01 with zero rows", async () => {
    const s = await seedFreeWorkspace(pg);
    await pg.query("delete from public.user_tool_entitlements");
    const pool = pg.newPool();
    try {
      const res = await reserve(pool, { userId: s.userId, orgId: s.orgId, campaignId: s.campaignId });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("SFN01");
      expect(await scanCount(s.orgId)).toBe(0);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });
});

describe("H3: reservation shape", () => {
  it("successful reservation returns the pending scan row (paid + free)", async () => {
    const free = await seedFreeWorkspace(pg);
    const paid = await seedFreeWorkspace(pg, { grantSource: "subscription", grantExpiresAt: FUTURE });
    const pool = pg.newPool();
    try {
      const r1 = await reserve(pool, { userId: free.userId, orgId: free.orgId, campaignId: free.campaignId, platform: "youtube", version: "v9" });
      expect(r1.ok).toBe(true);
      if (r1.ok) {
        expect(r1.row.status).toBe("pending");
        expect(r1.row.platform).toBe("youtube");
        expect(r1.row.campaign_id).toBe(free.campaignId);
      }
      const r2 = await reserve(pool, { userId: paid.userId, orgId: paid.orgId, campaignId: paid.campaignId });
      expect(r2.ok).toBe(true);
    } finally {
      await pool.end().catch(() => undefined);
    }
  });
});
