/**
 * RCCF-ORG-MEMBERS-01: real-Postgres proof for member hardening.
 *
 * Applies the ACTUAL shipped migration verbatim
 * (supabase/migrations/20251109000001_org_members_hardening.sql) against
 * embedded PostgreSQL and exercises: the Owner/Admin/Member RPC matrix,
 * the last-owner trigger (incl. races), the owner_id guard, atomic
 * transfer, audit writes, and direct-API RLS denial simulated as the
 * `authenticated` role with a stubbed auth.uid() (JWT claims setting).
 *
 * Lane: one embedded server per file. Not skippable.
 */
import { describe, expect, it, beforeAll, afterAll, beforeEach, vi } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { default as EmbeddedPostgres } from "embedded-postgres";
import { Pool } from "pg";

vi.setConfig({ testTimeout: 60_000 });

const MIGRATION = "supabase/migrations/20251109000001_org_members_hardening.sql";
const MIGRATION_02 = "supabase/migrations/20251110000001_org_owner_deletion_safety.sql";

let pgCtl: { stop: () => Promise<void> };
let pool: Pool;
let dataDir: string;

async function q(text: string, params: unknown[] = []) {
  const res = await pool.query(text, params as never[]);
  return res.rows as Array<Record<string, unknown>>;
}

async function rpc(name: string, params: Record<string, string>) {
  const keys = Object.keys(params);
  const res = await pool.query(
    `select public.${name}(${keys.map((_, i) => `$${i + 1}`).join(",")}) as r`,
    keys.map((k) => params[k]),
  );
  return res.rows[0]?.r as { ok: boolean; error?: string; idempotent?: boolean; role?: string };
}

const ORG = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ORG2 = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const OWNER = "11111111-1111-4111-8111-111111111111";
const ADMIN = "22222222-2222-4222-8222-222222222222";
const MEMBER = "33333333-3333-4333-8333-333333333333";
const MEMBER2 = "44444444-4444-4444-8444-444444444444";
const OUTSIDER = "55555555-5555-4555-8555-555555555555";

async function seed() {
  await q(`insert into public.profiles (id) values ('${OWNER}'),('${ADMIN}'),('${MEMBER}'),('${MEMBER2}'),('${OUTSIDER}')`);
  await q(`insert into public.organizations (id, name, slug, owner_id) values ('${ORG}','Org','org', '${OWNER}')`);
  // founder trigger creates the owner row; add admin + members directly (test-only setup as postgres)
  await q(`insert into public.organization_members (organization_id, user_id, role) values ('${ORG}','${ADMIN}','admin'),('${ORG}','${MEMBER}','member'),('${ORG}','${MEMBER2}','member')`);
  await q(`insert into public.organizations (id, name, slug, owner_id) values ('${ORG2}','Org2','org2', '${OUTSIDER}')`);
}

async function ownerCount(org = ORG): Promise<number> {
  const rows = await q(`select count(*)::int as n from public.organization_members where organization_id='${org}' and role='owner'`);
  return Number(rows[0]?.n ?? 0);
}

async function roleOf(user: string, org = ORG): Promise<string | null> {
  const rows = await q(`select role from public.organization_members where organization_id='${org}' and user_id='${user}'`);
  return (rows[0]?.role as string) ?? null;
}

async function asUser<T>(userId: string, fn: (c: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query(`set role authenticated`);
    await c.query(`set request.jwt.claims = '${JSON.stringify({ sub: userId })}'`);
    return await fn(c);
  } finally {
    await c.query(`reset role`);
    c.release();
  }
}

