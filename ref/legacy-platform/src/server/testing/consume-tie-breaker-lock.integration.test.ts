/**
 * IMPLEMENT-07: real-Postgres proof for consume_tie_breaker_lock.
 *
 * Exercises the ACTUAL shipped SQL (extracted verbatim from
 * supabase/migrations/20251027000001_tie_breaker_free_tier.sql) against a
 * real multi-backend PostgreSQL server (embedded-postgres). Every race test
 * uses independent pg Pools (= independent backends; PIDs asserted distinct).
 *
 * Lane: starts one embedded server per file (~10s). Not skippable.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import {
  startTieBreakerTestPostgres,
  truncateTieBreakerTables,
  restartTieBreakerRefSeq,
  seedTieBreakerWorkspace,
  insertCompetition,
  type TestPostgres,
  type TieBreakerSeed,
} from "./tie-breaker-pg-harness";

type LockResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; code: string; message: string };

// Multi-round-trip tests share one embedded server with the FIX-06 lane;
// under full-suite load individual round trips slow down, so the default
// 5s per-test timeout is raised (assertions unchanged — timeouts prove
// nothing about atomicity).
vi.setConfig({ testTimeout: 60_000 });

let pg: TestPostgres;

beforeAll(async () => {
  pg = await startTieBreakerTestPostgres();
}, 180_000);

afterAll(async () => {
  await pg.stop();
}, 60_000);

beforeEach(async () => {
  await truncateTieBreakerTables(pg);
  await restartTieBreakerRefSeq(pg);
});

async function lock(
  pool: Pool,
  seed: TieBreakerSeed,
  competitionId: string,
  userId?: string,
): Promise<LockResult> {
  const client = await pool.connect();
  try {
    // SELECT * FROM evaluates a side-effecting function exactly once.
    const res = await client.query("select * from public.consume_tie_breaker_lock($1,$2,$3,$4,$5)", [
      seed.orgId,
      competitionId,
      userId ?? seed.userId,
      JSON.stringify({ standings: [], note: "app snapshot" }),
      new Date().toISOString(),
    ]);
    return { ok: true, row: res.rows[0] as Record<string, unknown> };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, code: String(err.code ?? "?"), message: String(err.message ?? e).slice(0, 300) };
  } finally {
    client.release();
  }
}

async function lockedCount(orgId: string): Promise<number> {
  const r = await pg.query("select count(*)::int as n from public.tie_breaker_competitions where organization_id = $1 and status = 'locked'", [orgId]);
  return Number(r.rows[0]?.n ?? 0);
}

async function backendPid(pool: Pool): Promise<number> {
  const r = await pool.query("select pg_backend_pid() as pid");
  return Number((r.rows[0] as Record<string, unknown>).pid);
}

describe("monthly quota (3 per workspace-local month)", () => {
  it("first, second, third locks succeed with gapless record numbers; fourth is rejected", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { timezone: "Asia/Kolkata", grant: "free" });
    const ids = [await insertCompetition(pg, seed), await insertCompetition(pg, seed), await insertCompetition(pg, seed), await insertCompetition(pg, seed)];

    const r1 = await lock(pg.pool, seed, ids[0] as string);
    const r2 = await lock(pg.pool, seed, ids[1] as string);
    const r3 = await lock(pg.pool, seed, ids[2] as string);
    expect(r1.ok && (r1.row.record_number as string)).toBe("TB-2026-00001");
    expect(r2.ok && (r2.row.record_number as string)).toBe("TB-2026-00002");
    expect(r3.ok && (r3.row.record_number as string)).toBe("TB-2026-00003");

    const r4 = await lock(pg.pool, seed, ids[3] as string);
    expect(r4.ok).toBe(false);
    if (!r4.ok) {
      expect(r4.code).toBe("TBF01");
      expect(r4.message).toMatch(/quota_exceeded/);
      expect(r4.message).not.toMatch(/postgres|SQLSTATE|consume_tie_breaker_lock/i);
    }
    expect(await lockedCount(seed.orgId)).toBe(3);

    // The rejection consumed no record number: the next-month lock is 00004.
    await pg.query("update public.tie_breaker_competitions set locked_at = locked_at - interval '40 days' where organization_id = $1", [seed.orgId]);
    const r5 = await lock(pg.pool, seed, ids[3] as string);
    expect(r5.ok && (r5.row.record_number as string)).toBe("TB-2026-00004");
  });

  it("snapshot is merged with the final record number and lock time", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const id = await insertCompetition(pg, seed);
    const res = await lock(pg.pool, seed, id);
    expect(res.ok).toBe(true);
    if (res.ok) {
      const snap = res.row.locked_snapshot as Record<string, unknown>;
      expect(snap.recordNumber).toBe(res.row.record_number);
      expect(typeof snap.lockedAt).toBe("string");
      expect(snap.note).toBe("app snapshot");
      expect(res.row.locked_at).toBeTruthy();
    }
  });

  it("records locked in a prior local month do not consume the current month", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { timezone: "Asia/Kolkata", grant: "free" });
    // 40 days back is always a strictly earlier workspace-local month
    // (the widest IANA offset is ±14h, far below the 9+ day margin).
    const prior = new Date(Date.now() - 40 * 86400000).toISOString();
    for (let i = 0; i < 3; i++) {
      await insertCompetition(pg, seed, { status: "locked", lockedAt: prior, recordNumber: `TB-2026-0001${i}` });
    }
    for (let i = 0; i < 3; i++) {
      const id = await insertCompetition(pg, seed);
      const res = await lock(pg.pool, seed, id);
      expect(res.ok).toBe(true);
    }
    const fourth = await lock(pg.pool, seed, await insertCompetition(pg, seed));
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.code).toBe("TBF01");
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
    it(`${tz}: rows before the local month-start do not count; rows after do`, async () => {
      const start = localMonthStartUtc(new Date(), tz);
      const before = new Date(start.getTime() - 30 * 60000).toISOString();
      const after = (mins: number) => new Date(start.getTime() + mins * 60000).toISOString();
      // Control org: only prior-local-month rows → three locks allowed.
      const control = await seedTieBreakerWorkspace(pg, { timezone: tz, grant: "free" });
      await insertCompetition(pg, control, { status: "locked", lockedAt: before, recordNumber: "TB-2026-00010" });
      for (let i = 0; i < 3; i++) {
        expect((await lock(pg.pool, control, await insertCompetition(pg, control))).ok).toBe(true);
      }
      // Full org: three current-local-month rows → next lock rejected.
      const full = await seedTieBreakerWorkspace(pg, { timezone: tz, grant: "free" });
      await insertCompetition(pg, full, { status: "locked", lockedAt: after(5), recordNumber: "TB-2026-00011" });
      await insertCompetition(pg, full, { status: "locked", lockedAt: after(65), recordNumber: "TB-2026-00012" });
      await insertCompetition(pg, full, { status: "locked", lockedAt: after(125), recordNumber: "TB-2026-00013" });
      const res = await lock(pg.pool, full, await insertCompetition(pg, full));
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.code).toBe("TBF01");
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

  it("DST transitions resolve in wall time, not fixed offsets", async () => {
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

describe("concurrency (independent backends)", () => {
  it("4 concurrent locks with 3 slots → exactly 3 succeed, 1 rejected, no duplicate numbers", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const ids = [await insertCompetition(pg, seed), await insertCompetition(pg, seed), await insertCompetition(pg, seed), await insertCompetition(pg, seed)];
    const pools = [pg.newPool(), pg.newPool(), pg.newPool(), pg.newPool()];
    try {
      const pids = await Promise.all(pools.map(backendPid));
      expect(new Set(pids).size).toBe(4);
      const results = await Promise.all(ids.map((id, i) => lock(pools[i] as Pool, seed, id as string)));
      const ok = results.filter((r) => r.ok);
      const denied = results.filter((r) => !r.ok);
      expect(ok.length).toBe(3);
      expect(denied.length).toBe(1);
      expect((denied[0] as { code: string }).code).toBe("TBF01");
      const numbers = ok.map((r) => (r as { ok: true; row: Record<string, unknown> }).row.record_number);
      expect(new Set(numbers).size).toBe(3);
      expect(await lockedCount(seed.orgId)).toBe(3);
    } finally {
      await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
    }
  });

  it("2 concurrent locks with 1 slot left → exactly 1 succeeds", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    // Fixture numbers live far above the restarted sequence so RPC-allocated
    // numbers (00001…) never collide with them.
    await insertCompetition(pg, seed, { status: "locked", lockedAt: new Date().toISOString(), recordNumber: "TB-2026-09001" });
    await insertCompetition(pg, seed, { status: "locked", lockedAt: new Date().toISOString(), recordNumber: "TB-2026-09002" });
    const a = await insertCompetition(pg, seed);
    const b = await insertCompetition(pg, seed);
    const [pa, pb] = [pg.newPool(), pg.newPool()];
    try {
      const [ra, rb] = await Promise.all([lock(pa, seed, a), lock(pb, seed, b)]);
      const oks = [ra, rb].filter((r) => r.ok);
      const denied = [ra, rb].filter((r) => !r.ok);
      expect(oks.length).toBe(1);
      expect(denied.length).toBe(1);
      expect((denied[0] as { code: string }).code).toBe("TBF01");
      expect(await lockedCount(seed.orgId)).toBe(3);
    } finally {
      await Promise.all([pa.end().catch(() => undefined), pb.end().catch(() => undefined)]);
    }
  });

  it("concurrent replays of the same locked competition stay idempotent with zero extra quota", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const id = await insertCompetition(pg, seed);
    const first = await lock(pg.pool, seed, id);
    expect(first.ok).toBe(true);
    const pools = [pg.newPool(), pg.newPool(), pg.newPool()];
    try {
      const results = await Promise.all([lock(pools[0] as Pool, seed, id), lock(pools[1] as Pool, seed, id), lock(pools[2] as Pool, seed, id)]);
      expect(results.every((r) => r.ok)).toBe(true);
      const numbers = new Set(results.map((r) => (r as { ok: true; row: Record<string, unknown> }).row.record_number));
      expect(numbers.size).toBe(1);
      expect(await lockedCount(seed.orgId)).toBe(1);
    } finally {
      await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
    }
  });
});

describe("idempotency + lifecycle (only successful locks consume)", () => {
  it("replay of an already-locked competition consumes zero additional quota", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const id = await insertCompetition(pg, seed);
    const first = await lock(pg.pool, seed, id);
    expect(first.ok).toBe(true);
    const second = await lock(pg.pool, seed, id);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(second.row.record_number).toBe(first.row.record_number);
    }
    expect(await lockedCount(seed.orgId)).toBe(1);
  });

  it("draft competitions cannot lock (TBD01) and consume nothing", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const id = await insertCompetition(pg, seed, { status: "draft" });
    const res = await lock(pg.pool, seed, id);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TBD01");
    expect(await lockedCount(seed.orgId)).toBe(0);
    // No record number was allocated: the next real lock is 00001.
    const active = await insertCompetition(pg, seed);
    const ok = await lock(pg.pool, seed, active);
    expect(ok.ok && (ok.row.record_number as string)).toBe("TB-2026-00001");
  });

  it("abandoned/deleted drafts consume zero quota", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const doomed = await insertCompetition(pg, seed, { status: "draft" });
    await pg.query("delete from public.tie_breaker_competitions where id = $1", [doomed]);
    const ok = await lock(pg.pool, seed, await insertCompetition(pg, seed));
    expect(ok.ok).toBe(true);
    expect(await lockedCount(seed.orgId)).toBe(1);
  });

  it("copy-for-next semantics: copies are drafts and lock only on finalize", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    // Exhaust the month, then verify a fresh draft can still be created.
    for (let i = 0; i < 3; i++) {
      expect((await lock(pg.pool, seed, await insertCompetition(pg, seed))).ok).toBe(true);
    }
    const draft = await insertCompetition(pg, seed, { status: "draft" });
    const check = await pg.query("select status from public.tie_breaker_competitions where id = $1", [draft]);
    expect(check.rows[0]?.status).toBe("draft");
    const blocked = await lock(pg.pool, seed, draft);
    // Drafts cannot lock directly (must go active first); the quota wall also holds.
    expect(blocked.ok).toBe(false);
    expect(await lockedCount(seed.orgId)).toBe(3);
  });
});

describe("paid / all-access bypass", () => {
  it("paid orgs lock beyond 3 without limit", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "paid" });
    for (let i = 0; i < 5; i++) {
      const res = await lock(pg.pool, seed, await insertCompetition(pg, seed));
      expect(res.ok).toBe(true);
    }
    expect(await lockedCount(seed.orgId)).toBe(5);
  });

  it("all-access orgs lock beyond 3 without limit", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "all-access" });
    for (let i = 0; i < 5; i++) {
      const res = await lock(pg.pool, seed, await insertCompetition(pg, seed));
      expect(res.ok).toBe(true);
    }
    expect(await lockedCount(seed.orgId)).toBe(5);
  });
});

describe("cross-org isolation", () => {
  it("org A's quota never affects org B (same user in both, A free, B paid)", async () => {
    const seedA = await seedTieBreakerWorkspace(pg, { timezone: "Asia/Kolkata", grant: "free" });
    // Same user joins a second org that is paid.
    const orgB = crypto.randomUUID();
    await pg.query("insert into public.organizations (id, name, slug, owner_id, timezone) values ($1, 'OrgB', $2, $3, 'Asia/Kolkata')", [
      orgB,
      `orgb-${orgB.slice(0, 8)}`,
      seedA.userId,
    ]);
    await pg.query("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')", [orgB, seedA.userId]);
    const tool = await pg.query("select id from public.tools where slug = 'tie-breaker'");
    await pg.query("insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, $2, false, 'subscription', null)", [
      orgB,
      String(tool.rows[0]?.id ?? ""),
    ]);
    const seedB = { userId: seedA.userId, orgId: orgB, toolId: String(tool.rows[0]?.id ?? "") };

    for (let i = 0; i < 3; i++) {
      expect((await lock(pg.pool, seedA, await insertCompetition(pg, seedA))).ok).toBe(true);
    }
    const blockedA = await lock(pg.pool, seedA, await insertCompetition(pg, seedA));
    expect(blockedA.ok).toBe(false);

    for (let i = 0; i < 4; i++) {
      expect((await lock(pg.pool, seedB, await insertCompetition(pg, seedB))).ok).toBe(true);
    }
    expect(await lockedCount(seedB.orgId)).toBe(4);
  });
});

describe("security (fail closed)", () => {
  it("non-member cannot lock (TBN01)", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const id = await insertCompetition(pg, seed);
    const res = await lock(pg.pool, seed, id, crypto.randomUUID());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TBN01");
    expect(await lockedCount(seed.orgId)).toBe(0);
  });

  it("foreign organization id cannot be injected (TBN01)", async () => {
    const seedA = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const seedB = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const idA = await insertCompetition(pg, seedA);
    // Member of B attempts to lock A's competition as B.
    const res = await lock(pg.pool, seedB, idA);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TBN01");
  });

  it("org without any grant cannot lock (TBN01)", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: null });
    const res = await lock(pg.pool, seed, await insertCompetition(pg, seed));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("TBN01");
  });

  it("direct status→locked writes are rejected (TBK01) — the RPC path is mandatory", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const id = await insertCompetition(pg, seed);
    const attempt = await pg
      .query(
        "update public.tie_breaker_competitions set status = 'locked', record_number = 'TB-2026-99999', locked_at = now(), locked_snapshot = '{}' where id = $1",
        [id],
      )
      .then(
        () => ({ blocked: false }),
        (e: { code?: string }) => ({ blocked: true, code: String(e.code ?? "?") }),
      );
    expect(attempt.blocked).toBe(true);
    expect((attempt as { code?: string }).code).toBe("TBK01");
    expect(await lockedCount(seed.orgId)).toBe(0);
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

describe("share branding (paid-only logo)", () => {
  async function shareLogo(tokenHolder: string): Promise<unknown> {
    const r = await pg.query("select public.get_completed_tie_breaker_share($1) as share", [tokenHolder]);
    return (r.rows[0]?.share as Record<string, unknown> | null)?.organization_logo_url ?? null;
  }

  it("free org share hides the logo; paid org share shows it", async () => {
    const freeSeed = await seedTieBreakerWorkspace(pg, { grant: "free", logoUrl: "https://cdn.example/logo.png" });
    const paidSeed = await seedTieBreakerWorkspace(pg, { grant: "paid", logoUrl: "https://cdn.example/logo.png" });
    const freeId = await insertCompetition(pg, freeSeed);
    const paidId = await insertCompetition(pg, paidSeed);
    expect((await lock(pg.pool, freeSeed, freeId)).ok).toBe(true);
    expect((await lock(pg.pool, paidSeed, paidId)).ok).toBe(true);
    const freeToken = await pg.query("select share_token from public.tie_breaker_competitions where id = $1", [freeId]);
    const paidToken = await pg.query("select share_token from public.tie_breaker_competitions where id = $1", [paidId]);
    expect(await shareLogo(String(freeToken.rows[0]?.share_token ?? ""))).toBeNull();
    expect(await shareLogo(String(paidToken.rows[0]?.share_token ?? ""))).toBe("https://cdn.example/logo.png");
  });
});

describe("billing Free→Paid org transition", () => {
  async function runPayment(orgId: string, toolId: string, period: "monthly" | "yearly") {
    const orderId = crypto.randomUUID();
    await pg.query(
      "insert into public.orders (id, organization_id, tool_id, is_all_access, status, amount_minor, currency) values ($1, $2, $3, false, 'created', 79900, 'INR')",
      [orderId, orgId, toolId],
    );
    const res = await pg.query("select public.complete_billing_payment($1, $2, 'sig', 79900, 'INR', now(), $3) as result", [
      orderId,
      `pay_${orderId.slice(0, 8)}`,
      period,
    ]);
    return res.rows[0]?.result as Record<string, unknown>;
  }

  async function orgGrant(orgId: string, toolId: string) {
    const r = await pg.query(
      "select source, expires_at from public.tool_entitlements where organization_id = $1 and tool_id = $2 and is_all_access = false",
      [orgId, toolId],
    );
    return r.rows[0] as { source: string; expires_at: string | null } | undefined;
  }

  it("free grant transitions to finite paid subscription on purchase", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    const before = await orgGrant(seed.orgId, seed.toolId);
    expect(before?.source).toBe("free");
    expect(before?.expires_at).toBeNull();
    await runPayment(seed.orgId, seed.toolId, "monthly");
    const after = await orgGrant(seed.orgId, seed.toolId);
    expect(after?.source).toBe("subscription");
    expect(after?.expires_at).not.toBeNull();
    expect(new Date(String(after?.expires_at)).getTime()).toBeGreaterThan(Date.now() + 20 * 86400000);
  });

  it("FIX-05 preserved: non-free lifetime rows are never shortened", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "paid" });
    await runPayment(seed.orgId, seed.toolId, "monthly");
    const after = await orgGrant(seed.orgId, seed.toolId);
    expect(after?.source).toBe("subscription");
    expect(after?.expires_at).toBeNull();
  });

  it("upgraded orgs bypass quota immediately (5 locks)", async () => {
    const seed = await seedTieBreakerWorkspace(pg, { grant: "free" });
    await runPayment(seed.orgId, seed.toolId, "monthly");
    for (let i = 0; i < 5; i++) {
      expect((await lock(pg.pool, seed, await insertCompetition(pg, seed))).ok).toBe(true);
    }
  });
});
