/**
 * Real-Postgres integration harness for Draft & Ban Free completion
 * (IMPLEMENT-02A).
 *
 * Same pattern as the Tie-Breaker harness (`tie-breaker-pg-harness.ts`): an
 * embedded PostgreSQL server (multi-backend: true concurrent connections)
 * with the minimal faithful subset of the production schema, plus the ACTUAL
 * shipped SQL extracted verbatim from the migration file (so the tested SQL
 * is byte-identical to what the owner applies).
 *
 * Subset mapping:
 * - profiles / organizations (+timezone + IANA CHECK) / organization_members
 *   / tools / tool_entitlements (source CHECK incl. 'free'):
 *   same shape as the Tie-Breaker harness.
 * - draft_ban_monthly_completions + consume_draft_ban_completion +
 *   completion-path guard: extracted from
 *   20251028000001_draft_ban_free_completion.sql
 * - draft_matches: minimal faithful subset (id, organization_id,
 *   created_by, status + completed_at + CHECKs). ref_code/share_token/
 *   actions/config columns never participate in quota decisions and are
 *   omitted; engine completeness is a service-layer concern.
 * - user_tool_entitlements (minimal): proves Sponsorship-style user grants
 *   never unlock Draft & Ban.
 * - The pre-existing completed-row immutability guard is intentionally out
 *   of scope here (service unit tests pin it); this harness proves the NEW
 *   completion-path guard.
 *
 * Not created (RPC paths never touch them): plans/subscriptions, orders/
 * payments, RLS policies (tests connect as the cluster superuser —
 * equivalent to service_role bypass for these tables).
 */
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { default as EmbeddedPostgres } from "embedded-postgres";
import { Pool, type PoolClient } from "pg";
import { killPortListener, withTimeout } from "./pg-harness";

const TIMEZONE_MIGRATION = "supabase/migrations/20251026000001_organization_timezone.sql";
const FREE_MIGRATION = "supabase/migrations/20251028000001_draft_ban_free_completion.sql";
const TEMPLATE_CAPS_MIGRATION = "supabase/migrations/20251029000001_draft_ban_template_caps.sql";
const SHARE_BRANDING_MIGRATION = "supabase/migrations/20251030000001_draft_ban_share_branding.sql";

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

create table public.user_tool_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_id uuid not null references public.tools(id) on delete cascade,
  source text not null default 'subscription' check (source in ('subscription','manual','promo','free')),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, tool_id)
);

create table public.draft_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  ref_code text,
  match_name text,
  event_name text,
  format_label text,
  team_a text,
  team_b text,
  sequence jsonb not null default '[]',
  pool jsonb not null default '[]',
  actions jsonb not null default '[]',
  share_token uuid not null unique default gen_random_uuid(),
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'abandoned')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draft_matches_completed_fields_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed')
  )
);

create table public.draft_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  config jsonb not null,
  is_starter boolean not null default false,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint draft_templates_org_name_unique unique (organization_id, name)
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