beforeAll(async () => {
  dataDir = mkdtempSync(join(tmpdir(), "micronest-org-members-"));
  let lastError: unknown = null;
  for (let port = 54372; port <= 54380; port++) {
    const ctl = new EmbeddedPostgres({
      port,
      user: "postgres",
      password: "postgres",
      databaseDir: `${dataDir}-${port}`,
      persistent: false,
      initdbFlags: ["-E", "UTF8", "--locale=C"],
      onLog: () => undefined,
      onError: () => undefined,
    } as unknown as Record<string, unknown>);
    try {
      await (ctl as unknown as { initialise: () => Promise<void> }).initialise();
      await (ctl as unknown as { start: () => Promise<void> }).start();
      pgCtl = ctl as unknown as { stop: () => Promise<void> };
      pool = new Pool({ host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "postgres", max: 10 });
      lastError = null;
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!pool!) throw new Error(`embedded-postgres failed to start: ${String(lastError).slice(0, 200)}`);

  await q(`do $$ begin
    if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin; end if;
    if not exists (select 1 from pg_roles where rolname='direct_api') then create role direct_api nologin; end if;
  end $$;`);
  // auth.uid() stub reading the JWT-claims setting (mirrors Supabase semantics)
  await q(`create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql stable
    as $$ select nullif(current_setting('request.jwt.claims', true)::json->>'sub','')::uuid $$;`);
  await q(`create table public.profiles (id uuid primary key);
    create table public.organizations (id uuid primary key default gen_random_uuid(),
      name text not null, slug text not null unique, owner_id uuid not null references public.profiles(id) on delete restrict,
      created_at timestamptz default now(), updated_at timestamptz default now());
    create table public.organization_members (id uuid primary key default gen_random_uuid(),
      organization_id uuid not null references public.organizations(id) on delete cascade,
      user_id uuid not null references public.profiles(id) on delete cascade,
      role text not null default 'member' check (role in ('owner','admin','member')),
      created_at timestamptz default now(), unique (organization_id, user_id));
    create or replace function public.handle_new_organization() returns trigger language plpgsql
    security definer set search_path = public as $$
    begin insert into public.organization_members (organization_id, user_id, role)
      values (new.id, new.owner_id, 'owner') on conflict (organization_id, user_id) do nothing; return new; end; $$;
    create trigger on_organization_created after insert on public.organizations
      for each row execute function public.handle_new_organization();
    create or replace function public.is_org_member(org_id uuid) returns boolean language sql
    security definer set search_path = public stable as $$
      select exists (select 1 from public.organization_members where organization_id = org_id and user_id = auth.uid()); $$;
    grant execute on function public.is_org_member(uuid) to authenticated;
    create or replace function public.is_org_admin(org_id uuid) returns boolean language sql
    security definer set search_path = public stable as $$
      select exists (select 1 from public.organization_members where organization_id = org_id and user_id = auth.uid() and role in ('owner','admin')); $$;
    grant execute on function public.is_org_admin(uuid) to authenticated;
    alter table public.organization_members enable row level security;
    create policy "org_members_select_member" on public.organization_members for select to authenticated
      using (public.is_org_member(organization_id) or user_id = auth.uid());
    alter table public.organizations enable row level security;
    create policy "org_select_member" on public.organizations for select to authenticated
      using (public.is_org_member(id) or owner_id = auth.uid());
    create policy "org_insert_authenticated" on public.organizations for insert to authenticated
      with check (owner_id = auth.uid());
    create policy "org_update_admin_test" on public.organizations for update to authenticated
      using (public.is_org_admin(id)) with check (public.is_org_admin(id));`);
  // Supabase-equivalent table privileges: RLS policies (not grants) decide rows.
  await q(`grant select, insert, update, delete on public.profiles to authenticated, direct_api;
    grant select, insert, update, delete on public.organizations to authenticated, direct_api;
    grant select, insert, update, delete on public.organization_members to authenticated, direct_api;`);

  const mig = readFileSync(join(process.cwd(), MIGRATION), "utf8");
  await q(mig);
  // RCCF-ORG-MEMBERS-02: deletion-safe enforcement supersedes the §2 trigger
  // design and the transfer self-transfer branch (production applies the old
  // file first, then this file — same order here).
  const mig02 = readFileSync(join(process.cwd(), MIGRATION_02), "utf8");
  await q(mig02);
}, 180_000);

afterAll(async () => {
  await pool.end().catch(() => undefined);
  await pgCtl.stop().catch(() => undefined);
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    // best effort
  }
}, 60_000);

beforeEach(async () => {
  // Truncation would trip the last-owner guard — bypass triggers on a
  // dedicated connection (test-only cleanup, never application behavior).
  const c = await pool.connect();
  try {
    await c.query(`set session session_replication_role = 'replica'`);
    await c.query(`delete from public.organization_audit_logs`);
    await c.query(`delete from public.organization_members`);
    await c.query(`delete from public.organizations`);
    await c.query(`delete from public.profiles`);
    await c.query(`set session session_replication_role = 'origin'`);
  } finally {
    c.release();
  }
  await seed();
});

