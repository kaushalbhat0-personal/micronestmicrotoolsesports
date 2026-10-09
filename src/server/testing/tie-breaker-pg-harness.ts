/**
 * Real-Postgres integration harness for Tie-Breaker Free (IMPLEMENT-07).
 *
 * Same pattern as the FIX-06 harness (`pg-harness.ts`): an embedded
 * PostgreSQL server (multi-backend: true concurrent connections) with the
 * minimal faithful subset of the production schema, plus the ACTUAL shipped
 * SQL extracted verbatim from the migration files (so the tested SQL is
 * byte-identical to what the owner applies).
 *
 * Subset mapping (columns mirror the real migrations):
 * - profiles / organizations (+timezone + IANA CHECK) / organization_members
 *   / tools / tool_entitlements (source CHECK incl. 'free'):
 *   20250930000001 + 20251026000001 + 20251027000001 (§1)
 * - tie_breaker_competitions (+ locked-field CHECKs) + ref sequence +
 *   tie_breaker_next_ref(): 20251017000001
 * - consume_tie_breaker_lock + lock-path guard + share RPC: extracted from
 *   20251027000001_tie_breaker_free_tier.sql
 * - orders / payments (minimal columns touched by the billing function) +
 *   complete_billing_payment: extracted from 20251027000001 (§5)
 *
 * Not created (RPC paths never touch them): teams/results (quota counts
 * locked competitions only), plans/subscriptions, user grants, RLS policies
 * (tests connect as the cluster superuser — equivalent to service_role
 * bypass for these tables).
 */
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { default as EmbeddedPostgres } from "embedded-postgres";
import { Pool, type PoolClient } from "pg";

const TIMEZONE_MIGRATION = "supabase/migrations/20251026000001_organization_timezone.sql";
const CORE_MIGRATION = "supabase/migrations/20251017000001_tie_breaker_core.sql";
const FREE_MIGRATION = "supabase/migrations/20251027000001_tie_breaker_free_tier.sql";

/** Extract a shipped SQL block verbatim between two markers (inclusive). */
export function extractSqlBlock(migrationSql: string, startMarker: string, endMarker: string): string {
  const start = migrationSql.indexOf(startMarker);
  if (start < 0) throw new Error(`start marker not found: ${startMarker}`);
  const end = migrationSql.indexOf(endMarker, start);
  if (end < 0) throw new Error(`end marker not found: ${endMarker}`);
  return migrationSql.slice(start, end + endMarker.length);
}

const SCHEMA_SQL = `
create extension if not exists "pgcrypto";

-- Supabase-predefined roles referenced by GRANT/REVOKE in migrations.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create table public.profiles (
  id uuid primary key,
  email text
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_id uuid not null references public.profiles(id) on delete restrict,
  logo_url text,
  timezone text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organizations_timezone_valid_iana check (public.is_valid_iana_timezone(timezone))
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.tool_entitlements (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_id uuid references public.tools(id) on delete cascade,
  is_all_access boolean not null default false,
  source text not null default 'subscription' check (source in ('subscription','manual','promo','free')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint entitlements_all_access_check check (
    (is_all_access = true and tool_id is null) or
    (is_all_access = false and tool_id is not null)
  ),
  unique (organization_id, tool_id)
);
create unique index if not exists tool_entitlements_all_access_unique
  on public.tool_entitlements(organization_id) where is_all_access = true;

create table public.tie_breaker_competitions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 500),
  status text not null default 'draft' check (status in ('draft', 'active', 'locked')),
  scoring_win smallint not null default 3,
  scoring_draw smallint not null default 1,
  scoring_loss smallint not null default 0,
  draws_enabled boolean not null default false,
  round_label text not null default 'rounds',
  rule_order text[] not null default array['points']::text[],
  preset_ref text,
  share_token uuid not null unique default gen_random_uuid(),
  record_number text unique,
  locked_at timestamptz,
  locked_snapshot jsonb,
  cloned_from uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tie_breaker_locked_fields_check check (
    (status = 'locked' and locked_at is not null and record_number is not null and locked_snapshot is not null)
    or (status <> 'locked')
  )
);

create sequence if not exists public.tie_breaker_ref_seq as bigint start with 1 increment by 1;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tool_id uuid references public.tools(id) on delete cascade,
  is_all_access boolean not null default false,
  buyer_user_id uuid references public.profiles(id) on delete set null,
  amount_minor integer not null default 0,
  currency text not null default 'INR',
  status text not null default 'created',
  razorpay_order_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  razorpay_payment_id text,
  razorpay_signature text,
  amount_minor integer not null default 0,
  currency text not null default 'INR',
  status text not null default 'created',
  verified_at timestamptz,
  created_at timestamptz not null default now()
);
`;

