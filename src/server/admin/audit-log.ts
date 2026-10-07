import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

// ─────────────────────────────────────────────────────────────
// Sanitization — before / after are potentially sensitive JSONB
// ─────────────────────────────────────────────────────────────

const FORBIDDEN_SUBSTRINGS = [
  "password",
  "password_hash",
  "access_token",
  "refresh_token",
  "oauth_token",
  "secret",
  "webhook_secret",
  "razorpay_signature",
  "service_role",
  "supabase_service_role_key",
  "api_key",
  "apikey",
  "client_secret",
  "private_key",
  "private",
  "credential",
  "token",
  "cookie",
  "session",
  "hash",
];

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  return FORBIDDEN_SUBSTRINGS.some((f) => lower.includes(f));
}

function sanitizePrimitive(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "string") return value.slice(0, 200) || "—";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return String(value).slice(0, 200);
}

export interface SafeProjectionEntry {
  key: string;
  value: string;
}

export interface SafeProjection {
  entries: SafeProjectionEntry[];
  omitted: number;
  empty: boolean;
}

export function safeAuditProjection(raw: unknown): SafeProjection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    if (raw === null || raw === undefined) return { entries: [], omitted: 0, empty: true };
    // Primitive payload — not expected but handle safely
    return { entries: [{ key: "value", value: sanitizePrimitive(raw) }], omitted: 0, empty: false };
  }
  const rec = raw as Record<string, unknown>;
  const entries: SafeProjectionEntry[] = [];
  let omitted = 0;
  const keys = Object.keys(rec).slice(0, 40);
  for (const k of keys) {
    if (isForbiddenKey(k)) {
      omitted++;
      continue;
    }
    const v = rec[k];
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      // One level deep only — stringify safely, no recursion
      const inner = v as Record<string, unknown>;
      const innerKeys = Object.keys(inner);
      let innerForbidden = false;
      for (const ik of innerKeys) {
        if (isForbiddenKey(ik)) {
          innerForbidden = true;
          break;
        }
      }
      if (innerForbidden) {
        omitted++;
        continue;
      }
      try {
        const s = JSON.stringify(v);
        entries.push({ key: k, value: s.slice(0, 200) });
      } catch {
        omitted++;
      }
    } else if (Array.isArray(v)) {
      try {
        const s = JSON.stringify(v);
        entries.push({ key: k, value: s.slice(0, 200) });
      } catch {
        omitted++;
      }
    } else {
      entries.push({ key: k, value: sanitizePrimitive(v) });
    }
    if (entries.length >= 20) {
      // Bounded — remaining keys counted as omitted
      omitted += Object.keys(rec).length - entries.length - omitted;
      break;
    }
  }
  if (Object.keys(rec).length === 0) return { entries: [], omitted, empty: true };
  return { entries, omitted, empty: entries.length === 0 && omitted === 0 };
}

// ─────────────────────────────────────────────────────────────
// Service types
// ─────────────────────────────────────────────────────────────

export interface AuditActor {
  id: string;
  email: string | null;
  displayName: string | null;
}

export interface AuditOrganization {
  id: string;
  name: string;
  slug: string;
}

export interface AuditLogItem {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
  actorUserId: string;
  actorEmail: string | null;
  actorDisplayName: string | null;
  reason: string | null;
  ip: string | null;
  createdAt: string;
  before: SafeProjection;
  after: SafeProjection;
  beforeRaw: unknown;
  afterRaw: unknown;
}

export interface AuditLogResult {
  items: AuditLogItem[];
  total: number | null;
  totalError?: string | undefined;
  page: number;
  pageSize: number;
  totalPages: number | null;
  hasMore: boolean;
  query: string;
  action: string;
  targetType: string;
  organizationQuery: string;
  dateFilter: string;
  availableActions: string[];
}

// ─────────────────────────────────────────────────────────────
// Config
// ─────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;
const MAX_QUERY_LEN = 100;
const ACTION_RE = /^[a-z_]+\.[a-z_]+$/;