describe("member RPC matrix — real Postgres, shipped SQL", () => {
  it("owner adds member and admin; admin adds member only", async () => {
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: OUTSIDER, p_role: "member", p_actor: OWNER })).toMatchObject({ ok: true });
    expect(await roleOf(OUTSIDER)).toBe("member");
    const outsider2 = "66666666-6666-4666-8666-666666666666";
    await q(`insert into public.profiles (id) values ('${outsider2}')`);
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: outsider2, p_role: "admin", p_actor: OWNER })).toMatchObject({ ok: true });
    const outsider3 = "77777777-7777-4777-8777-777777777777";
    await q(`insert into public.profiles (id) values ('${outsider3}')`);
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: outsider3, p_role: "member", p_actor: ADMIN })).toMatchObject({ ok: true });
    const outsider4 = "88888888-8888-4888-8888-888888888888";
    await q(`insert into public.profiles (id) values ('${outsider4}')`);
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: outsider4, p_role: "admin", p_actor: ADMIN })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: MEMBER2, p_role: "member", p_actor: MEMBER })).toMatchObject({ ok: false, error: "forbidden" });
  });

  it("add rejects owner role, duplicates, unknown users", async () => {
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: OUTSIDER, p_role: "owner", p_actor: OWNER })).toMatchObject({ ok: false, error: "invalid_role" });
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: MEMBER, p_role: "member", p_actor: OWNER })).toMatchObject({ ok: false, error: "duplicate" });
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: "99999999-9999-4999-8999-999999999999", p_role: "member", p_actor: OWNER })).toMatchObject({ ok: false, error: "not_found" });
    expect(await rpc("add_organization_member", { p_org: ORG, p_target: OUTSIDER, p_role: "member", p_actor: OUTSIDER })).toMatchObject({ ok: false, error: "not_member" });
  });

  it("owner promotes/demotes; admin/member role changes denied; owners immutable here", async () => {
    expect(await rpc("change_member_role", { p_org: ORG, p_target: MEMBER, p_role: "admin", p_actor: OWNER })).toMatchObject({ ok: true });
    expect(await roleOf(MEMBER)).toBe("admin");
    expect(await rpc("change_member_role", { p_org: ORG, p_target: MEMBER, p_role: "member", p_actor: OWNER })).toMatchObject({ ok: true });
    expect(await rpc("change_member_role", { p_org: ORG, p_target: MEMBER, p_role: "admin", p_actor: ADMIN })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await rpc("change_member_role", { p_org: ORG, p_target: ADMIN, p_role: "member", p_actor: MEMBER })).toMatchObject({ ok: false, error: "forbidden" });
    // owner rows are immutable on this path even for owners (drifted second owner)
    await q(`update public.organization_members set role='owner' where organization_id='${ORG}' and user_id='${MEMBER2}'`);
    expect(await rpc("change_member_role", { p_org: ORG, p_target: MEMBER2, p_role: "member", p_actor: OWNER })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await ownerCount()).toBe(2);
    expect(await rpc("change_member_role", { p_org: ORG, p_target: MEMBER, p_role: "owner", p_actor: OWNER })).toMatchObject({ ok: false, error: "invalid_role" });
    expect(await rpc("change_member_role", { p_org: ORG, p_target: MEMBER2, p_role: "admin", p_actor: MEMBER2 })).toMatchObject({ ok: false, error: "self" });
  });

  it("remove matrix: owner removes admin/member; admin removes members only", async () => {
    // negatives first (all actors/rows intact)
    expect(await rpc("remove_organization_member", { p_org: ORG, p_target: ADMIN, p_actor: MEMBER2 })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await rpc("remove_organization_member", { p_org: ORG, p_target: OWNER, p_actor: ADMIN })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await rpc("remove_organization_member", { p_org: ORG, p_target: ADMIN, p_actor: ADMIN })).toMatchObject({ ok: false, error: "self" });
    expect(await rpc("remove_organization_member", { p_org: ORG, p_target: OWNER, p_actor: OWNER })).toMatchObject({ ok: false, error: "self" });
    // then the permitted removals
    expect(await rpc("remove_organization_member", { p_org: ORG, p_target: MEMBER, p_actor: OWNER })).toMatchObject({ ok: true });
    expect(await roleOf(MEMBER)).toBeNull();
    expect(await rpc("remove_organization_member", { p_org: ORG, p_target: MEMBER2, p_actor: ADMIN })).toMatchObject({ ok: true });
    expect(await rpc("remove_organization_member", { p_org: ORG, p_target: ADMIN, p_actor: OWNER })).toMatchObject({ ok: true });
  });

  it("leave: member and admin leave; sole owner blocked", async () => {
    expect(await rpc("leave_organization", { p_org: ORG, p_actor: MEMBER })).toMatchObject({ ok: true });
    expect(await rpc("leave_organization", { p_org: ORG, p_actor: ADMIN })).toMatchObject({ ok: true });
    expect(await rpc("leave_organization", { p_org: ORG, p_actor: OWNER })).toMatchObject({ ok: false, error: "last_owner" });
    expect(await ownerCount()).toBe(1);
  });

  it("transfer is atomic: owner_id healed, roles swapped, exactly one owner", async () => {
    expect(await rpc("transfer_organization_ownership", { p_org: ORG, p_target: ADMIN, p_actor: OWNER })).toMatchObject({ ok: true });
    expect(await ownerCount()).toBe(1);
    expect(await roleOf(ADMIN)).toBe("owner");
    expect(await roleOf(OWNER)).toBe("admin");
    const rows = await q(`select owner_id from public.organizations where id='${ORG}'`);
    expect(rows[0]?.owner_id).toBe(ADMIN);
    // non-owners cannot transfer (actor is a plain member here)
    expect(await rpc("transfer_organization_ownership", { p_org: ORG, p_target: MEMBER2, p_actor: MEMBER })).toMatchObject({ ok: false, error: "forbidden" });
    // cross-org target rejected even for the current owner (now ADMIN)
    expect(await rpc("transfer_organization_ownership", { p_org: ORG, p_target: OUTSIDER, p_actor: ADMIN })).toMatchObject({ ok: false, error: "not_found" });
    // audit trail written
    const audit = await q(`select action, before_role, after_role from public.organization_audit_logs where organization_id='${ORG}' order by created_at`);
    expect(audit.map((a) => a.action)).toContain("organization.transfer_ownership");
  });

  it("mutations write audit rows", async () => {
    await rpc("add_organization_member", { p_org: ORG, p_target: OUTSIDER, p_role: "member", p_actor: OWNER });
    await rpc("change_member_role", { p_org: ORG, p_target: MEMBER, p_role: "admin", p_actor: OWNER });
    const audit = await q(`select action from public.organization_audit_logs where organization_id='${ORG}' order by created_at`);
    expect(audit.map((a) => a.action)).toEqual(["member.add", "member.role_change"]);
  });
});