export interface TestPostgres {
  pool: Pool;
  newPool: () => Pool;
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
  stop: () => Promise<void>;
}

async function tryStart(port: number, databaseDir: string) {
  const pg = new EmbeddedPostgres({
    port,
    user: "postgres",
    password: "postgres",
    databaseDir,
    persistent: false,
    initdbFlags: ["-E", "UTF8", "--locale=C"],
    onLog: () => undefined,
    onError: () => undefined,
  } as unknown as Record<string, unknown>);
  await (pg as unknown as { initialise: () => Promise<void> }).initialise();
  await (pg as unknown as { start: () => Promise<void> }).start();
  return pg as unknown as { stop: () => Promise<void> };
}

export async function startTieBreakerTestPostgres(): Promise<TestPostgres> {
  const dataDir = mkdtempSync(join(tmpdir(), "micronest-tb-test-"));
  let pg: { stop: () => Promise<void> } | null = null;
  let port = 0;
  let lastError: unknown = null;
  for (let p = 54351; p <= 54365; p++) {
    try {
      pg = await tryStart(p, `${dataDir}-${p}`);
      port = p;
      break;
    } catch (e) {
      lastError = e;
    }
  }
  if (!pg) throw new Error(`embedded-postgres failed to start: ${String(lastError).slice(0, 300)}`);

  const baseConfig = { host: "127.0.0.1", port, user: "postgres", password: "postgres", database: "postgres" };
  const pool = new Pool({ ...baseConfig, max: 10 });
  const admin = await pool.connect();
  try {
    const tzMigration = readFileSync(join(process.cwd(), TIMEZONE_MIGRATION), "utf8");
    const coreMigration = readFileSync(join(process.cwd(), CORE_MIGRATION), "utf8");
    const freeMigration = readFileSync(join(process.cwd(), FREE_MIGRATION), "utf8");
    // IANA validator must exist before the organizations CHECK references it.
    // Extracted without its GRANT (roles are created below); grants re-applied after.
    await admin.query(
      extractSqlBlock(
        tzMigration,
        "create or replace function public.is_valid_iana_timezone(",
        "$$;",
      ),
    );
    await admin.query(SCHEMA_SQL);
    await admin.query(
      "grant execute on function public.is_valid_iana_timezone(text) to authenticated, service_role, anon",
    );
    // Record-number allocator (shipped core definition).
    await admin.query(
      extractSqlBlock(
        coreMigration,
        "create or replace function public.tie_breaker_next_ref()",
        "grant execute on function public.tie_breaker_next_ref() to authenticated, service_role;",
      ),
    );
    // Quota RPC + lock-path guard (shipped free-tier definitions).
    await admin.query(
      extractSqlBlock(
        freeMigration,
        "create or replace function public.consume_tie_breaker_lock(",
        "grant execute on function public.consume_tie_breaker_lock(uuid, uuid, uuid, jsonb, timestamptz) to service_role;",
      ),
    );
    await admin.query(
      extractSqlBlock(
        freeMigration,
        "create or replace function public.tie_breaker_require_authorized_lock()",
        "for each row execute function public.tie_breaker_require_authorized_lock();",
      ),
    );
    // Paid-only share branding (shipped free-tier definition).
    await admin.query(
      extractSqlBlock(
        freeMigration,
        "create or replace function public.get_completed_tie_breaker_share(p_token uuid)",
        "to anon, authenticated;",
      ),
    );
    // Billing completion with the Free→Paid org transition.
    await admin.query(
      extractSqlBlock(
        freeMigration,
        "create or replace function public.complete_billing_payment(",
        "grant execute on function public.complete_billing_payment(uuid, text, text, integer, text, timestamptz, text) to service_role;",
      ),
    );
    await admin.query(
      "insert into public.tools (slug, name) values ('tie-breaker', 'Tie-Breaker Resolver') on conflict (slug) do nothing",
    );
  } finally {
    admin.release();
  }

  const query = async (text: string, params: unknown[] = []) => {
    const res = await pool.query(text, params as unknown[]);
    return { rows: res.rows as Array<Record<string, unknown>>, rowCount: res.rowCount };
  };
  const stop = async () => {
    await pool.end().catch(() => undefined);
    await pg!.stop().catch(() => undefined);
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
    for (let p = 54351; p <= 54365; p++) {
      try {
        rmSync(`${dataDir}-${p}`, { recursive: true, force: true });
      } catch {
        // best effort
      }
    }
  };
  return {
    pool,
    newPool: () => new Pool({ ...baseConfig, max: 5 }),
    query,
    stop,
  };
}