function parseAuditParams(searchParams: Record<string, string | string[] | undefined>) {
  const get = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
  };
  const q = get("q").trim().slice(0, MAX_QUERY_LEN);
  const rawAction = get("action").trim().slice(0, 80).toLowerCase();
  const action = ACTION_RE.test(rawAction) ? rawAction : "";
  const rawTarget = get("target_type").trim().slice(0, 40).toLowerCase();
  const targetType = rawTarget.length >= 2 && rawTarget.length <= 40 ? rawTarget : "";
  const organizationQuery = get("org_q").trim().slice(0, MAX_QUERY_LEN) || get("organization").trim().slice(0, MAX_QUERY_LEN);
  const rawDate = get("date").trim().toLowerCase();
  const dateFilter = ["today", "7d", "30d"].includes(rawDate) ? rawDate : "all";
  let page = parseInt(get("page") || "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 1000) page = 1000;
  return { q, action, targetType, organizationQuery, dateFilter, page, pageSize: PAGE_SIZE };
}

function formatLike(q: string): string {
  return `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

function dateThreshold(dateFilter: string): string | null {
  const now = new Date();
  if (dateFilter === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (dateFilter === "7d") {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (dateFilter === "30d") {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  return null;
}

// ─────────────────────────────────────────────────────────────
// Service — read-only, no mutations, no audit writes
// ─────────────────────────────────────────────────────────────

/**
 * Read-only audit log for Super Admin — no mutations, no audit writes.
 * Security: requireSuperAdmin() before createAdminClient(), batched lookups, no N+1.
 */
export async function getAdminAuditLog(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<AuditLogResult> {
  await requireSuperAdmin();
  const { q, action, targetType, organizationQuery, dateFilter, page, pageSize } = parseAuditParams(searchParams);
  const admin = createAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const dateFrom = dateThreshold(dateFilter);

  // Resolve organization filter early — if org_q has no matches, return empty
  let orgIdsForFilter: string[] | null = null;
  if (organizationQuery) {
    const like = formatLike(organizationQuery);
    const { data } = await admin.from("organizations").select("id").or(`name.ilike.${like},slug.ilike.${like}`).limit(200);
    const ids = ((data ?? []) as Array<{ id: string }>).map((o) => o.id);
    if (ids.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        totalPages: 1,
        hasMore: false,
        query: q,
        action,
        targetType,
        organizationQuery,
        dateFilter,
        availableActions: [],
      };
    }
    orgIdsForFilter = ids;
  }

  // For actor search — if q looks like email/name, we could search profiles then filter by actor
  // Keep bounded; only if q contains @ or alphabetic, try profile resolution
  let actorIdsForSearch: string[] | null = null;
  if (q) {
    // Only attempt profile search if q likely actor — but we optimistically try
    const like = formatLike(q);
    try {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id")
        .or(`email.ilike.${like},display_name.ilike.${like}`)
        .limit(50);
      const pids = ((profiles ?? []) as Array<{ id: string }>).map((p) => p.id);
      if (pids.length > 0) actorIdsForSearch = pids;
      else actorIdsForSearch = [];
    } catch {
      actorIdsForSearch = null;
    }
  }

  // Total count with same filters
  let total: number | null = null;
  let totalError: string | undefined;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let countQ: any = admin.from("admin_audit_logs").select("id", { count: "exact", head: true });
    if (q) {
      const like = formatLike(q);
      if (actorIdsForSearch !== null && actorIdsForSearch.length > 0) {
        // Combine actor match OR action/target/reason match
        // PostgREST or syntax: action.ilike.x,target_type.ilike.x,reason.ilike.x,actor_user_id.in.(...)
        const inList = `(${actorIdsForSearch.join(",")})`;
        countQ = countQ.or(`action.ilike.${like},target_type.ilike.${like},reason.ilike.${like},actor_user_id.in.${inList}`);
      } else if (actorIdsForSearch !== null && actorIdsForSearch.length === 0) {
        countQ = countQ.or(`action.ilike.${like},target_type.ilike.${like},reason.ilike.${like}`);
      } else {
        countQ = countQ.or(`action.ilike.${like},target_type.ilike.${like},reason.ilike.${like}`);
      }
    }
    if (action) countQ = countQ.eq("action", action);
    if (targetType) countQ = countQ.eq("target_type", targetType);
    if (orgIdsForFilter) countQ = countQ.in("organization_id", orgIdsForFilter);
    if (dateFrom) countQ = countQ.gte("created_at", dateFrom);
    const { count, error } = (await countQ) as { count: number | null; error: unknown };
    if (error) throw error;
    total = count ?? 0;
  } catch {
    totalError = "Unable to load audit logs.";
  }

  // Data page — same filters
  let items: AuditLogItem[] = [];
  let availableActions: string[] = [];

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let dataQ: any = admin
      .from("admin_audit_logs")
      .select("id, actor_user_id, action, target_type, target_id, organization_id, reason, before, after, ip, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) {
      const like = formatLike(q);
      if (actorIdsForSearch !== null && actorIdsForSearch.length > 0) {
        const inList = `(${actorIdsForSearch.join(",")})`;
        dataQ = dataQ.or(`action.ilike.${like},target_type.ilike.${like},reason.ilike.${like},actor_user_id.in.${inList}`);
      } else if (actorIdsForSearch !== null && actorIdsForSearch.length === 0) {
        dataQ = dataQ.or(`action.ilike.${like},target_type.ilike.${like},reason.ilike.${like}`);
      } else {
        dataQ = dataQ.or(`action.ilike.${like},target_type.ilike.${like},reason.ilike.${like}`);
      }
    }
    if (action) dataQ = dataQ.eq("action", action);
    if (targetType) dataQ = dataQ.eq("target_type", targetType);
    if (orgIdsForFilter) dataQ = dataQ.in("organization_id", orgIdsForFilter);
    if (dateFrom) dataQ = dataQ.gte("created_at", dateFrom);

    const { data, error } = (await dataQ) as {
      data:
        | Array<{
            id: string;
            actor_user_id: string;
            action: string;
            target_type: string;
            target_id: string | null;
            organization_id: string | null;
            reason: string | null;
            before: unknown;
            after: unknown;
            ip: unknown;
            created_at: string;
          }>
        | null;
      error: unknown;
    };
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length > 0) {
      const actorIds = [...new Set(rows.map((r) => r.actor_user_id))];
      const orgIds = [...new Set(rows.map((r) => r.organization_id).filter((v): v is string => Boolean(v)))];

      const [profileRes, orgRes] = await Promise.all([
        actorIds.length ? admin.from("profiles").select("id, email, display_name").in("id", actorIds) : Promise.resolve({ data: [] } as never),
        orgIds.length ? admin.from("organizations").select("id, name, slug").in("id", orgIds) : Promise.resolve({ data: [] } as never),
      ]);

      const profileMap = new Map<string, { email: string | null; display_name: string | null }>();
      for (const p of ((profileRes as { data: Array<{ id: string; email: string | null; display_name: string | null }> }).data ?? [])) {
        profileMap.set(p.id, { email: p.email, display_name: p.display_name });
      }
      const orgMap = new Map<string, { name: string; slug: string }>();
      for (const o of ((orgRes as { data: Array<{ id: string; name: string; slug: string }> }).data ?? [])) {
        orgMap.set(o.id, { name: o.name, slug: o.slug });
      }

      items = rows.map((r) => {
        const prof = profileMap.get(r.actor_user_id);
        const org = r.organization_id ? orgMap.get(r.organization_id) : null;
        return {
          id: r.id,
          action: r.action,
          targetType: r.target_type,
          targetId: r.target_id,
          organizationId: r.organization_id,
          organizationName: org?.name ?? null,
          organizationSlug: org?.slug ?? null,
          actorUserId: r.actor_user_id,
          actorEmail: prof?.email ?? null,
          actorDisplayName: prof?.display_name ?? null,
          reason: r.reason,
          ip: r.ip ? String(r.ip) : null,
          createdAt: r.created_at,
          before: safeAuditProjection(r.before),
          after: safeAuditProjection(r.after),
          beforeRaw: r.before,
          afterRaw: r.after,
        };
      });
    }
  } catch {
    if (items.length === 0 && !totalError) totalError = "Unable to load audit logs.";
  }

  // Available actions — distinct list limited to 50 for filter dropdown
  try {
    const { data } = await admin.from("admin_audit_logs").select("action").limit(200);
    const distinct = [...new Set(((data ?? []) as Array<{ action: string }>).map((r) => r.action))].sort().slice(0, 50);
    availableActions = distinct;
  } catch {
    availableActions = [];
  }

  const totalPages = total !== null ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const hasMore = total !== null ? from + pageSize < total : items.length === pageSize;

  return {
    items,
    total,
    totalError,
    page,
    pageSize,
    totalPages,
    hasMore,
    query: q,
    action,
    targetType,
    organizationQuery,
    dateFilter,
    availableActions,
  };
}