describe("last-owner trigger + owner_id guard — direct SQL", () => {
  it("direct delete/demotion of sole owner raises", async () => {
    await expect(q(`delete from public.organization_members where organization_id='${ORG}' and user_id='${OWNER}'`)).rejects.toThrow(/retain at least one owner/);
    await expect(q(`update public.organization_members set role='member' where organization_id='${ORG}' and user_id='${OWNER}'`)).rejects.toThrow(/retain at least one owner/);
    expect(await ownerCount()).toBe(1);
  });

  it("direct owner_id rewrite rejected for non-postgres roles", async () => {
    // production-equivalent path: admin role over PostgREST reaches the row
    // through RLS, then the owner_id guard trigger rejects the rewrite.
    await asUser(ADMIN, async (c) => {
      await expect(c.query(`update public.organizations set owner_id='${ADMIN}' where id='${ORG}'`)).rejects.toThrow(/only change via transfer/);
    });
    const rows = await q(`select owner_id from public.organizations where id='${ORG}'`);
    expect(rows[0]?.owner_id).toBe(OWNER);
  });

  it("concurrent leaves never yield zero owners", async () => {
    // create a second owner directly (test-only drift setup)
    await q(`update public.organization_members set role='owner' where organization_id='${ORG}' and user_id='${ADMIN}'`);
    expect(await ownerCount()).toBe(2);
    const a = await pool.connect();
    const b = await pool.connect();
    const [ra, rb] = await Promise.allSettled([
      a.query(`select public.leave_organization('${ORG}','${OWNER}') as r`),
      b.query(`select public.leave_organization('${ORG}','${ADMIN}') as r`),
    ]);
    a.release();
    b.release();
    const oks = [ra, rb].filter((s) => s.status === "fulfilled" && (s.value.rows[0]?.r as { ok: boolean })?.ok === true);
    expect(oks.length).toBe(1);
    expect(await ownerCount()).toBe(1);
  });

  it("concurrent transfers leave exactly one owner", async () => {
    await q(`update public.organization_members set role='owner' where organization_id='${ORG}' and user_id='${ADMIN}'`);
    const a = await pool.connect();
    const b = await pool.connect();
    const [ra, rb] = await Promise.allSettled([
      a.query(`select public.transfer_organization_ownership('${ORG}','${ADMIN}','${OWNER}') as r`),
      b.query(`select public.transfer_organization_ownership('${ORG}','${OWNER}','${ADMIN}') as r`),
    ]);
    a.release();
    b.release();
    expect(ra.status).toBe("fulfilled");
    expect(rb.status).toBe("fulfilled");
    expect(await ownerCount()).toBe(1);
  });
});

