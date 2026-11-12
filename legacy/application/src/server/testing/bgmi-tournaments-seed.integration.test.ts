/**
 * Real-Postgres proofs for the BGMI Tournament Hub seed (RCCF-BGMI-TOURNAMENTS-02).
 *
 * Applies the ACTUAL shipped migrations (core schema + BMSD 2026 seed,
 * verbatim) on embedded-postgres, then proves:
 * - both stages publish complete datasets (16 teams, 18 matches, 288 results each)
 * - derived standings match the verified source totals
 *   (Grand Finals: Nebula Esports 210; Playoffs: Team Outrage 226)
 * - re-applying the seed is a no-op (idempotent, same counts)
 * - RLS exposes only published rows to anon
 */
import { describe, expect, it, beforeAll, afterAll } from "vitest";

vi.setConfig({ testTimeout: 120_000 });

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import { Pool } from "pg";
import { default as EmbeddedPostgres } from "embedded-postgres";
import { vi } from "vitest";

const CORE_MIGRATION = "supabase/migrations/20251113000001_bgmi_tournaments_core.sql";
const SEED_MIGRATION = "supabase/migrations/20251113000002_bgmi_bmsd_seed.sql";

interface TestPostgres {
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  asRole: <T>(role: string, fn: (query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>) => Promise<T>) => Promise<T>;
  stop: () => Promise<void>;
}

async function startBgmiTestPostgres(): Promise<TestPostgres> {
  const dataDir = mkdtempSync(join(tmpdir(), "micronest-bgmi-test-"));
  let pg: { stop: () => Promise<void> } | null = null;
  let port = 0;
  for (let p = 54381; p <= 54385; p++) {
    try {
      const embedded = new EmbeddedPostgres({
        port: p,
        user: "postgres",
        password: "postgres",
        databaseDir: `${dataDir}-${p}`,
        persistent: false,
        initdbFlags: ["-E", "UTF8", "--locale=C"],
        onLog: () => undefined,
        onError: () => undefined,
      } as unknown as Record<string, unknown>);
      await (embedded as unknown as { initialise: () => Promise<void> }).initialise();
      await (embedded as unknown as { start: () => Promise<void> }).start();
      pg = embedded as unknown as { stop: () => Promise<void> };
      port = p;
      break;
    } catch {
      pg = null;
    }
  }
  if (!pg) throw new Error("embedded-postgres failed to start");

  const pool = new Pool({ host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "postgres", max: 5 });
  const admin = await pool.connect();
  try {
    await admin.query('create extension if not exists "pgcrypto"');
    await admin.query("create role anon nologin");
    await admin.query("create role authenticated nologin");
    await admin.query("create role service_role nologin bypassrls");
    await admin.query(readFileSync(join(process.cwd(), CORE_MIGRATION), "utf8"));
    await admin.query(readFileSync(join(process.cwd(), SEED_MIGRATION), "utf8"));
  } finally {
    admin.release();
  }
  const stopPg = pg;
  const runOn = async (client: { query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }> }, text: string, params?: unknown[]) => {
    const result = await client.query(text, params as unknown[]);
    return { rows: result.rows as Array<Record<string, unknown>> };
  };
  return {
    query: async (text: string, params?: unknown[]) => {
      const client = await pool.connect();
      try {
        return await runOn(client, text, params);
      } finally {
        client.release();
      }
    },
    asRole: async (role: string, fn) => {
      const client = await pool.connect();
      try {
        await client.query(`set role ${role}`);
        try {
          return await fn((text, params) => runOn(client, text, params));
        } finally {
          await client.query("reset role");
        }
      } finally {
        client.release();
      }
    },
    stop: async () => {
      await pool.end();
      await stopPg.stop();
    },
  };
}

let pg: TestPostgres;

beforeAll(async () => {
  pg = await startBgmiTestPostgres();
}, 180_000);

afterAll(async () => {
  await pg.stop();
});

