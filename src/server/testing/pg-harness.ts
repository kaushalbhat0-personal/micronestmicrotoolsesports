/**
 * Real-Postgres integration harness (FIX-06 H3).
 *
 * Spins up an embedded PostgreSQL server (multi-backend: true concurrent
 * connections, unlike in-process mocks) and builds the minimal faithful
 * subset of the production schema needed by consume_free_check, then applies
 * the ACTUAL shipped function definition extracted from the migration file
 * (so the tested SQL is byte-identical to what the owner applies).
 *
 * Subset mapping (columns mirror the real migrations):
 * - profiles: standalone id PK (prod references auth.users; auth schema does
 *   not exist locally — FK targets are local, behavior identical for our RPC)
 * - organizations/organization_members/tools/tool_entitlements:
 *   20250930000001_initial_schema.sql (owner/member/grant columns + checks)
 * - user_tool_entitlements: ..._grants.sql + 'free' CHECK (20251023000001)
 * - sponsor_campaigns/connected_channels/scans + scans_campaign_active_unique:
 *   20251001000001_sponsor_sentinel_core.sql + 20251005000001_scan_concurrency_lock.sql
 * - consume_free_check + grants: extracted from the FIX-06 migration file.
 *
 * Not created (RPC never touches them): plans/orders/payments/deliverables/
 * evidence/evaluations/webhook_events, RLS policies (tests connect as the
 * cluster superuser — equivalent to service_role bypass for these tables).
 *
 * Embedded PostgreSQL here is v18; production is v15. Advisory locks,
 * plpgsql, partial unique indexes, and timestamptz semantics used by the RPC
 * are identical across these versions.
 */
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { default as EmbeddedPostgres } from "embedded-postgres";
import { Pool, type PoolClient } from "pg";

const MIGRATION_FILE = "supabase/migrations/20251025000001_sponsorship_free_check_consumption.sql";

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
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
  source text not null default 'subscription' check (source in ('subscription','manual','promo')),
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