describe("RCCF-ORG-MEMBERS-02 — deletion safety + transfer semantics", () => {
  it("G. legitimate organization deletion removes org + members + audit", async () => {
    await q(`delete from public.organizations where id='${ORG}'`);
    expect(await q(`select id from public.organizations where id='${ORG}'`)).toHaveLength(0);
    expect(await q(`select user_id from public.organization_members where organization_id='${ORG}'`)).toHaveLength(0);
    expect(await q(`select id from public.organization_audit_logs where organization_id='${ORG}'`)).toHaveLength(0);
  });

  it("H. deletion with owner/admin/member/audit rows leaves no invalid state", async () => {
    // perform audited mutations first so audit rows exist, then delete parent
    await q(`select public.add_organization_member('${ORG}','${OUTSIDER}','member','${OWNER}')`);
    await q(`select public.remove_organization_member('${ORG}','${OUTSIDER}','${OWNER}')`);
    const before = await q(`select count(*)::int as n from public.organization_audit_logs where organization_id='${ORG}'`);
    expect(Number(before[0]?.n)).toBeGreaterThan(0);
    await q(`delete from public.organizations where id='${ORG}'`);
    expect(await q(`select count(*)::int as n from public.organization_members where organization_id='${ORG}'`)).toEqual([{ n: 0 }]);
    expect(await q(`select count(*)::int as n from public.organization_audit_logs where organization_id='${ORG}'`)).toEqual([{ n: 0 }]);
  });

  it("D/E. direct sole-owner delete/demotion still blocked at commit", async () => {
    await expect(q(`delete from public.organization_members where organization_id='${ORG}' and user_id='${OWNER}'`)).rejects.toThrow(/retain at least one owner/);
    await expect(q(`update public.organization_members set role='member' where organization_id='${ORG}' and user_id='${OWNER}'`)).rejects.toThrow(/retain at least one owner/);
    expect(await ownerCount()).toBe(1);
  });

  it("F. concurrent demotions never commit zero owners", async () => {
    await q(`update public.organization_members set role='owner' where organization_id='${ORG}' and user_id='${ADMIN}'`);
    expect(await ownerCount()).toBe(2);
    const a = await pool.connect();
    const b = await pool.connect();
    // both demote a different owner simultaneously; at most one may win only
    // if an owner remains — here both demotions together would empty owners.
    const [ra, rb] = await Promise.allSettled([
      a.query(`update public.organization_members set role='member' where organization_id='${ORG}' and user_id='${OWNER}'`),
      b.query(`update public.organization_members set role='member' where organization_id='${ORG}' and user_id='${ADMIN}'`),
    ]);
    a.release();
    b.release();
    const failed = [ra, rb].filter((s) => s.status === "rejected").length;
    expect(failed).toBeGreaterThanOrEqual(1);
    expect(await ownerCount()).toBeGreaterThanOrEqual(1);
  });

  it("B. reverse transfer restores original owner", async () => {
    expect(await rpc("transfer_organization_ownership", { p_org: ORG, p_target: ADMIN, p_actor: OWNER })).toMatchObject({ ok: true });
    expect(await rpc("transfer_organization_ownership", { p_org: ORG, p_target: OWNER, p_actor: ADMIN })).toMatchObject({ ok: true });
    expect(await ownerCount()).toBe(1);
    expect(await roleOf(OWNER)).toBe("owner");
    expect(await roleOf(ADMIN)).toBe("admin");
    const rows = await q(`select owner_id from public.organizations where id='${ORG}'`);
    expect(rows[0]?.owner_id).toBe(OWNER);
  });

  it("I. non-owner self-transfer is forbidden; owner self-transfer idempotent", async () => {
    expect(await rpc("transfer_organization_ownership", { p_org: ORG, p_target: MEMBER, p_actor: MEMBER })).toMatchObject({ ok: false, error: "forbidden" });
    expect(await rpc("transfer_organization_ownership", { p_org: ORG, p_target: OWNER, p_actor: OWNER })).toMatchObject({ ok: true, idempotent: true });
    expect(await ownerCount()).toBe(1);
    const rows = await q(`select owner_id from public.organizations where id='${ORG}'`);
    expect(rows[0]?.owner_id).toBe(OWNER);
  });

  it("J. successful transfer writes exactly one audit row; failures write none", async () => {
    const countAudit = async () =>
      Number((await q(`select count(*)::int as n from public.organization_audit_logs where organization_id='${ORG}'`))[0]?.n ?? 0);
    const before = await countAudit();
    await rpc("transfer_organization_ownership", { p_org: ORG, p_target: MEMBER, p_actor: MEMBER });
    await rpc("transfer_organization_ownership", { p_org: ORG, p_target: OUTSIDER, p_actor: OWNER });
    expect(await countAudit()).toBe(before);
    expect(await rpc("transfer_organization_ownership", { p_org: ORG, p_target: ADMIN, p_actor: OWNER })).toMatchObject({ ok: true });
    expect(await countAudit()).toBe(before + 1);
    const rows = await q(`select action, before_role, after_role from public.organization_audit_logs where organization_id='${ORG}' order by created_at desc limit 1`);
    expect(rows[0]).toMatchObject({ action: "organization.transfer_ownership", before_role: "admin", after_role: "owner" });
  });

  it("K. direct membership manipulation still denied after resync", async () => {
    const c = await pool.connect();
    try {
      await c.query(`set role authenticated`);
      await c.query(`set request.jwt.claims = '${JSON.stringify({ sub: MEMBER })}'`);
      await expect(c.query(`insert into public.organization_members (organization_id, user_id, role) values ('${ORG}','${OUTSIDER}','owner')`)).rejects.toThrow(/42501|policy/);
      const up = await c.query(`update public.organization_members set role='owner' where organization_id='${ORG}' and user_id='${MEMBER}' returning user_id`);
      expect(up.rowCount).toBe(0);
    } finally {
      await c.query(`reset role`);
      c.release();
    }
    expect(await roleOf(MEMBER)).toBe("member");
    expect(await ownerCount()).toBe(1);
  });
});