export async function startDraftBanTestPostgres(): Promise<TestPostgres> {
  const dataDir = mkdtempSync(join(tmpdir(), "micronest-db-test-"));
  let pg: { stop: () => Promise<void> } | null = null;
  let port = 0;
  let lastError: unknown = null;
  for (let p = 54371; p <= 54385; p++) {
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
    const freeMigration = readFileSync(join(process.cwd(), FREE_MIGRATION), "utf8");
    // IANA validator must exist before the organizations CHECK references it.
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
    // Ledger table (shipped definition, verbatim).
    await admin.query(
      extractSqlBlock(
        freeMigration,
        "create table if not exists public.draft_ban_monthly_completions (",
        ");",
      ),
    );
    await admin.query("alter table public.draft_ban_monthly_completions enable row level security");
    // Quota RPC (shipped definition, verbatim).
    await admin.query(
      extractSqlBlock(
        freeMigration,
        "create or replace function public.consume_draft_ban_completion(",
        "grant execute on function public.consume_draft_ban_completion(uuid, uuid, uuid) to service_role;",
      ),
    );
    // Completion-path guard (shipped definition, verbatim).
    await admin.query(
      extractSqlBlock(
        freeMigration,
        "create or replace function public.draft_ban_require_authorized_completion()",
        "for each row execute function public.draft_ban_require_authorized_completion();",
      ),
    );
    // Template caps (shipped migration, applied verbatim end-to-end: column +
    // backfill + cap fn + guard/trigger + creation RPC + starter RPC +
    // grants). The harness draft_templates DDL already carries is_starter,
    // so section 1 is a no-op here; every function/trigger below is
    // byte-identical to what the owner applies.
    const templateMigration = readFileSync(join(process.cwd(), TEMPLATE_CAPS_MIGRATION), "utf8");
    await admin.query(templateMigration);
    // Share branding gate (shipped migration, applied verbatim end-to-end:
    // paid-only organization_logo_url in get_completed_draft_share).
    const shareBrandingMigration = readFileSync(join(process.cwd(), SHARE_BRANDING_MIGRATION), "utf8");
    await admin.query(shareBrandingMigration);
    await admin.query(
      "insert into public.tools (slug, name) values ('draft-ban', 'Draft & Ban'), ('sponsor-sentinel', 'Sponsorship Tracking') on conflict (slug) do nothing",
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
    await withTimeout(pg!.stop(), 15_000).catch(() => undefined);
    // Orphaned postgres.exe children inherit stdio and hold the shell pipe
    // open after vitest exits — best-effort kill on our test-only port.
    await killPortListener(port).catch(() => undefined);
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
    for (let p = 54371; p <= 54385; p++) {
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
export async function truncateDraftBanTables(pg: Pick<TestPostgres, "query">): Promise<void> {
  await pg.query(
    "truncate public.draft_ban_monthly_completions, public.draft_matches, public.draft_templates, public.user_tool_entitlements, public.tool_entitlements, public.organization_members, public.organizations, public.profiles restart identity cascade",
  );
}

export interface DraftBanSeed {
  userId: string;
  orgId: string;
  toolId: string;
}

export async function seedDraftBanWorkspace(
  pg: Pick<TestPostgres, "query">,
  opts: {
    timezone?: string;
    grant?: "free" | "paid" | "all-access" | "expired-free" | "expired-paid" | null;
  } = {},
): Promise<DraftBanSeed> {
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await pg.query("insert into public.profiles (id) values ($1)", [userId]);
  await pg.query(
    "insert into public.organizations (id, name, slug, owner_id, timezone) values ($1, 'Org', $2, $3, $4)",
    [orgId, `org-${orgId.slice(0, 8)}`, userId, opts.timezone ?? "Asia/Kolkata"],
  );
  await pg.query("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')", [
    orgId,
    userId,
  ]);
  const tool = await pg.query("select id from public.tools where slug = 'draft-ban'");
  const toolId = String(tool.rows[0]?.id ?? "");
  const grant = opts.grant === undefined ? "free" : opts.grant;
  if (grant === "all-access") {
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, null, true, 'subscription', null)",
      [orgId],
    );
  } else if (grant !== null) {
    const source = grant === "free" || grant === "expired-free" ? "free" : "subscription";
    const expires =
      grant === "expired-free" || grant === "expired-paid"
        ? new Date(Date.now() - 86400000).toISOString()
        : null;
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, $2, false, $3, $4)",
      [orgId, toolId, source, expires],
    );
  }
  return { userId, orgId, toolId };
}

export async function insertMatch(
  pg: Pick<TestPostgres, "query">,
  seed: DraftBanSeed,
  opts: { status?: string; completedAt?: string | null } = {},
): Promise<string> {
  const id = crypto.randomUUID();
  const status = opts.status ?? "in_progress";
  const completed = status === "completed";
  await pg.query(
    `insert into public.draft_matches (id, organization_id, created_by, status, completed_at)
     values ($1, $2, $3, $4, $5)`,
    [id, seed.orgId, seed.userId, status, completed ? (opts.completedAt ?? new Date().toISOString()) : null],
  );
  return id;
}

export type { PoolClient };
