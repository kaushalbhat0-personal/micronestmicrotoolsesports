/**
 * Share branding: real-Postgres proof for 20251030000001_draft_ban_share_branding.
 *
 * Exercises the ACTUAL shipped migration (applied verbatim end-to-end by the
 * harness) against a real PostgreSQL server (embedded-postgres). Proves the
 * public get_completed_draft_share RPC exposes organization_logo_url only
 * for paid / All Access workspaces, with no client-supplied access parameter
 * to manipulate, while Free sharing keeps working with the logo omitted.
 *
 * Lane: starts one embedded server per file (~10s). Not skippable.
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

const LOGO = "https://cdn.example/logo.png";

async function seedWithLogo(opts: { grant?: "free" | "paid" | "all-access" | "expired-free" | "expired-paid" | null; logo?: string | null } = {}): Promise<DraftBanSeed> {
  const seed = await seedDraftBanWorkspace(pg, { grant: opts.grant === undefined ? "free" : opts.grant });
  await pg.query("update public.organizations set logo_url = $2 where id = $1", [seed.orgId, opts.logo === undefined ? LOGO : opts.logo]);
  return seed;
}

async function insertCompletedShareableMatch(seed: DraftBanSeed): Promise<string> {
  const id = crypto.randomUUID();
  const sequence = JSON.stringify([
    { team: "A", type: "ban" },
    { team: "B", type: "ban" },
  ]);
  const pool = JSON.stringify(["Map A", "Map B"]);
  const actions = JSON.stringify([
    { stepIndex: 0, team: "A", type: "ban", item: "Map A", at: new Date().toISOString() },
    { stepIndex: 1, team: "B", type: "ban", item: "Map B", at: new Date().toISOString() },
  ]);
  await pg.query(
    `insert into public.draft_matches (id, organization_id, created_by, ref_code, team_a, team_b, sequence, pool, actions, status, completed_at)
     values ($1, $2, $3, 'DB-2026-00042', 'TAG', 'Rivals', $4::jsonb, $5::jsonb, $6::jsonb, 'completed', now())`,
    [id, seed.orgId, seed.userId, sequence, pool, actions],
  );
  const token = await pg.query("select share_token from public.draft_matches where id = $1", [id]);
  return String(token.rows[0]?.share_token ?? "");
}

async function fetchShare(token: string): Promise<Record<string, unknown> | null> {
  const res = await pg.query("select public.get_completed_draft_share($1) as share", [token]);
  return (res.rows[0]?.share as Record<string, unknown> | null) ?? null;
}

describe("share RPC branding gate", () => {
  it("free workspace share omits the logo but keeps every other field", async () => {
    const seed = await seedWithLogo({ grant: "free" });
    const share = await fetchShare(await insertCompletedShareableMatch(seed));
    expect(share).not.toBeNull();
    expect(share?.organization_logo_url).toBeNull();
    // Narrow DTO intact: names, record content, and shareability unaffected.
    expect(share?.organization_name).toBe("Org");
    expect(share?.team_a).toBe("TAG");
    expect(share?.ref_code).toBe("DB-2026-00042");
    expect((share?.actions as unknown[]).length).toBe(2);
  });

  it("paid workspace share exposes the current logo", async () => {
    const seed = await seedWithLogo({ grant: "paid" });
    const share = await fetchShare(await insertCompletedShareableMatch(seed));
    expect(share?.organization_logo_url).toBe(LOGO);
  });

  it("all-access workspace share exposes the current logo", async () => {
    const seed = await seedWithLogo({ grant: "all-access" });
    const share = await fetchShare(await insertCompletedShareableMatch(seed));
    expect(share?.organization_logo_url).toBe(LOGO);
  });

  it("expired paid + free behaves as free (logo omitted)", async () => {
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
    await pg.query("update public.organizations set logo_url = $2 where id = $1", [seed.orgId, LOGO]);
    const share = await fetchShare(await insertCompletedShareableMatch(seed));
    expect(share?.organization_logo_url).toBeNull();
    expect(share?.organization_name).toBe("Org");
  });

  it("workspace without any grant still shares (logo omitted) — public token model preserved", async () => {
    const seed = await seedWithLogo({ grant: null });
    const share = await fetchShare(await insertCompletedShareableMatch(seed));
    expect(share).not.toBeNull();
    expect(share?.organization_logo_url).toBeNull();
  });

  it("paid workspace without a logo returns null (never a broken image)", async () => {
    const seed = await seedWithLogo({ grant: "paid", logo: null });
    const share = await fetchShare(await insertCompletedShareableMatch(seed));
    expect(share?.organization_logo_url).toBeNull();
  });

  it("cross-org: a free org token never leaks another org's logo; a paid org gets its own", async () => {
    const freeSeed = await seedWithLogo({ grant: "free" });
    const paidSeed = await seedDraftBanWorkspace(pg, { grant: "paid" });
    await pg.query("update public.organizations set logo_url = $2 where id = $1", [paidSeed.orgId, "https://cdn.example/other.png"]);
    const freeShare = await fetchShare(await insertCompletedShareableMatch(freeSeed));
    expect(freeShare?.organization_logo_url).toBeNull();
    const paidShare = await fetchShare(await insertCompletedShareableMatch(paidSeed));
    expect(paidShare?.organization_logo_url).toBe("https://cdn.example/other.png");
  });

  it("unknown and in-progress tokens return no record", async () => {
    const seed = await seedWithLogo({ grant: "paid" });
    expect(await fetchShare(crypto.randomUUID())).toBeNull();
    const draftId = crypto.randomUUID();
    await pg.query(
      "insert into public.draft_matches (id, organization_id, created_by, status) values ($1, $2, $3, 'in_progress')",
      [draftId, seed.orgId, seed.userId],
    );
    const token = await pg.query("select share_token from public.draft_matches where id = $1", [draftId]);
    expect(await fetchShare(String(token.rows[0]?.share_token ?? ""))).toBeNull();
  });

  it("the RPC accepts only the share token — no access-level parameter exists to manipulate", async () => {
    const args = await pg.query(
      "select array_agg(t.typname order by t.typname) as types from pg_proc p join pg_namespace n on n.oid = p.pronamespace cross join lateral unnest(p.proargtypes) with ordinality as a(oid, ord) join pg_type t on t.oid = a.oid where n.nspname = 'public' and p.proname = 'get_completed_draft_share' group by p.oid",
      [],
    );
    expect(String(args.rows[0]?.types)).toBe("{uuid}");
    // SECURITY DEFINER with a fixed search_path (established convention).
    const fn = await pg.query(
      "select prosecdef as definer, proconfig as config from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'get_completed_draft_share'",
      [],
    );
    expect(fn.rows[0]?.definer).toBe(true);
  });
});