async function standings(stageSlug: string): Promise<Array<{ name: string; total: number }>> {
  const { rows } = await pg.query(
    `select tm.display_name as name,
            (e.starting_points + coalesce(sum(r.total_points), 0))::int as total
       from public.bgmi_stage_entries e
       join public.bgmi_stages s on s.id = e.stage_id
       join public.bgmi_tournaments t on t.id = s.tournament_id
       join public.bgmi_teams tm on tm.id = e.team_id
       left join public.bgmi_matches m on m.stage_id = s.id and m.status = 'completed'
       left join public.bgmi_match_results r on r.match_id = m.id and r.team_id = e.team_id
      where t.slug = 'bmsd-2026' and s.slug = $1
      group by tm.display_name, e.starting_points
      order by total desc`,
    [stageSlug]
  );
  return rows as Array<{ name: string; total: number }>;
}

describe("BGMI seed — published completeness", () => {
  it("publishes one tournament with grand-finals and playoffs", async () => {
    const { rows } = await pg.query(
      `select t.slug, s.slug as stage, s.status, s.smash_rule, s.match_point_threshold,
              (select count(*) from public.bgmi_matches m where m.stage_id = s.id) as matches,
              (select count(*) from public.bgmi_stage_entries e where e.stage_id = s.id) as entries,
              (select count(*) from public.bgmi_match_results r join public.bgmi_matches m on m.id = r.match_id where m.stage_id = s.id) as results
         from public.bgmi_tournaments t join public.bgmi_stages s on s.tournament_id = t.id
        where t.slug = 'bmsd-2026' order by s.slug`
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(Number(row["matches"])).toBe(18);
      expect(Number(row["entries"])).toBe(16);
      expect(Number(row["results"])).toBe(288);
      expect(row["status"]).toBe("completed");
    }
    const gf = rows.find((r) => r["stage"] === "grand-finals");
    expect(gf?.["smash_rule"]).toBe(true);
    expect(gf?.["match_point_threshold"]).toBe(204);
  });

  it("derives Grand Finals standings matching the verified source totals", async () => {
    const rows = await standings("grand-finals");
    expect(rows).toHaveLength(16);
    expect(rows[0]).toMatchObject({ name: "Nebula Esports", total: 210 });
    expect(rows.slice(1, 5).map((r) => r.name)).toEqual([
      "Gladiators Esports",
      "Orangutan",
      "Rapid Chaos Esports",
      "Team Apex Gaming",
    ]);
  });

  it("derives Playoffs standings matching the verified source totals", async () => {
    const rows = await standings("playoffs");
    expect(rows).toHaveLength(16);
    expect(rows[0]).toMatchObject({ name: "Team Outrage", total: 226 });
  });

  it("is idempotent: re-applying the seed changes nothing", async () => {
    await pg.query(readFileSync(join(process.cwd(), SEED_MIGRATION), "utf8"));
    const { rows } = await pg.query("select count(*) as n from public.bgmi_match_results");
    expect(Number(rows[0]?.["n"])).toBe(576);
    const gf = await standings("grand-finals");
    expect(gf[0]).toMatchObject({ name: "Nebula Esports", total: 210 });
  });

  it("exposes published rows to anon via RLS", async () => {
    const tournaments = await pg.asRole("anon", (query) => query("select count(*) as n from public.bgmi_tournaments"));
    expect(Number(tournaments.rows[0]?.["n"])).toBe(1);
    const stages = await pg.asRole("anon", (query) => query("select count(*) as n from public.bgmi_stages"));
    expect(Number(stages.rows[0]?.["n"])).toBe(2);
    const results = await pg.asRole("anon", (query) => query("select count(*) as n from public.bgmi_match_results"));
    expect(Number(results.rows[0]?.["n"])).toBe(576);
    // The operations ledger stays invisible to anon: no policy at all.
    await expect(pg.asRole("anon", (query) => query("select count(*) from public.bgmi_ingestion_runs"))).rejects.toThrow();
  });
});