/** Remove all tenant rows between tests (tool catalog + functions retained). */
export async function truncateTieBreakerTables(pg: Pick<TestPostgres, "query">): Promise<void> {
  await pg.query(
    "truncate public.payments, public.orders, public.tie_breaker_competitions, public.tool_entitlements, public.organization_members, public.organizations, public.profiles restart identity cascade",
  );
}

/** Ref-sequence restart so record numbers are deterministic per test. */
export async function restartTieBreakerRefSeq(pg: Pick<TestPostgres, "query">): Promise<void> {
  await pg.query("alter sequence public.tie_breaker_ref_seq restart with 1");
}

export interface TieBreakerSeed {
  userId: string;
  orgId: string;
  toolId: string;
}

export async function seedTieBreakerWorkspace(
  pg: Pick<TestPostgres, "query">,
  opts: {
    timezone?: string;
    grant?: "free" | "paid" | "all-access" | null;
    grantExpired?: boolean;
    logoUrl?: string | null;
  } = {},
): Promise<TieBreakerSeed> {
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await pg.query("insert into public.profiles (id) values ($1)", [userId]);
  await pg.query(
    "insert into public.organizations (id, name, slug, owner_id, timezone, logo_url) values ($1, 'Org', $2, $3, $4, $5)",
    [orgId, `org-${orgId.slice(0, 8)}`, userId, opts.timezone ?? "Asia/Kolkata", opts.logoUrl ?? null],
  );
  await pg.query("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')", [
    orgId,
    userId,
  ]);
  const tool = await pg.query("select id from public.tools where slug = 'tie-breaker'");
  const toolId = String(tool.rows[0]?.id ?? "");
  const grant = opts.grant === undefined ? "free" : opts.grant;
  if (grant === "all-access") {
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, null, true, 'subscription', null)",
      [orgId],
    );
  } else if (grant !== null) {
    const source = grant === "free" ? "free" : "subscription";
    const expires = grant === "free" ? null : opts.grantExpired ? new Date(Date.now() - 86400000).toISOString() : null;
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, $2, false, $3, $4)",
      [orgId, toolId, source, expires],
    );
  }
  return { userId, orgId, toolId };
}

/** Deterministic fixture numbers (TB-2026-80xxx): never collide with the
 *  restarted ref sequence (00001…) nor with each other across the run. */
let fixtureRecordCounter = 80000;

export async function insertCompetition(
  pg: Pick<TestPostgres, "query">,
  seed: TieBreakerSeed,
  opts: { status?: string; lockedAt?: string | null; recordNumber?: string | null } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  const status = opts.status ?? "active";
  const locked = status === "locked";
  const recordNumber = locked ? (opts.recordNumber ?? `TB-2026-${String(++fixtureRecordCounter).padStart(5, "0")}`) : null;
  await pg.query(
    `insert into public.tie_breaker_competitions
      (id, organization_id, created_by, name, status, rule_order, record_number, locked_at, locked_snapshot)
     values ($1, $2, $3, 'Cup', $4, array['points','h2h']::text[], $5, $6,
       case when $4 = 'locked' then '{"standings":[],"explanations":[]}'::jsonb else null end)`,
    [id, seed.orgId, seed.userId, status, recordNumber, locked ? (opts.lockedAt ?? new Date().toISOString()) : null],
  );
  return id;
}

export type { PoolClient };
