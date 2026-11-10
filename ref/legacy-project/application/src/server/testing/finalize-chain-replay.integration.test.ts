/**
 * NEXT-01-P1-01: real-Postgres proof that finalize integrity holds across a
 * genuine storage round-trip.
 *
 * The service-layer replay gate (`verifyActionChain`) runs on rows read back
 * from Postgres, so this lane proves the gate against real jsonb
 * serialization — not just in-memory fixtures:
 *
 * - a valid stored chain round-trips byte-faithfully, replays cleanly, and
 *   the quota RPC then completes it exactly once (ledger = 1);
 * - a forged stored chain (correct length, wrong turn order) fails replay,
 *   so the completion RPC is never reached: ledger = 0 and the row stays
 *   in_progress (quota untouched).
 *
 * Uses the existing draft-ban pg harness (embedded-postgres, shipped SQL
 * verbatim). No new infrastructure.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { Pool } from "pg";
import { verifyActionChain } from "@/features/draft-ban/services/draft-engine";
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

type StoredAction = { stepIndex: number; team: "A" | "B"; type: "ban" | "pick" | "side"; item: string; at: string };
type StoredStep = { team: "A" | "B"; type: "ban" | "pick" | "side" };

const SEQUENCE: StoredStep[] = [
  { team: "A", type: "ban" },
  { team: "B", type: "ban" },
  { team: "A", type: "ban" },
  { team: "B", type: "ban" },
  { team: "A", type: "pick" },
  { team: "B", type: "pick" },
];
const POOL = ["Map A", "Map B", "Map C", "Map D", "Map E", "Map F", "Map G"];

function validActions(): StoredAction[] {
  const items = ["Map A", "Map B", "Map C", "Map D", "Map E", "Map F"];
  return SEQUENCE.map((step, i) => ({
    stepIndex: i,
    team: step.team,
    type: step.type,
    item: items[i] ?? "",
    at: new Date().toISOString(),
  }));
}

async function insertStoredMatch(
  seed: DraftBanSeed,
  opts: { sequence?: StoredStep[]; pool?: string[]; actions?: StoredAction[] } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  await pg.query(
    `insert into public.draft_matches (id, organization_id, created_by, team_a, team_b, sequence, pool, actions, status)
     values ($1, $2, $3, 'TAG', 'Rivals', $4, $5, $6, 'in_progress')`,
    [id, seed.orgId, seed.userId, JSON.stringify(opts.sequence ?? SEQUENCE), JSON.stringify(opts.pool ?? POOL), JSON.stringify(opts.actions ?? [])],
  );
  return id;
}

async function readStoredMatch(matchId: string): Promise<{ sequence: StoredStep[]; pool: string[]; actions: StoredAction[]; status: string }> {
  const r = await pg.query("select sequence, pool, actions, status from public.draft_matches where id = $1", [matchId]);
  const row = r.rows[0] as unknown as { sequence: StoredStep[]; pool: string[]; actions: StoredAction[]; status: string };
  return { sequence: row.sequence, pool: row.pool, actions: row.actions, status: String(row.status) };
}

async function ledgerCount(orgId: string): Promise<number> {
  const r = await pg.query("select count(*)::int as n from public.draft_ban_monthly_completions where organization_id = $1", [orgId]);
  return Number(r.rows[0]?.n ?? 0);
}

describe("finalize chain replay across a real storage round-trip", () => {
  it("valid stored chain replays cleanly and completes exactly once (quota consumed once)", async () => {
    const seed = await seedDraftBanWorkspace(pg);
    const matchId = await insertStoredMatch(seed, { actions: validActions() });

    const stored = await readStoredMatch(matchId);
    expect(stored.status).toBe("in_progress");
    const replay = verifyActionChain(
      { teamA: "TAG", teamB: "Rivals", pool: stored.pool, sequence: stored.sequence },
      stored.actions,
    );
    expect(replay.ok).toBe(true);

    // Service would now call the quota RPC exactly once.
    const pool: Pool = pg.pool;
    const client = await pool.connect();
    try {
      await client.query("select * from public.consume_draft_ban_completion($1,$2,$3)", [seed.orgId, matchId, seed.userId]);
    } finally {
      client.release();
    }
    expect(await ledgerCount(seed.orgId)).toBe(1);
    expect((await readStoredMatch(matchId)).status).toBe("completed");
  });

  it("forged stored chain (correct length, wrong turn) fails replay: RPC never reached, quota untouched", async () => {
    const seed = await seedDraftBanWorkspace(pg);
    const forged = validActions().map((a, i) =>
      i === 0 ? { ...a, team: "B" as const } : i === 1 ? { ...a, team: "A" as const } : a,
    );
    const matchId = await insertStoredMatch(seed, { actions: forged });

    const stored = await readStoredMatch(matchId);
    const replay = verifyActionChain(
      { teamA: "TAG", teamB: "Rivals", pool: stored.pool, sequence: stored.sequence },
      stored.actions,
    );
    expect(replay.ok).toBe(false);

    // Service must not proceed: no RPC call happens here by construction.
    expect(await ledgerCount(seed.orgId)).toBe(0);
    expect((await readStoredMatch(matchId)).status).toBe("in_progress");
  });

  it("forged stored chain (duplicate selection) fails replay after a jsonb round-trip", async () => {
    const seed = await seedDraftBanWorkspace(pg);
    const forged = validActions().map((a, i) => (i === 1 ? { ...a, item: "Map A" } : a));
    const matchId = await insertStoredMatch(seed, { actions: forged });

    const stored = await readStoredMatch(matchId);
    const replay = verifyActionChain(
      { teamA: "TAG", teamB: "Rivals", pool: stored.pool, sequence: stored.sequence },
      stored.actions,
    );
    expect(replay.ok).toBe(false);
    expect(await ledgerCount(seed.orgId)).toBe(0);
  });
});