describe("direct-API RLS — authenticated role with JWT", () => {
  it("member cannot insert/update/delete members directly", async () => {
    await asUser(MEMBER, async (c) => {
      // INSERT with no policy is an error; UPDATE/DELETE with no matching
      // rows are silent no-ops — assert the rows are unchanged.
      await expect(c.query(`insert into public.organization_members (organization_id, user_id, role) values ('${ORG}','${OUTSIDER}','admin')`)).rejects.toThrow(/42501|policy/);
      const up = await c.query(`update public.organization_members set role='admin' where organization_id='${ORG}' and user_id='${MEMBER2}' returning user_id`);
      expect(up.rowCount).toBe(0);
      const del = await c.query(`delete from public.organization_members where organization_id='${ORG}' and user_id='${MEMBER2}' returning user_id`);
      expect(del.rowCount).toBe(0);
      // self-leave policy is gone: even own row cannot be deleted directly
      const self = await c.query(`delete from public.organization_members where organization_id='${ORG}' and user_id='${MEMBER}' returning user_id`);
      expect(self.rowCount).toBe(0);
    });
    expect(await roleOf(MEMBER2)).toBe("member");
    expect(await roleOf(MEMBER)).toBe("member");
  });

  it("admin cannot escalate directly", async () => {
    await asUser(ADMIN, async (c) => {
      const up = await c.query(`update public.organization_members set role='owner' where organization_id='${ORG}' and user_id='${ADMIN}' returning user_id`);
      expect(up.rowCount).toBe(0);
      const del = await c.query(`delete from public.organization_members where organization_id='${ORG}' and user_id='${OWNER}' returning user_id`);
      expect(del.rowCount).toBe(0);
    });
    expect(await roleOf(ADMIN)).toBe("admin");
    expect(await ownerCount()).toBe(1);
  });

  it("member reads still work; org creation still seeds founder owner", async () => {
    const rows = await asUser(MEMBER, async (c) => {
      const r = await c.query(`select user_id, role from public.organization_members where organization_id='${ORG}'`);
      return r.rows;
    });
    expect(rows.length).toBe(4);
    // org creation via direct API still works and seeds the founder (SECURITY DEFINER trigger)
    const NEWORG = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    await asUser(OUTSIDER, async (c) => {
      await c.query(`insert into public.organizations (id, name, slug, owner_id) values ('${NEWORG}','New','new-org','${OUTSIDER}')`);
    });
    expect(await roleOf(OUTSIDER, NEWORG)).toBe("owner");
  });
});
