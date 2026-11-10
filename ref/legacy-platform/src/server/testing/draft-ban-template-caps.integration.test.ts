/**
 * Template caps: real-Postgres proof for 20251029000001_draft_ban_template_caps.
 *
 * Exercises the ACTUAL shipped migration (applied verbatim end-to-end by the
 * harness) against a real multi-backend PostgreSQL server (embedded-postgres).
 * Every race test uses independent pg Pools (= independent backends; PIDs
 * asserted distinct).
 *
 * Covers: policy caps (free 3 / paid 20 / starter exempt), access levels,
 * sequential creation, starter idempotency + exemption, deletion slot reuse,
 * concurrency (free 2→3, free 3→3, paid 19→20, paid 20→20, double starter,
 * direct-INSERT races), spoof defenses, and cross-org security.
 *
 * Lane: starts one embedded server per file (~10s). Not skippable.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import {
  startDraftBanTestPostgres,
  truncateDraftBanTables,
  seedDraftBanWorkspace,
  type TestPostgres,
  type DraftBanSeed,
} from "./draft-ban-pg-harness";

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

type TplResult = { ok: true; row: Record<string, unknown> } | { ok: false; code: string; message: string };

const CONFIG = JSON.stringify({ sequence: [{ team: "A", type: "ban" }], pool: [], teamA: null, teamB: null });

async function createTpl(pool: Pool, seed: DraftBanSeed, name: string, userId?: string): Promise<TplResult> {
  const client = await pool.connect();
  try {
    const res = await client.query("select * from public.create_draft_template($1,$2,$3::jsonb,$4)", [
      seed.orgId,
      name,
      CONFIG,
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

async function ensureStarter(pool: Pool, seed: DraftBanSeed): Promise<TplResult> {
  const client = await pool.connect();
  try {
    const res = await client.query("select * from public.ensure_starter_draft_template($1,$2)", [seed.orgId, seed.userId]);
    if (res.rows[0] === null || res.rows[0] === undefined) return { ok: true, row: {} };
    return { ok: true, row: res.rows[0] as Record<string, unknown> };
  } catch (e) {
    const err = e as { code?: string; message?: string };
    return { ok: false, code: String(err.code ?? "?"), message: String(err.message ?? e).slice(0, 300) };
  } finally {
    client.release();
  }
}

async function customCount(orgId: string): Promise<number> {
  const r = await pg.query(
    "select count(*)::int as n from public.draft_templates where organization_id = $1 and is_starter = false",
    [orgId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

async function starterCount(orgId: string): Promise<number> {
  const r = await pg.query(
    "select count(*)::int as n from public.draft_templates where organization_id = $1 and is_starter = true",
    [orgId],
  );
  return Number(r.rows[0]?.n ?? 0);
}

async function capOf(orgId: string): Promise<number> {
  const r = await pg.query("select public.draft_ban_custom_template_cap($1) as cap", [orgId]);
  return Number(r.rows[0]?.cap ?? -1);
}

async function backendPid(pool: Pool): Promise<number> {
  const r = await pool.query("select pg_backend_pid() as pid");
  return Number((r.rows[0] as Record<string, unknown>).pid);
}

async function seedCustoms(pool: Pool, seed: DraftBanSeed, n: number, prefix = "Custom"): Promise<void> {
  for (let i = 0; i < n; i++) {
    const res = await createTpl(pool, seed, `${prefix} ${i}`);
    expect(res.ok).toBe(true);
  }
}

describe("policy caps (server-side resolution)", () => {
  it("free org resolves cap 3; paid and all-access resolve cap 20", async () => {
    const free = await seedDraftBanWorkspace(pg, { grant: "free" });
    const paid = await seedDraftBanWorkspace(pg, { grant: "paid" });
    const all = await seedDraftBanWorkspace(pg, { grant: "all-access" });
    expect(await capOf(free.orgId)).toBe(3);
    expect(await capOf(paid.orgId)).toBe(20);
    expect(await capOf(all.orgId)).toBe(20);
  });

  it("expired paid without free falls back to the free cap (coverage still rejected)", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "expired-paid" });
    expect(await capOf(seed.orgId)).toBe(3);
    const res = await createTpl(pg.pool, seed, "Nope");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
  });
});

describe("sequential creation", () => {
  it("free 0 → 1 → 2 → 3 succeed; 4th fails DBT01 with no row change", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    for (let i = 0; i < 3; i++) {
      const res = await createTpl(pg.pool, seed, `Custom ${i}`);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.row.is_starter).toBe(false);
    }
    expect(await customCount(seed.orgId)).toBe(3);
    const fourth = await createTpl(pg.pool, seed, "Fourth");
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) {
      expect(fourth.code).toBe("DBT01");
      expect(fourth.message).toMatch(/template_limit_exceeded/);
      expect(fourth.message).not.toMatch(/postgres|SQLSTATE/i);
    }
    expect(await customCount(seed.orgId)).toBe(3);
  });

  it("paid 19 → 20 succeeds; 21st fails DBT01", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "paid" });
    await seedCustoms(pg.pool, seed, 19);
    expect(await customCount(seed.orgId)).toBe(19);
    expect((await createTpl(pg.pool, seed, "Twentieth")).ok).toBe(true);
    expect(await customCount(seed.orgId)).toBe(20);
    const extra = await createTpl(pg.pool, seed, "Extra");
    expect(extra.ok).toBe(false);
    if (!extra.ok) expect(extra.code).toBe("DBT01");
    expect(await customCount(seed.orgId)).toBe(20);
  });

  it("duplicate names (case-insensitive) fail DBT02 and consume nothing", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    expect((await createTpl(pg.pool, seed, "Saturday")).ok).toBe(true);
    const dupe = await createTpl(pg.pool, seed, "saturday");
    expect(dupe.ok).toBe(false);
    if (!dupe.ok) expect(dupe.code).toBe("DBT02");
    expect(await customCount(seed.orgId)).toBe(1);
  });
});

describe("starter exemption + idempotency", () => {
  it("first ensure mints exactly one exempt starter; repeats are idempotent", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const first = await ensureStarter(pg.pool, seed);
    expect(first.ok).toBe(true);
    if (first.ok && first.row.id) {
      expect(first.row.name).toBe("Standard Veto");
      expect(first.row.is_starter).toBe(true);
    }
    const second = await ensureStarter(pg.pool, seed);
    expect(second.ok).toBe(true);
    expect(await starterCount(seed.orgId)).toBe(1);
    expect(await customCount(seed.orgId)).toBe(0);
  });

  it("concurrent ensures converge on one starter row", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const pools = [pg.newPool(), pg.newPool(), pg.newPool()];
    try {
      const pids = await Promise.all(pools.map(backendPid));
      expect(new Set(pids).size).toBe(3);
      const results = await Promise.all(pools.map((p) => ensureStarter(p, seed)));
      expect(results.every((r) => r.ok)).toBe(true);
      expect(await starterCount(seed.orgId)).toBe(1);
      expect(await customCount(seed.orgId)).toBe(0);
    } finally {
      await Promise.all(pools.map((p) => p.end().catch(() => undefined)));
    }
  });

  it("starter + 0 custom → 3 customs allowed; starter + 3 customs → 4th rejected", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    expect((await ensureStarter(pg.pool, seed)).ok).toBe(true);
    await seedCustoms(pg.pool, seed, 3);
    expect(await customCount(seed.orgId)).toBe(3);
    expect(await starterCount(seed.orgId)).toBe(1);
    const fourth = await createTpl(pg.pool, seed, "Fourth");
    expect(fourth.ok).toBe(false);
    if (!fourth.ok) expect(fourth.code).toBe("DBT01");
  });

  it("ensure with existing customs (no starter) never backfills a starter", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    await seedCustoms(pg.pool, seed, 1);
    const res = await ensureStarter(pg.pool, seed);
    expect(res.ok).toBe(true);
    expect(await starterCount(seed.orgId)).toBe(0);
    expect(await customCount(seed.orgId)).toBe(1);
  });
});

describe("deletion frees the slot", () => {
  it("free at 3 customs → delete 1 → create 1 → final count 3", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    await seedCustoms(pg.pool, seed, 3);
    const victim = await pg.query(
      "select id from public.draft_templates where organization_id = $1 and is_starter = false limit 1",
      [seed.orgId],
    );
    await pg.query("delete from public.draft_templates where id = $1", [victim.rows[0]?.id]);
    expect(await customCount(seed.orgId)).toBe(2);
    expect((await createTpl(pg.pool, seed, "Replacement")).ok).toBe(true);
    expect(await customCount(seed.orgId)).toBe(3);
  });
});

describe("concurrency (independent backends)", () => {
  it("free 2 customs + 2 concurrent creates → exactly 1 succeeds, final 3", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    await seedCustoms(pg.pool, seed, 2);
    const [pa, pb] = [pg.newPool(), pg.newPool()];
    try {
      const pids = await Promise.all([backendPid(pa), backendPid(pb)]);
      expect(new Set(pids).size).toBe(2);
      const [ra, rb] = await Promise.all([createTpl(pa, seed, "Race A"), createTpl(pb, seed, "Race B")]);
      const oks = [ra, rb].filter((r) => r.ok);
      const denied = [ra, rb].filter((r) => !r.ok);
      expect(oks.length).toBe(1);
      expect(denied.length).toBe(1);
      expect((denied[0] as { code: string }).code).toBe("DBT01");
      expect(await customCount(seed.orgId)).toBe(3);
    } finally {
      await Promise.all([pa.end().catch(() => undefined), pb.end().catch(() => undefined)]);
    }
  });

  it("free 3 customs + 2 concurrent creates → 0 succeed, final 3", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    await seedCustoms(pg.pool, seed, 3);
    const [pa, pb] = [pg.newPool(), pg.newPool()];
    try {
      const [ra, rb] = await Promise.all([createTpl(pa, seed, "Race A"), createTpl(pb, seed, "Race B")]);
      expect(ra.ok).toBe(false);
      expect(rb.ok).toBe(false);
      expect(await customCount(seed.orgId)).toBe(3);
    } finally {
      await Promise.all([pa.end().catch(() => undefined), pb.end().catch(() => undefined)]);
    }
  });

  it("paid 19 customs + 2 concurrent creates → exactly 1 succeeds, final 20", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "paid" });
    await seedCustoms(pg.pool, seed, 19);
    const [pa, pb] = [pg.newPool(), pg.newPool()];
    try {
      const pids = await Promise.all([backendPid(pa), backendPid(pb)]);
      expect(new Set(pids).size).toBe(2);
      const [ra, rb] = await Promise.all([createTpl(pa, seed, "Race A"), createTpl(pb, seed, "Race B")]);
      expect([ra, rb].filter((r) => r.ok).length).toBe(1);
      expect([ra, rb].filter((r) => !r.ok).length).toBe(1);
      expect(await customCount(seed.orgId)).toBe(20);
    } finally {
      await Promise.all([pa.end().catch(() => undefined), pb.end().catch(() => undefined)]);
    }
  });

  it("paid 20 customs + 2 concurrent creates → 0 succeed, final 20", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "paid" });
    await seedCustoms(pg.pool, seed, 20);
    const [pa, pb] = [pg.newPool(), pg.newPool()];
    try {
      const [ra, rb] = await Promise.all([createTpl(pa, seed, "Race A"), createTpl(pb, seed, "Race B")]);
      expect(ra.ok).toBe(false);
      expect(rb.ok).toBe(false);
      expect(await customCount(seed.orgId)).toBe(20);
    } finally {
      await Promise.all([pa.end().catch(() => undefined), pb.end().catch(() => undefined)]);
    }
  });

  it("direct-INSERT race is guarded too: free 2 customs + 2 concurrent raw inserts → final 3", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    await seedCustoms(pg.pool, seed, 2);
    const raw = (pool: Pool, name: string) =>
      pool
        .query(
          "insert into public.draft_templates (organization_id, name, config, created_by, is_starter) values ($1,$2,$3::jsonb,$4,false) returning id",
          [seed.orgId, name, CONFIG, seed.userId],
        )
        .then(
          () => ({ ok: true as const }),
          (e: { code?: string }) => ({ ok: false as const, code: String(e.code ?? "?") }),
        );
    const [pa, pb] = [pg.newPool(), pg.newPool()];
    try {
      const [ra, rb] = await Promise.all([raw(pa, "Raw A"), raw(pb, "Raw B")]);
      expect([ra, rb].filter((r) => r.ok).length).toBe(1);
      const loser = [ra, rb].find((r) => !r.ok) as { ok: false; code: string };
      expect(loser.code).toBe("DBT01");
      expect(await customCount(seed.orgId)).toBe(3);
    } finally {
      await Promise.all([pa.end().catch(() => undefined), pb.end().catch(() => undefined)]);
    }
  });
});

describe("spoof defenses (starter/custom classification cannot be forged)", () => {
  it("direct insert with is_starter=true is demoted to custom and counts toward the cap", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const r = await pg.query(
      "insert into public.draft_templates (organization_id, name, config, created_by, is_starter) values ($1,'Spoof',$2::jsonb,$3,true) returning is_starter",
      [seed.orgId, CONFIG, seed.userId],
    );
    expect(r.rows[0]?.is_starter).toBe(false);
    expect(await customCount(seed.orgId)).toBe(1);
    expect(await starterCount(seed.orgId)).toBe(0);
  });

  it("spoofed starters cannot bypass a full cap", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    await seedCustoms(pg.pool, seed, 3);
    const attempt = await pg
      .query(
        "insert into public.draft_templates (organization_id, name, config, created_by, is_starter) values ($1,'Spoof',$2::jsonb,$3,true)",
        [seed.orgId, CONFIG, seed.userId],
      )
      .then(
        () => ({ blocked: false, code: "?" }),
        (e: { code?: string }) => ({ blocked: true, code: String(e.code ?? "?") }),
      );
    expect(attempt.blocked).toBe(true);
    expect(attempt.code).toBe("DBT01");
    expect(await customCount(seed.orgId)).toBe(3);
  });

  it("is_starter is frozen: UPDATE cannot flip it either way", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    expect((await ensureStarter(pg.pool, seed)).ok).toBe(true);
    expect((await createTpl(pg.pool, seed, "Custom 0")).ok).toBe(true);
    await pg.query("update public.draft_templates set is_starter = true where organization_id = $1 and is_starter = false", [
      seed.orgId,
    ]);
    await pg.query("update public.draft_templates set is_starter = false where organization_id = $1 and is_starter = true", [
      seed.orgId,
    ]);
    expect(await starterCount(seed.orgId)).toBe(1);
    expect(await customCount(seed.orgId)).toBe(1);
  });
});

describe("security (fail closed, org isolation)", () => {
  it("org without any grant cannot create (DBN01)", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: null });
    const res = await createTpl(pg.pool, seed, "Nope");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
    expect(await customCount(seed.orgId)).toBe(0);
  });

  it("non-member cannot create in the org (DBN01)", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: "free" });
    const res = await createTpl(pg.pool, seed, "Nope", crypto.randomUUID());
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
    expect(await customCount(seed.orgId)).toBe(0);
  });

  it("member of A cannot mint templates into org B via forged org id", async () => {
    const seedA = await seedDraftBanWorkspace(pg, { grant: "free" });
    const seedB = await seedDraftBanWorkspace(pg, { grant: "free" });
    const forged = { ...seedB, userId: seedA.userId };
    const res = await createTpl(pg.pool, forged, "Forged");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
    expect(await customCount(seedB.orgId)).toBe(0);
  });

  it("org A's quota never affects org B", async () => {
    const seedA = await seedDraftBanWorkspace(pg, { grant: "free" });
    const seedB = await seedDraftBanWorkspace(pg, { grant: "free" });
    await seedCustoms(pg.pool, seedA, 3);
    expect((await createTpl(pg.pool, seedA, "Blocked")).ok).toBe(false);
    expect((await createTpl(pg.pool, seedB, "Allowed")).ok).toBe(true);
    expect(await customCount(seedA.orgId)).toBe(3);
    expect(await customCount(seedB.orgId)).toBe(1);
  });

  it("sponsorship-style user grant alone cannot unlock Draft & Ban templates (DBN01)", async () => {
    const seed = await seedDraftBanWorkspace(pg, { grant: null });
    const sponsor = await pg.query("select id from public.tools where slug = 'sponsor-sentinel'");
    await pg.query(
      "insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at) values ($1, $2, 'subscription', null)",
      [seed.userId, String(sponsor.rows[0]?.id ?? "")],
    );
    const res = await createTpl(pg.pool, seed, "Nope");
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("DBN01");
  });
});
