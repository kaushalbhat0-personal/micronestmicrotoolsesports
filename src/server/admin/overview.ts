import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface MetricResult {
  count: number | null;
  error?: string;
}

export interface RecentAuditEntry {
  id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  organization_id: string | null;
  actor_user_id: string;
  reason: string | null;
  created_at: string;
}

export interface AdminOverview {
  organizations: MetricResult;
  users: MetricResult;
  activeEntitlements: MetricResult;
  paidOrders: MetricResult;
  payments: MetricResult;
  failedScans: MetricResult;
  recentActivity: RecentAuditEntry[] | null;
  recentActivityError?: string;
}

/**
 * Read-only overview — no mutations.
 * Must be called from server code after requireSuperAdmin().
 * Each metric is isolated so one failure does not mask others.
 */
export async function getAdminOverview(): Promise<AdminOverview> {
  await requireSuperAdmin();
  const admin = createAdminClient();

  const overview: AdminOverview = {
    organizations: { count: null },
    users: { count: null },
    activeEntitlements: { count: null },
    paidOrders: { count: null },
    payments: { count: null },
    failedScans: { count: null },
    recentActivity: null,
  };

  // Organizations — total count
  try {
    const { count, error } = await admin.from("organizations").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.organizations = { count: count ?? 0 };
  } catch {
    overview.organizations = { count: null, error: "Unavailable" };
  }

  // Users — profiles count
  try {
    const { count, error } = await admin.from("profiles").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.users = { count: count ?? 0 };
  } catch {
    overview.users = { count: null, error: "Unavailable" };
  }

  // Active entitlements — expires_at IS NULL OR > now()
  try {
    const nowIso = new Date().toISOString();
    const { count, error } = await admin
      .from("tool_entitlements")
      .select("id", { count: "exact", head: true })
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`);
    if (error) throw error;
    overview.activeEntitlements = { count: count ?? 0 };
  } catch {
    overview.activeEntitlements = { count: null, error: "Unavailable" };
  }

  // Paid orders — status = paid
  try {
    const { count, error } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid");
    if (error) throw error;
    overview.paidOrders = { count: count ?? 0 };
  } catch {
    overview.paidOrders = { count: null, error: "Unavailable" };
  }

  // Payments — total payment records (existing schema, no status filter)
  try {
    const { count, error } = await admin.from("payments").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.payments = { count: count ?? 0 };
  } catch {
    overview.payments = { count: null, error: "Unavailable" };
  }

  // Failed sentinel scans — status = failed
  try {
    const { count, error } = await admin.from("scans").select("id", { count: "exact", head: true }).eq("status", "failed");
    if (error) throw error;
    overview.failedScans = { count: count ?? 0 };
  } catch {
    overview.failedScans = { count: null, error: "Unavailable" };
  }

  // Recent admin activity — latest 10, server-side after requireSuperAdmin (RLS requires super admin)
  try {
    const { data, error } = await admin
      .from("admin_audit_logs")
      .select("id, action, target_type, target_id, organization_id, actor_user_id, reason, created_at")
      .order("created_at", { ascending: false })
      .limit(10);
    if (error) throw error;
    overview.recentActivity = (data as RecentAuditEntry[] | null) ?? [];
  } catch {
    overview.recentActivity = null;
    overview.recentActivityError = "Unable to load activity.";
  }

  return overview;
}
