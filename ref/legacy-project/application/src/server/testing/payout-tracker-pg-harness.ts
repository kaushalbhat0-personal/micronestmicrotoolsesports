/**
 * Real-Postgres integration harness for Prize Payout Tracker hardening
 * (RCCF-PRIZE-PAYOUT-FIX-01).
 *
 * Same pattern as the Tie-Breaker harness: embedded PostgreSQL
 * (multi-backend: true concurrent connections) with the minimal faithful
 * subset of the production schema, plus the ACTUAL shipped SQL extracted
 * verbatim from the migration files (so the tested SQL is byte-identical
 * to what the owner applies through the SQL Editor).
 *
 * Subset mapping:
 * - profiles / organizations (+timezone + IANA CHECK) /
 *   organization_members / tools / tool_entitlements: production shape
 *   (created_by points at profiles here — vanilla Postgres has no
 *   auth.users; production points at auth.users).
 * - payout_trackers / payout_recipients /
 *   payout_tracker_monthly_publishes: production columns verbatim
 *   (20251103000001), minus RLS policies (tests connect as the cluster
 *   superuser — RLS text is covered by static migration tests).
 * - transition guard + publish/refresh/rotate RPCs: extracted verbatim
 *   from 20251103000001_payout_tracker_core.sql.
 * - F1/F2/F3/F4 hardening (guards, create RPC, day-granular share):
 *   the whole 20251104000001_payout_tracker_hardening.sql file, applied
 *   verbatim (it is self-contained given the tables above).
 * - F7 SQLSTATE compatibility: the whole
 *   20251105000001_payout_tracker_sqlstate.sql file, applied verbatim
 *   (re-issues every raising function with valid five-character codes,
 *   semantics unchanged).
 */
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { default as EmbeddedPostgres } from "embedded-postgres";
import { Pool, type PoolClient } from "pg";
import { killPortListener, withTimeout } from "./pg-harness";
import { extractSqlBlock } from "./tie-breaker-pg-harness";

const TIMEZONE_MIGRATION = "supabase/migrations/20251026000001_organization_timezone.sql";
const HANDLE_UPDATED_AT_MIGRATION = "supabase/migrations/20250930000001_initial_schema.sql";
const CORE_MIGRATION = "supabase/migrations/20251103000001_payout_tracker_core.sql";
const HARDENING_MIGRATION = "supabase/migrations/20251104000001_payout_tracker_hardening.sql";
const SQLSTATE_MIGRATION = "supabase/migrations/20251105000001_payout_tracker_sqlstate.sql";

const SCHEMA_SQL = `
create extension if not exists "pgcrypto";

-- Supabase-predefined roles referenced by GRANT/REVOKE in migrations.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin; end if;
end $$;

create table public.profiles (
  id uuid primary key
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
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

-- Production columns verbatim (created_by points at profiles: no auth schema here).
create table public.payout_trackers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references public.profiles(id) on delete restrict,
  event_name text not null check (char_length(event_name) between 1 and 80),
  currency text not null check (currency in ('INR', 'USD', 'EUR', 'GBP')),
  deadline timestamptz,
  status text not null default 'draft' check (status in ('draft', 'published', 'completed')),
  share_token uuid not null unique default gen_random_uuid(),
  published_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_trackers_published_at_check check (
    (status in ('published', 'completed') and published_at is not null)
    or (status = 'draft')
  ),
  constraint payout_trackers_completed_at_check check (
    (status = 'completed' and completed_at is not null)
    or (status <> 'completed' and completed_at is null)
  )
);

create table public.payout_recipients (
  id uuid primary key default gen_random_uuid(),
  tracker_id uuid not null references public.payout_trackers(id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 1 and 60),
  amount_minor bigint not null check (amount_minor > 0 and amount_minor <= 100000000000),
  status text not null default 'pending' check (status in ('pending', 'paid')),
  paid_at timestamptz,
  reference_last4 text check (reference_last4 is null or reference_last4 ~ '^[A-Za-z0-9]{4}$'),
  proof_url text check (proof_url is null or (char_length(proof_url) <= 500 and proof_url like 'https://%')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payout_recipients_paid_at_check check (
    (status = 'paid' and paid_at is not null)
    or (status = 'pending' and paid_at is null)
  )
);

create table public.payout_tracker_monthly_publishes (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  month_key text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  tracker_id uuid not null,
  consumed_at timestamptz not null default now(),
  constraint payout_tracker_monthly_publishes_pkey primary key (organization_id, month_key, tracker_id)
);
`;

