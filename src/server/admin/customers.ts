import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { safeAuditProjection, type SafeProjection } from "@/server/admin/audit-log";

/**
 * Customer 360 — read-only. requireSuperAdmin → createAdminClient → bounded reads.
 * Never touches auth.users; profiles is the safe identity source.
 * Never selects secrets, signatures, payloads, or encrypted columns.
 */

export const SIX_TOOL_SLUGS = [
  "sponsor-sentinel",
  "prize-splitter",
  "draft-ban",
  "tie-breaker",
  "payout-tracker",
  "roster-builder",
] as const;

/** Marketing aliases accepted in search/display, mapped to canonical DB slugs. */
const SLUG_ALIASES: Record<string, string> = {
  "prize-pool-splitter": "prize-splitter",
  "tournament-roster-builder": "roster-builder",
};

export function canonicalToolSlug(slug: string): string {
  const lower = slug.trim().toLowerCase();
  return SLUG_ALIASES[lower] ?? lower;
}

const SEARCH_PAGE_SIZE = 20;
const DETAIL_LIMIT = 50;
const MAX_QUERY_LEN = 100;

function formatLike(q: string): string {
  return `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

export interface CustomerSearchItem {
  kind: "user" | "organization";
  userId: string | null;
  userEmail: string | null;
  userDisplayName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  organizationSlug: string | null;
}

export interface CustomerMembership {
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  role: string;
}

export interface CustomerEntitlement {
  id: string;
  scope: "organization" | "user";
  toolSlug: string | null;
  toolName: string | null;
  isAllAccess: boolean;
  source: string;
  expiresAt: string | null;
  isPermanent: boolean;
  isActive: boolean;
  organizationId: string | null;
  organizationName: string | null;
}

export interface CustomerOrder {
  id: string;
  organizationId: string;
  organizationName: string | null;
  planName: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  razorpayOrderId: string | null;
  createdAt: string;
}

export interface CustomerPayment {
  id: string;
  orderId: string;
  organizationId: string;
  amountMinor: number;
  currency: string;
  status: string;
  razorpayPaymentId: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface CustomerWebhook {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string | null;
  status: string | null;
  organizationId: string | null;
  createdAt: string;
}

export interface CustomerAuditEntry {
  id: string;
  action: string;
  targetType: string;
  targetId: string | null;
  organizationId: string | null;
  reason: string | null;
  createdAt: string;
  before: SafeProjection;
  after: SafeProjection;
}

export interface CustomerDetail {
  user: { id: string; email: string | null; displayName: string | null; createdAt: string } | null;
  memberships: CustomerMembership[];
  entitlements: CustomerEntitlement[];
  orders: CustomerOrder[];
  payments: CustomerPayment[];
  webhooks: CustomerWebhook[];
  audit: CustomerAuditEntry[];
}

export interface OrgDetail {
  organization: { id: string; name: string; slug: string; createdAt: string } | null;
  members: Array<{ userId: string; email: string | null; displayName: string | null; role: string }>;
  entitlements: CustomerEntitlement[];
  orders: CustomerOrder[];
  payments: CustomerPayment[];
  audit: CustomerAuditEntry[];
}

/**
 * Bounded customer search by user email, organization name, or organization slug.
 */
export async function searchCustomers(query: string): Promise<{ items: CustomerSearchItem[]; query: string }> {
  await requireSuperAdmin();
  const q = query.trim().slice(0, MAX_QUERY_LEN);
  if (!q) return { items: [], query: q };
  const admin = createAdminClient();
  const like = formatLike(q);

  const items: CustomerSearchItem[] = [];

  // Users by email (bounded 20) — profiles only, never auth.users
  try {
    const { data } = await admin
      .from("profiles")
      .select("id, email, display_name")
      .ilike("email", like)
      .order("created_at", { ascending: false })
      .limit(SEARCH_PAGE_SIZE);
    for (const p of ((data ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>)) {
      items.push({
        kind: "user",
        userId: p.id,
        userEmail: p.email,
        userDisplayName: p.display_name,
        organizationId: null,
        organizationName: null,
        organizationSlug: null,
      });
    }
  } catch {
    // isolated — org search still proceeds
  }

  // Organizations by name/slug (bounded 20)
  try {
    const { data } = await admin
      .from("organizations")
      .select("id, name, slug")
      .or(`name.ilike.${like},slug.ilike.${like}`)
      .order("created_at", { ascending: false })
      .limit(SEARCH_PAGE_SIZE);
    for (const o of ((data ?? []) as Array<{ id: string; name: string; slug: string }>)) {
      items.push({
        kind: "organization",
        userId: null,
        userEmail: null,
        userDisplayName: null,
        organizationId: o.id,
        organizationName: o.name,
        organizationSlug: o.slug,
      });
    }
  } catch {
    // isolated
  }

  return { items: items.slice(0, SEARCH_PAGE_SIZE), query: q };
}

function entitlementActive(expiresAt: string | null, now: Date): boolean {
  if (expiresAt === null) return true;
  return new Date(expiresAt) > now;
}

/**
 * Full customer view for a user. Batched lookups, no N+1, bounded lists.
 */
export async function getCustomerByUser(userId: string): Promise<CustomerDetail> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const now = new Date();

  const { data: profile } = await admin.from("profiles").select("id, email, display_name, created_at").eq("id", userId).maybeSingle();
  const user = profile
    ? {
        id: (profile as { id: string }).id,
        email: (profile as { email: string | null }).email,
        displayName: (profile as { display_name: string | null }).display_name,
        createdAt: (profile as { created_at: string }).created_at,
      }
    : null;

  // Memberships (bounded)
  let memberships: CustomerMembership[] = [];
  let orgIds: string[] = [];
  try {
    const { data } = await admin.from("organization_members").select("organization_id, role").eq("user_id", userId).limit(DETAIL_LIMIT);
    const rows = ((data ?? []) as Array<{ organization_id: string; role: string }>);
    orgIds = [...new Set(rows.map((r) => r.organization_id))];
    if (orgIds.length > 0) {
      const { data: orgData } = await admin.from("organizations").select("id, name, slug").in("id", orgIds);
      const orgMap = new Map(((orgData ?? []) as Array<{ id: string; name: string; slug: string }>).map((o) => [o.id, o]));
      memberships = rows.map((r) => ({
        organizationId: r.organization_id,
        organizationName: orgMap.get(r.organization_id)?.name ?? "Unknown",
        organizationSlug: orgMap.get(r.organization_id)?.slug ?? "—",
        role: r.role,
      }));
    }
  } catch {
    memberships = [];
  }

  // Org entitlements across member orgs (batched, bounded)
  let entitlements: CustomerEntitlement[] = [];
  try {
    if (orgIds.length > 0) {
      const { data } = await admin
        .from("tool_entitlements")
        .select("id, organization_id, tool_id, is_all_access, source, expires_at")
        .in("organization_id", orgIds)
        .order("created_at", { ascending: false })
        .limit(DETAIL_LIMIT);
      const rows = ((data ?? []) as Array<{
        id: string;
        organization_id: string;
        tool_id: string | null;
        is_all_access: boolean;
        source: string;
        expires_at: string | null;
      }>);
      const toolIds = [...new Set(rows.map((r) => r.tool_id).filter((v): v is string => Boolean(v)))];
      const toolMap = new Map<string, { slug: string; name: string }>();
      if (toolIds.length > 0) {
        const { data: toolData } = await admin.from("tools").select("id, slug, name").in("id", toolIds);
        for (const t of ((toolData ?? []) as Array<{ id: string; slug: string; name: string }>)) toolMap.set(t.id, t);
      }
      const { data: orgData } = await admin.from("organizations").select("id, name").in("id", orgIds);
      const orgMap = new Map(((orgData ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]));
      entitlements = rows.map((r) => {
        const tool = r.tool_id ? toolMap.get(r.tool_id) : null;
        return {
          id: r.id,
          scope: "organization" as const,
          toolSlug: r.is_all_access ? "all-access" : (tool?.slug ?? null),
          toolName: r.is_all_access ? "All Access" : (tool?.name ?? "Unknown tool"),
          isAllAccess: r.is_all_access,
          source: r.source,
          expiresAt: r.expires_at,
          isPermanent: r.expires_at === null,
          isActive: entitlementActive(r.expires_at, now),
          organizationId: r.organization_id,
          organizationName: orgMap.get(r.organization_id) ?? null,
        };
      });
    }
  } catch {
    entitlements = [];
  }

  // User-scoped sponsorship grants (Sponsorship legacy/user model)
  try {
    const { data } = await admin.from("user_tool_entitlements").select("id, tool_id, source, expires_at").eq("user_id", userId).limit(DETAIL_LIMIT);
    const rows = ((data ?? []) as Array<{ id: string; tool_id: string; source: string; expires_at: string | null }>);
    if (rows.length > 0) {
      const toolIds = [...new Set(rows.map((r) => r.tool_id))];
      const { data: toolData } = await admin.from("tools").select("id, slug, name").in("id", toolIds);
      const toolMap = new Map(((toolData ?? []) as Array<{ id: string; slug: string; name: string }>).map((t) => [t.id, t]));
      for (const r of rows) {
        const tool = toolMap.get(r.tool_id);
        entitlements.push({
          id: r.id,
          scope: "user",
          toolSlug: tool?.slug ?? null,
          toolName: tool?.name ?? "Unknown tool",
          isAllAccess: false,
          source: r.source,
          expiresAt: r.expires_at,
          isPermanent: r.expires_at === null,
          isActive: entitlementActive(r.expires_at, now),
          organizationId: null,
          organizationName: null,
        });
      }
    }
  } catch {
    // isolated
  }

  // Billing: recent orders + payments across member orgs
  let orders: CustomerOrder[] = [];
  let payments: CustomerPayment[] = [];
  try {
    if (orgIds.length > 0) {
      const { data } = await admin
        .from("orders")
        .select("id, organization_id, plan_id, amount_minor, currency, status, razorpay_order_id, created_at")
        .in("organization_id", orgIds)
        .order("created_at", { ascending: false })
        .limit(DETAIL_LIMIT);
      const rows = ((data ?? []) as Array<{
        id: string;
        organization_id: string;
        plan_id: string;
        amount_minor: number;
        currency: string;
        status: string;
        razorpay_order_id: string | null;
        created_at: string;
      }>);
      const planIds = [...new Set(rows.map((r) => r.plan_id))];
      const planMap = new Map<string, string>();
      if (planIds.length > 0) {
        const { data: planData } = await admin.from("plans").select("id, name").in("id", planIds);
        for (const p of ((planData ?? []) as Array<{ id: string; name: string }>)) planMap.set(p.id, p.name);
      }
      const { data: orgData } = await admin.from("organizations").select("id, name").in("id", orgIds);
      const orgMap = new Map(((orgData ?? []) as Array<{ id: string; name: string }>).map((o) => [o.id, o.name]));
      orders = rows.map((r) => ({
        id: r.id,
        organizationId: r.organization_id,
        organizationName: orgMap.get(r.organization_id) ?? null,
        planName: planMap.get(r.plan_id) ?? null,
        amountMinor: r.amount_minor,
        currency: r.currency,
        status: r.status,
        razorpayOrderId: r.razorpay_order_id,
        createdAt: r.created_at,
      }));
    }
  } catch {
    orders = [];
  }
  try {
    if (orgIds.length > 0) {
      const { data } = await admin
        .from("payments")
        .select("id, order_id, organization_id, amount_minor, currency, status, razorpay_payment_id, verified_at, created_at")
        .in("organization_id", orgIds)
        .order("created_at", { ascending: false })
        .limit(DETAIL_LIMIT);
      payments = (((data ?? []) as Array<{
        id: string;
        order_id: string;
        organization_id: string;
        amount_minor: number;
        currency: string;
        status: string;
        razorpay_payment_id: string | null;
        verified_at: string | null;
        created_at: string;
      }>)).map((r) => ({
        id: r.id,
        orderId: r.order_id,
        organizationId: r.organization_id,
        amountMinor: r.amount_minor,
        currency: r.currency,
        status: r.status,
        razorpayPaymentId: r.razorpay_payment_id,
        verifiedAt: r.verified_at,
        createdAt: r.created_at,
      }));
    }
  } catch {
    payments = [];
  }

  // Webhooks: recent relevant (org-scoped, bounded; safe columns only)
  let webhooks: CustomerWebhook[] = [];
  try {
    if (orgIds.length > 0) {
      const { data } = await admin
        .from("webhook_events")
        .select("id, provider, provider_event_id, event_type, status, organization_id, created_at")
        .in("organization_id", orgIds)
        .order("created_at", { ascending: false })
        .limit(20);
      webhooks = (((data ?? []) as Array<{
        id: string;
        provider: string;
        provider_event_id: string;
        event_type: string | null;
        status: string | null;
        organization_id: string | null;
        created_at: string;
      }>)).map((r) => ({
        id: r.id,
        provider: r.provider,
        providerEventId: r.provider_event_id,
        eventType: r.event_type,
        status: r.status,
        organizationId: r.organization_id,
        createdAt: r.created_at,
      }));
    }
  } catch {
    webhooks = [];
  }

  // Audit slice: actor = user OR organization in member orgs (bounded 20, safe projection)
  let audit: CustomerAuditEntry[] = [];
  try {
    let auditQ = admin
      .from("admin_audit_logs")
      .select("id, action, target_type, target_id, organization_id, reason, before, after, created_at")
      .order("created_at", { ascending: false })
      .limit(20) as unknown as never;
    if (orgIds.length > 0) {
      const inList = `(${orgIds.join(",")})`;
      auditQ = (auditQ as never as { or: (s: string) => never }).or(`actor_user_id.eq.${userId},organization_id.in.${inList}`) as never;
    } else {
      auditQ = (auditQ as never as { eq: (c: string, v: string) => never }).eq("actor_user_id", userId) as never;
    }
    const { data } = (await (auditQ as unknown as Promise<{ data: unknown[] | null }>)) as {
      data: Array<{
        id: string;
        action: string;
        target_type: string;
        target_id: string | null;
        organization_id: string | null;
        reason: string | null;
        before: unknown;
        after: unknown;
        created_at: string;
      }> | null;
    };
    audit = (data ?? []).map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      organizationId: r.organization_id,
      reason: r.reason,
      createdAt: r.created_at,
      before: safeAuditProjection(r.before),
      after: safeAuditProjection(r.after),
    }));
  } catch {
    audit = [];
  }

  return { user, memberships, entitlements, orders, payments, webhooks, audit };
}

/**
 * Organization drill-down: identity, members, entitlements, orders, payments, audit slice.
 */
export async function getCustomerByOrg(orgId: string): Promise<OrgDetail> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const now = new Date();

  const { data: org } = await admin.from("organizations").select("id, name, slug, created_at").eq("id", orgId).maybeSingle();
  const organization = org
    ? {
        id: (org as { id: string }).id,
        name: (org as { name: string }).name,
        slug: (org as { slug: string }).slug,
        createdAt: (org as { created_at: string }).created_at,
      }
    : null;

  let members: OrgDetail["members"] = [];
  try {
    const { data } = await admin.from("organization_members").select("user_id, role").eq("organization_id", orgId).limit(DETAIL_LIMIT);
    const rows = ((data ?? []) as Array<{ user_id: string; role: string }>);
    if (rows.length > 0) {
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profileData } = await admin.from("profiles").select("id, email, display_name").in("id", userIds);
      const profileMap = new Map(
        ((profileData ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>).map((p) => [p.id, p]),
      );
      members = rows.map((r) => ({
        userId: r.user_id,
        email: profileMap.get(r.user_id)?.email ?? null,
        displayName: profileMap.get(r.user_id)?.display_name ?? null,
        role: r.role,
      }));
    }
  } catch {
    members = [];
  }

  let entitlements: CustomerEntitlement[] = [];
  try {
    const { data } = await admin
      .from("tool_entitlements")
      .select("id, organization_id, tool_id, is_all_access, source, expires_at")
      .eq("organization_id", orgId)
      .limit(DETAIL_LIMIT);
    const rows = ((data ?? []) as Array<{
      id: string;
      organization_id: string;
      tool_id: string | null;
      is_all_access: boolean;
      source: string;
      expires_at: string | null;
    }>);
    const toolIds = [...new Set(rows.map((r) => r.tool_id).filter((v): v is string => Boolean(v)))];
    const toolMap = new Map<string, { slug: string; name: string }>();
    if (toolIds.length > 0) {
      const { data: toolData } = await admin.from("tools").select("id, slug, name").in("id", toolIds);
      for (const t of ((toolData ?? []) as Array<{ id: string; slug: string; name: string }>)) toolMap.set(t.id, t);
    }
    entitlements = rows.map((r) => {
      const tool = r.tool_id ? toolMap.get(r.tool_id) : null;
      return {
        id: r.id,
        scope: "organization" as const,
        toolSlug: r.is_all_access ? "all-access" : (tool?.slug ?? null),
        toolName: r.is_all_access ? "All Access" : (tool?.name ?? "Unknown tool"),
        isAllAccess: r.is_all_access,
        source: r.source,
        expiresAt: r.expires_at,
        isPermanent: r.expires_at === null,
        isActive: entitlementActive(r.expires_at, now),
        organizationId: r.organization_id,
        organizationName: organization?.name ?? null,
      };
    });
  } catch {
    entitlements = [];
  }

  let orders: CustomerOrder[] = [];
  try {
    const { data } = await admin
      .from("orders")
      .select("id, organization_id, plan_id, amount_minor, currency, status, razorpay_order_id, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(DETAIL_LIMIT);
    const rows = ((data ?? []) as Array<{
      id: string;
      organization_id: string;
      plan_id: string;
      amount_minor: number;
      currency: string;
      status: string;
      razorpay_order_id: string | null;
      created_at: string;
    }>);
    const planIds = [...new Set(rows.map((r) => r.plan_id))];
    const planMap = new Map<string, string>();
    if (planIds.length > 0) {
      const { data: planData } = await admin.from("plans").select("id, name").in("id", planIds);
      for (const p of ((planData ?? []) as Array<{ id: string; name: string }>)) planMap.set(p.id, p.name);
    }
    orders = rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      organizationName: organization?.name ?? null,
      planName: planMap.get(r.plan_id) ?? null,
      amountMinor: r.amount_minor,
      currency: r.currency,
      status: r.status,
      razorpayOrderId: r.razorpay_order_id,
      createdAt: r.created_at,
    }));
  } catch {
    orders = [];
  }

  let payments: CustomerPayment[] = [];
  try {
    const { data } = await admin
      .from("payments")
      .select("id, order_id, organization_id, amount_minor, currency, status, razorpay_payment_id, verified_at, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(DETAIL_LIMIT);
    payments = (((data ?? []) as Array<{
      id: string;
      order_id: string;
      organization_id: string;
      amount_minor: number;
      currency: string;
      status: string;
      razorpay_payment_id: string | null;
      verified_at: string | null;
      created_at: string;
    }>)).map((r) => ({
      id: r.id,
      orderId: r.order_id,
      organizationId: r.organization_id,
      amountMinor: r.amount_minor,
      currency: r.currency,
      status: r.status,
      razorpayPaymentId: r.razorpay_payment_id,
      verifiedAt: r.verified_at,
      createdAt: r.created_at,
    }));
  } catch {
    payments = [];
  }

  let audit: CustomerAuditEntry[] = [];
  try {
    const { data } = await admin
      .from("admin_audit_logs")
      .select("id, action, target_type, target_id, organization_id, reason, before, after, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(20);
    audit = (((data ?? []) as Array<{
      id: string;
      action: string;
      target_type: string;
      target_id: string | null;
      organization_id: string | null;
      reason: string | null;
      before: unknown;
      after: unknown;
      created_at: string;
    }>)).map((r) => ({
      id: r.id,
      action: r.action,
      targetType: r.target_type,
      targetId: r.target_id,
      organizationId: r.organization_id,
      reason: r.reason,
      createdAt: r.created_at,
      before: safeAuditProjection(r.before),
      after: safeAuditProjection(r.after),
    }));
  } catch {
    audit = [];
  }

  return { organization, members, entitlements, orders, payments, audit };
}