create table public.sponsor_campaigns (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 120),
  status text not null default 'draft' check (status in ('draft','active','completed','archived')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null default now() + interval '30 days',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.connected_channels (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  platform text not null default 'twitch' check (platform in ('twitch','youtube','kick')),
  external_channel_id text not null default 'ext-1',
  external_handle text not null default 'handle',
  connection_status text not null default 'connected' check (connection_status in ('connected','disconnected','expired','revoked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  campaign_id uuid not null references public.sponsor_campaigns(id) on delete restrict,
  platform text not null check (platform in ('twitch','youtube','kick')),
  status text not null check (status in ('pending','running','success','failed','partial')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  scanner_version text not null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now()
);
create unique index if not exists scans_campaign_active_unique
  on public.scans (campaign_id) where status in ('pending', 'running');
create index if not exists scans_org_started_idx on public.scans (organization_id, started_at);
`;

/** Extract the shipped consume_free_check definition (function + grants) verbatim. */
export function extractConsumeFunction(migrationSql: string): string {
  const start = migrationSql.indexOf("create or replace function public.consume_free_check(");
  if (start < 0) throw new Error("consume_free_check definition not found in migration");
  const grantMarker = "to service_role;";
  const end = migrationSql.indexOf(grantMarker, start);
  if (end < 0) throw new Error("service_role grant not found in migration");
  return migrationSql.slice(start, end + grantMarker.length);
}

export interface TestPostgres {
  pool: Pool;
  newPool: () => Pool;
  query: (text: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>>; rowCount: number | null }>;
  stop: () => Promise<void>;
}

/**
 * Race a promise against a timer so `afterAll(stop)` can never hang the
 * vitest run forever. The underlying operation keeps running in the
 * background; `killPortListener` below cleans up anything it leaves behind.
 */
export async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms);
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Best-effort killer for orphaned embedded-postgres backends.
 *
 * On Windows, `postgres.exe --forkchild` workers can outlive the vitest
 * worker that spawned them. They inherit stdio, so a shelled-out run
 * (`npx vitest run | Select-Object ...`) never sees EOF and the prompt
 * never returns — the "tests pass but the terminal keeps looping" hang.
 * Only ever targets test-only ports / embedded-postgres binaries, never a
 * developer's real PostgreSQL.
 */
export async function killPortListener(port: number): Promise<void> {
  if (process.platform === "win32") {
    const out = await execFileAsync("netstat", ["-ano", "-p", "TCP"], 10_000);
    const pids = new Set<string>();
    for (const line of out.split("\n")) {
      // e.g. "  TCP    127.0.0.1:54371    0.0.0.0:0    LISTENING    1234"
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4 || parts[0]?.toUpperCase() !== "TCP" || parts[3]?.toUpperCase() !== "LISTENING") {
        continue;
      }
      const local = parts[1] ?? "";
      const idx = local.lastIndexOf(":");
      if (idx < 0 || Number(local.slice(idx + 1)) !== port) continue;
      const pid = parts[parts.length - 1] ?? "";
      if (/^\d+$/.test(pid) && Number(pid) !== process.pid) pids.add(pid);
    }
    // /T kills the whole tree: taskkilling a postmaster alone orphans its
    // --forkchild workers, which is exactly how the pipe-holders survive.
    for (const pid of pids) await killPidTree(pid);
    // Second sweep: non-listening leftovers (children of an already-dead
    // postmaster). Scoped to embedded-postgres binaries only.
    await killEmbeddedPostgresOrphans();
    return;
  }
  await execFileAsync("sh", ["-c", `lsof -ti tcp:${port} | xargs -r kill -9`], 10_000);
}

async function execFileAsync(file: string, args: string[], timeoutMs: number): Promise<string> {
  return new Promise<string>((resolve) => {
    execFile(file, args, { timeout: timeoutMs }, (err, stdout) => resolve(err ? "" : String(stdout ?? "")));
  });
}

async function killPidTree(pid: string): Promise<void> {
  await execFileAsync("taskkill", ["/F", "/T", "/PID", pid], 10_000);
}

async function killEmbeddedPostgresOrphans(): Promise<void> {
  // Only true orphans: embedded-postgres processes whose parent is already
  // dead. The live set covers ALL processes (not just postgres) — a live
  // postmaster's parent is the vitest worker, and live servers (and their
  // children) of concurrently-running test files are always spared.
  const ps = `$live = @{}; Get-CimInstance Win32_Process | ForEach-Object { $live[$_.ProcessId] = $true }; Get-CimInstance Win32_Process -Filter "Name='postgres.exe'" | Where-Object { $_.CommandLine -like '*embedded-postgres*' -and -not $live.ContainsKey($_.ParentProcessId) } | ForEach-Object { $_.ProcessId }`;
  const encoded = Buffer.from(ps, "utf16le").toString("base64");
  const out = await execFileAsync(
    "powershell",
    ["-NoProfile", "-NonInteractive", "-EncodedCommand", encoded],
    30_000,
  );
  const pids = new Set(
    out
      .split(/[\r\n\s,;]+/)
      .map((s) => s.trim())
      .filter((s) => /^\d+$/.test(s) && Number(s) !== process.pid),
  );
  for (const pid of pids) await killPidTree(pid);
}

async function tryStart(port: number, databaseDir: string) {
  const pg = new EmbeddedPostgres({
    port,
    user: "postgres",
    password: "postgres",
    databaseDir,
    persistent: false,
    // Force UTF8: host Windows locales otherwise produce WIN1252 clusters
    // that reject the UTF-8 punctuation used in SQL comments.
    initdbFlags: ["-E", "UTF8", "--locale=C"],
    onLog: () => undefined,
    onError: () => undefined,
  } as unknown as Record<string, unknown>);
  await (pg as unknown as { initialise: () => Promise<void> }).initialise();
  await (pg as unknown as { start: () => Promise<void> }).start();
  return pg as unknown as { stop: () => Promise<void> };
}

export async function startTestPostgres(): Promise<TestPostgres> {
  const dataDir = mkdtempSync(join(tmpdir(), "micronest-pg-test-"));
  let pg: { stop: () => Promise<void> } | null = null;
  let port = 0;
  let lastError: unknown = null;
  for (let p = 54331; p <= 54345; p++) {
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
    await admin.query(SCHEMA_SQL);
    const migrationSql = readFileSync(join(process.cwd(), MIGRATION_FILE), "utf8");
    await admin.query(extractConsumeFunction(migrationSql));
    await admin.query(
      "insert into public.tools (slug, name) values ('sponsor-sentinel', 'Sponsor Sentinel') on conflict (slug) do nothing",
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
    for (let p = 54331; p <= 54345; p++) {
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

/** Remove all tenant rows between tests (tools catalog + function retained). */
export async function truncateTenantTables(pg: Pick<TestPostgres, "query">): Promise<void> {
  await pg.query(
    "truncate public.scans, public.connected_channels, public.sponsor_campaigns, public.user_tool_entitlements, public.tool_entitlements, public.organization_members, public.organizations, public.profiles restart identity cascade",
  );
}

export interface Seed {
  userId: string;
  orgId: string;
  campaignId: string;
  channelId: string;
  toolId: string;
}

export async function seedFreeWorkspace(
  pg: Pick<TestPostgres, "query">,
  opts: { grantSource?: string; grantExpiresAt?: string | null; orgGrant?: boolean } = {},
): Promise<Seed> {
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  const campaignId = crypto.randomUUID();
  const channelId = crypto.randomUUID();
  await pg.query("insert into public.profiles (id) values ($1)", [userId]);
  await pg.query("insert into public.organizations (id, name, slug, owner_id) values ($1, 'Org', $2, $3)", [
    orgId,
    `org-${orgId.slice(0, 8)}`,
    userId,
  ]);
  await pg.query("insert into public.organization_members (organization_id, user_id, role) values ($1, $2, 'owner')", [
    orgId,
    userId,
  ]);
  const tool = await pg.query("select id from public.tools where slug = 'sponsor-sentinel'");
  const toolId = String(tool.rows[0]?.id ?? "");
  const source = opts.grantSource ?? "free";
  const expires = opts.grantExpiresAt === undefined ? null : opts.grantExpiresAt;
  await pg.query("insert into public.user_tool_entitlements (user_id, tool_id, source, expires_at) values ($1, $2, $3, $4)", [
    userId,
    toolId,
    source,
    expires,
  ]);
  if (opts.orgGrant) {
    await pg.query(
      "insert into public.tool_entitlements (organization_id, tool_id, is_all_access, source, expires_at) values ($1, $2, false, 'subscription', null)",
      [orgId, toolId],
    );
  }
  await pg.query("insert into public.sponsor_campaigns (id, organization_id, name, status) values ($1, $2, 'Camp', 'active')", [
    campaignId,
    orgId,
  ]);
  await pg.query("insert into public.connected_channels (id, organization_id, connection_status) values ($1, $2, 'connected')", [
    channelId,
    orgId,
  ]);
  return { userId, orgId, campaignId, channelId, toolId };
}

export type { PoolClient };