export interface TestPostgres {
  pool: Pool;
  newPool: (max?: number) => Pool;
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

export async function startPayoutTrackerTestPostgres(): Promise<TestPostgres> {
  const dataDir = mkdtempSync(join(tmpdir(), "micronest-po-test-"));
  let pg: { stop: () => Promise<void> } | null = null;
  let port = 0;
  let lastError: unknown = null;
  for (let p = 54371; p <= 54375; p++) {
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
    const baseMigration = readFileSync(join(process.cwd(), HANDLE_UPDATED_AT_MIGRATION), "utf8");
    const coreMigration = readFileSync(join(process.cwd(), CORE_MIGRATION), "utf8");
    const hardeningMigration = readFileSync(join(process.cwd(), HARDENING_MIGRATION), "utf8");
    const sqlstateMigration = readFileSync(join(process.cwd(), SQLSTATE_MIGRATION), "utf8");
    // IANA validator must exist before the organizations CHECK references it.
    await admin.query(
      extractSqlBlock(tzMigration, "create or replace function public.is_valid_iana_timezone(", "$$;"),
    );
    await admin.query(
      extractSqlBlock(baseMigration, "create or replace function public.handle_updated_at()", "$$;"),
    );
    await admin.query(SCHEMA_SQL);
    await admin.query(
      "grant execute on function public.is_valid_iana_timezone(text) to authenticated, service_role, anon",
    );
    // updated_at triggers (shipped core definitions).
    await admin.query(
      extractSqlBlock(
        coreMigration,
        "drop trigger if exists payout_trackers_updated_at on public.payout_trackers;",
        "for each row execute function public.handle_updated_at();",
      ),
    );
    await admin.query(
      extractSqlBlock(
        coreMigration,
        "drop trigger if exists payout_recipients_updated_at on public.payout_recipients;",
        "for each row execute function public.handle_updated_at();",
      ),
    );
    // Transition guard (shipped core definition; the hardening migration adds
    // the INSERT + recipient guards alongside it).
    await admin.query(
      extractSqlBlock(
        coreMigration,
        "create or replace function public.payout_tracker_require_authorized_transition()",
        "for each row execute function public.payout_tracker_require_authorized_transition();",
      ),
    );
    // Publish / refresh / rotate RPCs (shipped core definitions).
    await admin.query(
      extractSqlBlock(
        coreMigration,
        "create or replace function public.consume_payout_tracker_publish(",
        "grant execute on function public.consume_payout_tracker_publish(uuid, uuid, uuid) to service_role;",
      ),
    );
    await admin.query(
      extractSqlBlock(
        coreMigration,
        "create or replace function public.refresh_payout_tracker_status(",
        "grant execute on function public.refresh_payout_tracker_status(uuid, uuid, uuid) to service_role;",
      ),
    );
    await admin.query(
      extractSqlBlock(
        coreMigration,
        "create or replace function public.rotate_payout_tracker_token(",
        "grant execute on function public.rotate_payout_tracker_token(uuid, uuid, uuid) to service_role;",
      ),
    );
    // Hardening migration verbatim: F1/F2 guards, marked apply RPC, atomic
    // create RPC, day-granular share RPC.
    await admin.query(hardeningMigration);
    // SQLSTATE compatibility verbatim: every raising function re-issued
    // with valid five-character codes (semantics unchanged).
    await admin.query(sqlstateMigration);
    await admin.query(
      "insert into public.tools (slug, name) values ('payout-tracker', 'Prize Payout Tracker') on conflict (slug) do nothing",
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
    await killPortListener(port).catch(() => undefined);
    try {
      rmSync(dataDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
    for (let p = 54371; p <= 54375; p++) {
      try {
        rmSync(`${dataDir}-${p}`, { recursive: true, force: true });
      } catch {
        // best effort
      }
    }
  };
  return {
    pool,
    newPool: (max = 5) => new Pool({ ...baseConfig, max }),
    query,
    stop,
  };
}

/** Remove all tenant rows between tests (tool catalog + functions retained). */
export async function truncatePayoutTrackerTables(pg: Pick<TestPostgres, "query">): Promise<void> {
  await pg.query(
    "truncate public.payout_tracker_monthly_publishes, public.payout_recipients, public.payout_trackers, public.tool_entitlements, public.organization_members, public.organizations, public.profiles restart identity cascade",
  );
}

export interface PayoutTrackerSeed {
  userId: string;
  orgId: string;
  toolId: string;
}

export async function seedPayoutTrackerWorkspace(
  pg: Pick<TestPostgres, "query">,
  opts: { timezone?: string; grant?: "free" | "paid" | "all-access" | null } = {},
): Promise<PayoutTrackerSeed> {
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await pg.query("insert into public.profiles (id) values ($1)", [userId]);
  await pg.query("insert into public.organizations (id, name, timezone) values ($1, 'Org', $2)", [
    orgId,
    opts.timezone ?? "Asia/Kolkata",
  ]);
  await pg.query("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')", [
    orgId,
    userId,
  ]);
  const tool = await pg.query("select id from public.tools where slug = 'payout-tracker'");
  const toolId = String(tool.rows[0]?.id ?? "");
  const grant = opts.grant === undefined ? "free" : opts.grant;
  if (grant === "all-access") {
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, null, true, 'subscription', null)",
      [orgId],
    );
  } else if (grant !== null) {
    const source = grant === "free" ? "free" : "subscription";
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, $2, false, $3, null)",
      [orgId, toolId, source],
    );
  }
  return { userId, orgId, toolId };
}

export async function insertDraftTracker(
  pg: Pick<TestPostgres, "query">,
  seed: PayoutTrackerSeed,
  eventName = "Monsoon Cup",
): Promise<string> {
  const id = crypto.randomUUID();
  await pg.query(
    "insert into public.payout_trackers (id, organization_id, created_by, event_name, currency) values ($1, $2, $3, $4, 'INR')",
    [id, seed.orgId, seed.userId, eventName],
  );
  return id;
}

export type { PoolClient };
