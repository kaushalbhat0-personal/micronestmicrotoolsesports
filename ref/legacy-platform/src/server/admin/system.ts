import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export interface MetricResult {
  count: number | null;
  error?: string;
}

export interface SystemOverview {
  scheduledJobs: number; // derived from vercel.json static config
  webhookEvents: MetricResult;
  failedWebhooks: MetricResult;
  providerConfigs: MetricResult;
  activeTools: MetricResult;
  activePlans: MetricResult;
}

export interface CronJobInfo {
  path: string;
  schedule: string;
  purpose: string;
  status: string;
  observedActivity: string | null;
  observedActivityError?: string | undefined;
}

export interface WebhookSummary {
  total: MetricResult;
  pending: MetricResult;
  processing: MetricResult;
  succeeded: MetricResult;
  failed: MetricResult;
}

export interface WebhookEventItem {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string | null;
  status: string | null;
  processed: boolean | null;
  organizationId: string | null;
  organizationName: string | null;
  receivedAt: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface ProviderConfigItem {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  provider: string;
  lastTestedAt: string | null;
  lastTestStatus: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProviderConfigSummary {
  byProvider: Array<{ provider: string; count: number }>;
  total: number | null;
  error?: string;
}

export interface HealthResult {
  status: "ok" | "unavailable";
  service?: string;
  timestamp?: string;
  error?: string;
}

export interface ToolsSummary {
  total: MetricResult;
  active: MetricResult;
  inactive: MetricResult;
}

export interface PlansSummary {
  total: MetricResult;
  active: MetricResult;
  monthly: MetricResult;
  yearly: MetricResult;
}

export interface RecentAuditEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  organization_id: string | null;
  actor_user_id: string;
  created_at: string;
}

export interface FailureItem {
  id: string;
  kind: "webhook" | "scan";
  providerOrPlatform: string;
  status: string;
  errorCode: string | null;
  createdAt: string;
  organizationName?: string;
}

export interface AdminSystemResult {
  overview: SystemOverview;
  cronJobs: CronJobInfo[];
  webhookSummary: WebhookSummary;
  webhookEvents: WebhookEventItem[];
  webhookTotal: number | null;
  webhookTotalError?: string | undefined;
  webhookPage: number;
  webhookPageSize: number;
  webhookHasMore: boolean;
  providerConfigs: ProviderConfigItem[];
  providerConfigSummary: ProviderConfigSummary;
  providerConfigTotal: number | null;
  providerConfigTotalError?: string | undefined;
  providerConfigPage: number;
  providerConfigPageSize: number;
  providerConfigHasMore: boolean;
  health: HealthResult;
  tools: ToolsSummary;
  plans: PlansSummary;
  recentActivity: RecentAuditEntry[] | null;
  recentActivityError?: string | undefined;
  failures: FailureItem[];
  failuresError?: string | undefined;
  // filter state
  webhookStatus: string;
  webhookProvider: string;
  providerFilter: string;
  webhookQuery: string;
  providerQuery: string;
  page: number; // unified? we keep separate webhook page but also provider page
  // For URL building
  query: string;
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const MAX_QUERY_LEN = 100;

const CRON_JOBS: Array<{ path: string; schedule: string; purpose: string }> = [
  { path: "/api/cron/sentinel-scan", schedule: "0 6 * * *", purpose: "Scans active campaigns across Twitch/YouTube/Kick" },
  { path: "/api/cron/sentinel-retention", schedule: "0 4 * * *", purpose: "Retention cleanup (90d scans/evidence/evaluations, 30d webhooks) + subscription reconciliation" },
];

// For backwards compat the old /api/cron/subscriptions route still exists but is NOT in vercel.json
// We document it as available but not scheduled.

function parseParams(searchParams: Record<string, string | string[] | undefined>) {
  const get = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
  };
  const q = get("q").trim().slice(0, MAX_QUERY_LEN);
  const webhookQuery = get("webhook_q").trim().slice(0, MAX_QUERY_LEN) || q;
  const providerQuery = get("provider_q").trim().slice(0, MAX_QUERY_LEN) || "";
  const webhookStatus = get("status").trim().toLowerCase();
  const webhookProvider = get("provider").trim().toLowerCase();
  const providerFilter = get("provider_filter").trim().toLowerCase();
  let page = parseInt(get("page") || "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 1000) page = 1000;
  // Separate pages for webhooks vs provider configs — use same page for simplicity but allow provider_page
  let providerPage = parseInt(get("provider_page") || String(page), 10);
  if (!Number.isFinite(providerPage) || providerPage < 1) providerPage = 1;
  if (providerPage > 1000) providerPage = 1000;
  return { q, webhookQuery, providerQuery, webhookStatus, webhookProvider, providerFilter, page, providerPage, pageSize: PAGE_SIZE };
}

function formatLike(q: string): string {
  return `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

// ─────────────────────────────────────────────────────────────
// Service
// ─────────────────────────────────────────────────────────────

/**
 * Read-only system observability for Super Admin — no mutations, no external provider calls.
 * Every privileged read is gated by requireSuperAdmin() before createAdminClient().
 */
export async function getAdminSystem(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<AdminSystemResult> {
  await requireSuperAdmin();
  const { q, webhookQuery, providerQuery, webhookStatus, webhookProvider, providerFilter, page, providerPage, pageSize } =
    parseParams(searchParams);
  const admin = createAdminClient();

  // ── Overview ──
  const overview: SystemOverview = {
    scheduledJobs: CRON_JOBS.length,
    webhookEvents: { count: null },
    failedWebhooks: { count: null },
    providerConfigs: { count: null },
    activeTools: { count: null },
    activePlans: { count: null },
  };

  try {
    const { count, error } = await admin.from("webhook_events").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.webhookEvents = { count: count ?? 0 };
  } catch {
    overview.webhookEvents = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", "failed");
    if (error) throw error;
    overview.failedWebhooks = { count: count ?? 0 };
  } catch {
    overview.failedWebhooks = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("organization_provider_credentials").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.providerConfigs = { count: count ?? 0 };
  } catch {
    overview.providerConfigs = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("tools").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (error) throw error;
    overview.activeTools = { count: count ?? 0 };
  } catch {
    overview.activeTools = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("plans").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (error) throw error;
    overview.activePlans = { count: count ?? 0 };
  } catch {
    overview.activePlans = { count: null, error: "Unavailable" };
  }

  // ── Cron jobs — configured + observed activity ──
  const cronJobs: CronJobInfo[] = [];
  // Observed scan activity — latest scan started_at
  let latestScanAt: string | null = null;
  let scanObsError: string | undefined;
  try {
    const { data } = await admin.from("scans").select("started_at").order("started_at", { ascending: false }).limit(1);
    const row = (data as Array<{ started_at: string }> | null)?.[0];
    if (row) latestScanAt = row.started_at;
  } catch {
    scanObsError = "Unavailable";
  }
  // Observed retention — no persisted run history; we can only show latest webhook deletions? But we state not persisted.

  for (const job of CRON_JOBS) {
    const isScan = job.path === "/api/cron/sentinel-scan";
    cronJobs.push({
      path: job.path,
      schedule: job.schedule,
      purpose: job.purpose,
      status: "Configured — no persisted run history",
      observedActivity: isScan ? (scanObsError ? null : latestScanAt) : null,
      observedActivityError: isScan ? scanObsError : undefined,
    });
  }

  // ── Webhook summary (counts by status) ──
  const webhookSummary: WebhookSummary = {
    total: { count: null },
    pending: { count: null },
    processing: { count: null },
    succeeded: { count: null },
    failed: { count: null },
  };
  try {
    const { count, error } = await admin.from("webhook_events").select("id", { count: "exact", head: true });
    if (error) throw error;
    webhookSummary.total = { count: count ?? 0 };
  } catch {
    webhookSummary.total = { count: null, error: "Unavailable" };
  }
  for (const s of ["pending", "processing", "succeeded", "failed"] as const) {
    try {
      const { count, error } = await admin.from("webhook_events").select("id", { count: "exact", head: true }).eq("status", s);
      if (error) throw error;
      webhookSummary[s] = { count: count ?? 0 };
    } catch {
      webhookSummary[s] = { count: null, error: "Unavailable" };
    }
  }

  // ── Webhook events table (paginated, filtered) ──
  const webhookValidStatus = ["pending", "processing", "succeeded", "failed"].includes(webhookStatus) ? webhookStatus : "";
  const webhookValidProvider = ["stripe", "razorpay", "twitch", "discord", "youtube", "kick"].includes(webhookProvider)
    ? webhookProvider
    : "";
  const webhookFrom = (page - 1) * pageSize;
  const webhookTo = webhookFrom + pageSize - 1;

  let webhookTotal: number | null = null;
  let webhookTotalError: string | undefined;
  let webhookEvents: WebhookEventItem[] = [];
  let webhookHasMore = false;

  try {
    let countQ = admin.from("webhook_events").select("id", { count: "exact", head: true }) as unknown as never;
    if (webhookQuery) {
      const like = formatLike(webhookQuery);
      countQ = (countQ as never as { or: (s: string) => never }).or(`provider_event_id.ilike.${like},external_event_id.ilike.${like},event_type.ilike.${like}`) as never;
    }
    if (webhookValidStatus) countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("status", webhookValidStatus) as never;
    if (webhookValidProvider) countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("provider", webhookValidProvider) as never;
    const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
      count: number | null;
      error: unknown;
    };
    if (error) throw error;
    webhookTotal = count ?? 0;
  } catch {
    webhookTotalError = "Unable to load webhook events.";
  }

  try {
    let dataQ = admin
      .from("webhook_events")
      .select("id, provider, provider_event_id, event_type, status, processed, organization_id, received_at, processed_at, created_at")
      .order("created_at", { ascending: false })
      .range(webhookFrom, webhookTo) as unknown as never;
    if (webhookQuery) {
      const like = formatLike(webhookQuery);
      dataQ = (dataQ as never as { or: (s: string) => never }).or(`provider_event_id.ilike.${like},external_event_id.ilike.${like},event_type.ilike.${like}`) as never;
    }
    if (webhookValidStatus) dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("status", webhookValidStatus) as never;
    if (webhookValidProvider) dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("provider", webhookValidProvider) as never;

    const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
      data:
        | Array<{
            id: string;
            provider: string;
            provider_event_id: string;
            event_type: string | null;
            status: string | null;
            processed: boolean | null;
            organization_id: string | null;
            received_at: string | null;
            processed_at: string | null;
            created_at: string;
          }>
        | null;
      error: unknown;
    };
    if (error) throw error;
    const rows = data ?? [];
    // No per-row org lookup — batch if needed? webhook_events currently not showing org name in detail but we fetch safely.
    // For system view, we optionally batch lookup org names for rows that have organization_id
    const orgIds = [...new Set(rows.map((r) => r.organization_id).filter((v): v is string => Boolean(v)))];
    const orgMap = new Map<string, string>();
    if (orgIds.length > 0) {
      const { data: orgData } = await admin.from("organizations").select("id, name").in("id", orgIds);
      for (const o of ((orgData ?? []) as Array<{ id: string; name: string }>)) orgMap.set(o.id, o.name);
    }
    webhookEvents = rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      providerEventId: r.provider_event_id,
      eventType: r.event_type,
      status: r.status,
      processed: r.processed,
      organizationId: r.organization_id,
      organizationName: r.organization_id ? (orgMap.get(r.organization_id) ?? null) : null,
      receivedAt: r.received_at,
      processedAt: r.processed_at,
      createdAt: r.created_at,
    }));
  } catch {
    if (webhookEvents.length === 0 && !webhookTotalError) webhookTotalError = "Unable to load webhook events.";
  }
  webhookHasMore = webhookTotal !== null ? webhookFrom + pageSize < webhookTotal : webhookEvents.length === pageSize;

  // ── Provider configs ──
  const providerValid = ["twitch", "youtube", "kick"].includes(providerFilter) ? providerFilter : "";
  const providerFrom = (providerPage - 1) * pageSize;
  const providerTo = providerFrom + pageSize - 1;

  let providerConfigTotal: number | null = null;
  let providerConfigTotalError: string | undefined;
  let providerConfigs: ProviderConfigItem[] = [];
  let providerConfigHasMore = false;
  let providerConfigSummary: ProviderConfigSummary = { byProvider: [], total: null };

  // Summary by provider — use counts per provider
  try {
    const byProvider: Array<{ provider: string; count: number }> = [];
    for (const p of ["twitch", "youtube", "kick"] as const) {
      try {
        const { count, error } = await admin.from("organization_provider_credentials").select("id", { count: "exact", head: true }).eq("provider", p);
        if (error) throw error;
        byProvider.push({ provider: p, count: count ?? 0 });
      } catch {
        byProvider.push({ provider: p, count: 0 });
      }
    }
    // Total
    try {
      const { count, error } = await admin.from("organization_provider_credentials").select("id", { count: "exact", head: true });
      if (error) throw error;
      providerConfigSummary = { byProvider, total: count ?? 0 };
    } catch {
      providerConfigSummary = { byProvider, total: null, error: "Unavailable" };
    }
  } catch {
    providerConfigSummary = { byProvider: [], total: null, error: "Unavailable" };
  }

  // For provider search, we need to resolve org ids if providerQuery present
  let providerOrgIds: string[] | null = null;
  if (providerQuery) {
    const like = formatLike(providerQuery);
    const { data } = await admin.from("organizations").select("id").or(`name.ilike.${like},slug.ilike.${like}`).limit(200);
    const ids = ((data ?? []) as Array<{ id: string }>).map((o) => o.id);
    if (ids.length === 0) {
      providerConfigTotal = 0;
      providerConfigs = [];
      providerConfigHasMore = false;
    } else {
      providerOrgIds = ids;
    }
  }

  if (!(providerQuery && providerOrgIds !== null && providerOrgIds.length === 0)) {
    try {
      let countQ = admin.from("organization_provider_credentials").select("id", { count: "exact", head: true }) as unknown as never;
      if (providerValid) countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("provider", providerValid) as never;
      if (providerOrgIds) countQ = (countQ as never as { in: (c: string, v: string[]) => never }).in("organization_id", providerOrgIds) as never;
      const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
        count: number | null;
        error: unknown;
      };
      if (error) throw error;
      providerConfigTotal = count ?? 0;
    } catch {
      providerConfigTotalError = "Unable to load provider configurations.";
    }

    try {
      // Safe column selection — never select encrypted_* 
      let dataQ = admin
        .from("organization_provider_credentials")
        .select("id, organization_id, provider, last_tested_at, last_test_status, created_at, updated_at")
        .order("created_at", { ascending: false })
        .range(providerFrom, providerTo) as unknown as never;
      if (providerValid) dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("provider", providerValid) as never;
      if (providerOrgIds) dataQ = (dataQ as never as { in: (c: string, v: string[]) => never }).in("organization_id", providerOrgIds) as never;

      const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
        data:
          | Array<{
              id: string;
              organization_id: string;
              provider: string;
              last_tested_at: string | null;
              last_test_status: string | null;
              created_at: string;
              updated_at: string;
            }>
          | null;
        error: unknown;
      };
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length > 0) {
        const orgIds2 = [...new Set(rows.map((r) => r.organization_id))];
        const { data: orgData } = await admin.from("organizations").select("id, name, slug").in("id", orgIds2);
        const orgMap2 = new Map<string, { name: string; slug: string }>();
        for (const o of ((orgData ?? []) as Array<{ id: string; name: string; slug: string }>)) orgMap2.set(o.id, { name: o.name, slug: o.slug });
        providerConfigs = rows.map((r) => ({
          id: r.id,
          organizationId: r.organization_id,
          organizationName: orgMap2.get(r.organization_id)?.name ?? "Unknown",
          organizationSlug: orgMap2.get(r.organization_id)?.slug ?? "—",
          provider: r.provider,
          lastTestedAt: r.last_tested_at,
          lastTestStatus: r.last_test_status,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }
    } catch {
      if (providerConfigs.length === 0 && !providerConfigTotalError) providerConfigTotalError = "Unable to load provider configurations.";
    }
    providerConfigHasMore = providerConfigTotal !== null ? providerFrom + pageSize < providerConfigTotal : providerConfigs.length === pageSize;
  }

  // ── Health — server-side fetch to /api/health (safe GET, no payload exposure) ──
  // We do NOT call external providers. We only try to derive health via local route if available.
  // Since this is server-side, we cannot rely on absolute URL; we treat health as unavailable unless we can safely determine.
  // Minimal safe probe: return unavailable by default, but try to interpret via env if possible? No env enumeration.
  // We will attempt to fetch health via internal URL if NEXT_PUBLIC_SITE_URL or VERCEL_URL is available, but only safe projection.
  const health: HealthResult = { status: "unavailable", error: "Health probe not available" };
  // Try relative fetch via fetch if we can construct URL from headers origin — but in server component we have no request URL.
  // Safer: attempt to return static "ok" based on the endpoint existence documented? Instead we explain unavailable gracefully.
  // To avoid external fetch complexity, we leave as unavailable with explanation; the endpoint exists at /api/health returning {status:"ok"}.

  // ── Tools summary ──
  const toolsSummary: ToolsSummary = { total: { count: null }, active: { count: null }, inactive: { count: null } };
  try {
    const { count, error } = await admin.from("tools").select("id", { count: "exact", head: true });
    if (error) throw error;
    toolsSummary.total = { count: count ?? 0 };
  } catch {
    toolsSummary.total = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("tools").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (error) throw error;
    toolsSummary.active = { count: count ?? 0 };
  } catch {
    toolsSummary.active = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("tools").select("id", { count: "exact", head: true }).eq("is_active", false);
    if (error) throw error;
    toolsSummary.inactive = { count: count ?? 0 };
  } catch {
    toolsSummary.inactive = { count: null, error: "Unavailable" };
  }

  // ── Plans summary ──
  const plansSummary: PlansSummary = {
    total: { count: null },
    active: { count: null },
    monthly: { count: null },
    yearly: { count: null },
  };
  try {
    const { count, error } = await admin.from("plans").select("id", { count: "exact", head: true });
    if (error) throw error;
    plansSummary.total = { count: count ?? 0 };
  } catch {
    plansSummary.total = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("plans").select("id", { count: "exact", head: true }).eq("is_active", true);
    if (error) throw error;
    plansSummary.active = { count: count ?? 0 };
  } catch {
    plansSummary.active = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("plans").select("id", { count: "exact", head: true }).eq("billing_period", "monthly");
    if (error) throw error;
    plansSummary.monthly = { count: count ?? 0 };
  } catch {
    plansSummary.monthly = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("plans").select("id", { count: "exact", head: true }).eq("billing_period", "yearly");
    if (error) throw error;
    plansSummary.yearly = { count: count ?? 0 };
  } catch {
    plansSummary.yearly = { count: null, error: "Unavailable" };
  }

  // ── Recent admin activity (10) ──
  let recentActivity: RecentAuditEntry[] | null = null;
  let recentActivityError: string | undefined;
  try {
    const { data, error } = await admin
      .from("admin_audit_logs")
      .select("id, action, target_type, target_id, organization_id, actor_user_id, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    recentActivity = (data as RecentAuditEntry[] | null) ?? [];
  } catch {
    recentActivity = null;
    recentActivityError = "Unable to load activity.";
  }

  // ── Recent failures — failed webhooks + failed scans (10 most recent) ──
  let failures: FailureItem[] = [];
  let failuresError: string | undefined;
  try {
    const [{ data: failedWebhooks }, { data: failedScans }] = await Promise.all([
      admin
        .from("webhook_events")
        .select("id, provider, status, created_at")
        .eq("status", "failed")
        .order("created_at", { ascending: false })
        .limit(5) as unknown as Promise<{ data: Array<{ id: string; provider: string; status: string; created_at: string }> | null }>,
      admin.from("scans").select("id, platform, status, error_code, created_at").eq("status", "failed").order("created_at", { ascending: false }).limit(5) as unknown as Promise<{
        data: Array<{ id: string; platform: string; status: string; error_code: string | null; created_at: string }> | null;
      }>,
    ]);
    const wh = (failedWebhooks ?? []).map((w) => ({
      id: w.id,
      kind: "webhook" as const,
      providerOrPlatform: w.provider,
      status: w.status,
      errorCode: null,
      createdAt: w.created_at,
    }));
    const sc = (failedScans ?? []).map((s) => ({
      id: s.id,
      kind: "scan" as const,
      providerOrPlatform: s.platform,
      status: s.status,
      errorCode: s.error_code,
      createdAt: s.created_at,
    }));
    failures = [...wh, ...sc].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 10);
  } catch {
    failuresError = "Unable to load failures.";
  }

  return {
    overview,
    cronJobs,
    webhookSummary,
    webhookEvents,
    webhookTotal,
    webhookTotalError,
    webhookPage: page,
    webhookPageSize: pageSize,
    webhookHasMore,
    providerConfigs,
    providerConfigSummary,
    providerConfigTotal,
    providerConfigTotalError,
    providerConfigPage: providerPage,
    providerConfigPageSize: pageSize,
    providerConfigHasMore,
    health,
    tools: toolsSummary,
    plans: plansSummary,
    recentActivity,
    recentActivityError,
    failures,
    failuresError,
    webhookStatus: webhookValidStatus,
    webhookProvider: webhookValidProvider,
    providerFilter,
    webhookQuery,
    providerQuery,
    page,
    query: q,
  };
}
