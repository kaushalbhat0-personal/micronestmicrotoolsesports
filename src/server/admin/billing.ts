import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type BillingSection = "orders" | "payments" | "webhooks" | "plans";

export interface MetricResult {
  count: number | null;
  error?: string;
}

export interface BillingOverview {
  orders: MetricResult;
  paidOrders: MetricResult;
  payments: MetricResult;
  webhooks: MetricResult;
  plans: MetricResult;
}

export interface AdminOrderItem {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  planId: string;
  planName: string | null;
  planSlug: string | null;
  billingPeriod: string | null;
  isAllAccess: boolean;
  toolName: string | null;
  toolSlug: string | null;
  amountMinor: number;
  currency: string;
  status: string;
  razorpayOrderId: string | null;
  createdAt: string;
}

export interface AdminPaymentItem {
  id: string;
  razorpayPaymentId: string | null;
  orderId: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  amountMinor: number;
  currency: string;
  status: string;
  verifiedAt: string | null;
  createdAt: string;
}

export interface AdminWebhookItem {
  id: string;
  provider: string;
  providerEventId: string;
  eventType: string | null;
  status: string | null;
  processed: boolean | null;
  organizationId: string | null;
  createdAt: string;
}

export interface AdminPlanItem {
  id: string;
  name: string;
  slug: string;
  billingPeriod: string;
  amountMinor: number;
  currency: string;
  toolId: string | null;
  toolName: string | null;
  toolSlug: string | null;
  isAllAccess: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AdminBillingResult {
  overview: BillingOverview;
  section: BillingSection;
  query: string;
  status: string;
  billingPeriod: string;
  page: number;
  pageSize: number;
  total: number | null;
  totalError?: string | undefined;
  hasMore: boolean;
  // Section-specific items
  orders: AdminOrderItem[];
  payments: AdminPaymentItem[];
  webhooks: AdminWebhookItem[];
  plans: AdminPlanItem[];
}

const PAGE_SIZE = 50;
const MAX_QUERY_LEN = 100;

function parseBillingParams(searchParams: Record<string, string | string[] | undefined>) {
  const get = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
  };
  const rawSection = get("section").trim().toLowerCase();
  const section: BillingSection = rawSection === "payments" || rawSection === "webhooks" || rawSection === "plans" ? (rawSection as BillingSection) : "orders";
  const q = get("q").trim().slice(0, MAX_QUERY_LEN);
  const status = get("status").trim().slice(0, 20);
  const billingPeriod = get("billing_period").trim().toLowerCase();
  let page = parseInt(get("page") || "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 1000) page = 1000;
  return { section, q, status, billingPeriod, page, pageSize: PAGE_SIZE };
}

function formatLike(q: string): string {
  return `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

/**
 * Read-only billing for Super Admin — no mutations.
 * Uses service_role after requireSuperAdmin, reads authoritative tables.
 */
export async function getAdminBilling(searchParams: Record<string, string | string[] | undefined>): Promise<AdminBillingResult> {
  await requireSuperAdmin();
  const { section, q, status, billingPeriod, page, pageSize } = parseBillingParams(searchParams);
  const admin = createAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Overview counts — isolated, never throw
  const overview: BillingOverview = {
    orders: { count: null },
    paidOrders: { count: null },
    payments: { count: null },
    webhooks: { count: null },
    plans: { count: null },
  };

  try {
    const { count, error } = await admin.from("orders").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.orders = { count: count ?? 0 };
  } catch {
    overview.orders = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("orders").select("id", { count: "exact", head: true }).eq("status", "paid");
    if (error) throw error;
    overview.paidOrders = { count: count ?? 0 };
  } catch {
    overview.paidOrders = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("payments").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.payments = { count: count ?? 0 };
  } catch {
    overview.payments = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("webhook_events").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.webhooks = { count: count ?? 0 };
  } catch {
    overview.webhooks = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("plans").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.plans = { count: count ?? 0 };
  } catch {
    overview.plans = { count: null, error: "Unavailable" };
  }

  // Section-specific data
  let orders: AdminOrderItem[] = [];
  let payments: AdminPaymentItem[] = [];
  let webhooks: AdminWebhookItem[] = [];
  let plans: AdminPlanItem[] = [];
  let total: number | null = null;
  let totalError: string | undefined;
  let hasMore = false;

  if (section === "orders") {
    // Resolve org search ids if q present
    let orgIds: string[] | null = null;
    if (q) {
      const like = formatLike(q);
      const { data: orgs } = await admin.from("organizations").select("id").or(`name.ilike.${like},slug.ilike.${like}`).limit(200);
      const ids = ((orgs ?? []) as Array<{ id: string }>).map((o) => o.id);
      if (ids.length === 0) {
        // Check also razorpay_order_id directly — if no org match, we still need to check razorpay
        // Fall through to query with razorpay filter, but if both miss we return 0
        // To handle, we will query with or: razorpay_order_id ilike OR org in ids
        // If ids empty, just search razorpay
        orgIds = [];
      } else {
        orgIds = ids;
      }
    }

    try {
      // Count
      let countQ = admin.from("orders").select("id", { count: "exact", head: true }) as unknown as never;
      if (q) {
        const like = formatLike(q);
        // For count we need to handle org search — use or for razorpay + in for org
        // Supabase or with in is not trivial; we do two-step: if orgIds not null, we filter via in OR ilike via or
        // Simpler: if q, we will filter in data query with or, for count we do same approach
        // Use raw or for razorpay + in via postgrest not supported directly, so we approximate:
        // If q and orgIds, we will count with or for razorpay and also check org via in via separate logic
        // To keep simple, we will count with razorpay ilike only when orgIds empty, else use in
        // For accurate count when both, we need to fetch ids via separate query; we choose to count via razorpay ilike OR org in
        // Supabase supports .or with mixed, but we will just use razorpay ilike for count when orgIds empty, else use in
        if (orgIds && orgIds.length > 0) {
          // For count, we need to count orders where razorpay ilike OR org in ids — we do two counts and take max? Instead we will just count with in + ilike via or string
          // PostgREST or supports `razorpay_order_id.ilike.%q%,organization_id.in.(id1,id2)`
          const inList = `(${orgIds.join(",")})`;
          countQ = (countQ as never as { or: (s: string) => never }).or(`razorpay_order_id.ilike.${like},organization_id.in.${inList}`) as never;
        } else {
          countQ = (countQ as never as { ilike: (c: string, v: string) => never }).ilike("razorpay_order_id", like) as never;
        }
      }
      if (status && ["created", "paid", "failed", "expired"].includes(status)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("status", status) as never;
      }
      const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
        count: number | null;
        error: unknown;
      };
      if (error) throw error;
      total = count ?? 0;
    } catch {
      totalError = "Unable to load orders.";
    }

    try {
      let dataQ = admin
        .from("orders")
        .select("id, organization_id, plan_id, tool_id, is_all_access, amount_minor, currency, status, razorpay_order_id, created_at")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as never;

      if (q) {
        const like = formatLike(q);
        if (orgIds && orgIds.length > 0) {
          const inList = `(${orgIds.join(",")})`;
          dataQ = (dataQ as never as { or: (s: string) => never }).or(`razorpay_order_id.ilike.${like},organization_id.in.${inList}`) as never;
        } else {
          dataQ = (dataQ as never as { ilike: (c: string, v: string) => never }).ilike("razorpay_order_id", like) as never;
        }
      }
      if (status && ["created", "paid", "failed", "expired"].includes(status)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("status", status) as never;
      }

      const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
        data:
          | Array<{
              id: string;
              organization_id: string;
              plan_id: string;
              tool_id: string | null;
              is_all_access: boolean;
              amount_minor: number;
              currency: string;
              status: string;
              razorpay_order_id: string | null;
              created_at: string;
            }>
          | null;
        error: unknown;
      };
      if (error) throw error;

      const rows = data ?? [];
      if (rows.length > 0) {
        const orgIdsRows = [...new Set(rows.map((r) => r.organization_id))];
        const planIds = [...new Set(rows.map((r) => r.plan_id))];
        const toolIds = [...new Set(rows.map((r) => r.tool_id).filter((v): v is string => Boolean(v)))];

        const [{ data: orgData }, { data: planData }, { data: toolData }] = await Promise.all([
          orgIdsRows.length ? admin.from("organizations").select("id, name, slug").in("id", orgIdsRows) : Promise.resolve({ data: [], error: null } as never),
          planIds.length ? admin.from("plans").select("id, name, slug, billing_period").in("id", planIds) : Promise.resolve({ data: [], error: null } as never),
          toolIds.length ? admin.from("tools").select("id, slug, name").in("id", toolIds) : Promise.resolve({ data: [], error: null } as never),
        ]);

        const orgMap = new Map<string, { name: string; slug: string }>();
        for (const o of ((orgData ?? []) as Array<{ id: string; name: string; slug: string }>)) orgMap.set(o.id, { name: o.name, slug: o.slug });

        const planMap = new Map<string, { name: string; slug: string; billing_period: string }>();
        for (const p of ((planData ?? []) as Array<{ id: string; name: string; slug: string; billing_period: string }>)) planMap.set(p.id, { name: p.name, slug: p.slug, billing_period: p.billing_period });

        const toolMap = new Map<string, { slug: string; name: string }>();
        for (const t of ((toolData ?? []) as Array<{ id: string; slug: string; name: string }>)) toolMap.set(t.id, { slug: t.slug, name: t.name });

        orders = rows.map((r) => {
          const org = orgMap.get(r.organization_id);
          const plan = planMap.get(r.plan_id);
          const tool = r.tool_id ? toolMap.get(r.tool_id) : null;
          return {
            id: r.id,
            organizationId: r.organization_id,
            organizationName: org?.name ?? "Unknown",
            organizationSlug: org?.slug ?? "—",
            planId: r.plan_id,
            planName: plan?.name ?? null,
            planSlug: plan?.slug ?? null,
            billingPeriod: plan?.billing_period ?? null,
            isAllAccess: r.is_all_access,
            toolName: r.is_all_access ? "All Access" : tool?.name ?? null,
            toolSlug: r.is_all_access ? "all-access" : tool?.slug ?? null,
            amountMinor: r.amount_minor,
            currency: r.currency,
            status: r.status,
            razorpayOrderId: r.razorpay_order_id,
            createdAt: r.created_at,
          };
        });
      }
    } catch {
      if (orders.length === 0 && !totalError) totalError = "Unable to load orders.";
    }
    hasMore = total !== null ? from + pageSize < total : orders.length === pageSize;
  } else if (section === "payments") {
    let orgIds: string[] | null = null;
    if (q) {
      const like = formatLike(q);
      const { data: orgs } = await admin.from("organizations").select("id").or(`name.ilike.${like},slug.ilike.${like}`).limit(200);
      const ids = ((orgs ?? []) as Array<{ id: string }>).map((o) => o.id);
      orgIds = ids.length > 0 ? ids : [];
    }

    try {
      let countQ = admin.from("payments").select("id", { count: "exact", head: true }) as unknown as never;
      if (q) {
        const like = formatLike(q);
        if (orgIds && orgIds.length > 0) {
          const inList = `(${orgIds.join(",")})`;
          countQ = (countQ as never as { or: (s: string) => never }).or(`razorpay_payment_id.ilike.${like},organization_id.in.${inList}`) as never;
        } else {
          countQ = (countQ as never as { ilike: (c: string, v: string) => never }).ilike("razorpay_payment_id", like) as never;
        }
      }
      if (status && ["created", "authorized", "captured", "failed"].includes(status)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("status", status) as never;
      }
      const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
        count: number | null;
        error: unknown;
      };
      if (error) throw error;
      total = count ?? 0;
    } catch {
      totalError = "Unable to load payments.";
    }

    try {
      let dataQ = admin
        .from("payments")
        .select("id, razorpay_payment_id, order_id, organization_id, amount_minor, currency, status, verified_at, created_at")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as never;
      if (q) {
        const like = formatLike(q);
        if (orgIds && orgIds.length > 0) {
          const inList = `(${orgIds.join(",")})`;
          dataQ = (dataQ as never as { or: (s: string) => never }).or(`razorpay_payment_id.ilike.${like},organization_id.in.${inList}`) as never;
        } else {
          dataQ = (dataQ as never as { ilike: (c: string, v: string) => never }).ilike("razorpay_payment_id", like) as never;
        }
      }
      if (status && ["created", "authorized", "captured", "failed"].includes(status)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("status", status) as never;
      }
      const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
        data:
          | Array<{
              id: string;
              razorpay_payment_id: string | null;
              order_id: string;
              organization_id: string;
              amount_minor: number;
              currency: string;
              status: string;
              verified_at: string | null;
              created_at: string;
            }>
          | null;
        error: unknown;
      };
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length > 0) {
        const orgIdsRows = [...new Set(rows.map((r) => r.organization_id))];
        const { data: orgData } = orgIdsRows.length
          ? await admin.from("organizations").select("id, name, slug").in("id", orgIdsRows)
          : { data: [] as unknown[], error: null } as never;
        const orgMap = new Map<string, { name: string; slug: string }>();
        for (const o of ((orgData ?? []) as Array<{ id: string; name: string; slug: string }>)) orgMap.set(o.id, { name: o.name, slug: o.slug });
        payments = rows.map((r) => ({
          id: r.id,
          razorpayPaymentId: r.razorpay_payment_id,
          orderId: r.order_id,
          organizationId: r.organization_id,
          organizationName: orgMap.get(r.organization_id)?.name ?? "Unknown",
          organizationSlug: orgMap.get(r.organization_id)?.slug ?? "—",
          amountMinor: r.amount_minor,
          currency: r.currency,
          status: r.status,
          verifiedAt: r.verified_at,
          createdAt: r.created_at,
        }));
      }
    } catch {
      if (payments.length === 0 && !totalError) totalError = "Unable to load payments.";
    }
    hasMore = total !== null ? from + pageSize < total : payments.length === pageSize;
  } else if (section === "webhooks") {
    try {
      let countQ = admin.from("webhook_events").select("id", { count: "exact", head: true }) as unknown as never;
      if (q) {
        const like = formatLike(q);
        countQ = (countQ as never as { or: (s: string) => never }).or(`provider_event_id.ilike.${like},external_event_id.ilike.${like},event_type.ilike.${like}`) as never;
      }
      if (status && ["pending", "processing", "succeeded", "failed"].includes(status)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("status", status) as never;
      }
      const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
        count: number | null;
        error: unknown;
      };
      if (error) throw error;
      total = count ?? 0;
    } catch {
      totalError = "Unable to load webhook events.";
    }

    try {
      let dataQ = admin
        .from("webhook_events")
        .select("id, provider, provider_event_id, event_type, status, processed, organization_id, created_at")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as never;
      if (q) {
        const like = formatLike(q);
        dataQ = (dataQ as never as { or: (s: string) => never }).or(`provider_event_id.ilike.${like},external_event_id.ilike.${like},event_type.ilike.${like}`) as never;
      }
      if (status && ["pending", "processing", "succeeded", "failed"].includes(status)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("status", status) as never;
      }
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
              created_at: string;
            }>
          | null;
        error: unknown;
      };
      if (error) throw error;
      webhooks = ((data ?? []) as Array<{
        id: string;
        provider: string;
        provider_event_id: string;
        event_type: string | null;
        status: string | null;
        processed: boolean | null;
        organization_id: string | null;
        created_at: string;
      }>).map((r) => ({
        id: r.id,
        provider: r.provider,
        providerEventId: r.provider_event_id,
        eventType: r.event_type,
        status: r.status,
        processed: r.processed,
        organizationId: r.organization_id,
        createdAt: r.created_at,
      }));
    } catch {
      if (webhooks.length === 0 && !totalError) totalError = "Unable to load webhook events.";
    }
    hasMore = total !== null ? from + pageSize < total : webhooks.length === pageSize;
  } else if (section === "plans") {
    try {
      let countQ = admin.from("plans").select("id", { count: "exact", head: true }) as unknown as never;
      if (q) {
        const like = formatLike(q);
        countQ = (countQ as never as { or: (s: string) => never }).or(`slug.ilike.${like},name.ilike.${like}`) as never;
      }
      if (billingPeriod && ["monthly", "yearly"].includes(billingPeriod)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("billing_period", billingPeriod) as never;
      }
      if (status === "active" || status === "inactive") {
        countQ = (countQ as never as { eq: (c: string, v: boolean) => never }).eq("is_active", status === "active") as never;
      }
      const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
        count: number | null;
        error: unknown;
      };
      if (error) throw error;
      total = count ?? 0;
    } catch {
      totalError = "Unable to load plans.";
    }

    try {
      let dataQ = admin.from("plans").select("id, name, slug, billing_period, amount_minor, currency, tool_id, is_active, created_at").order("created_at", { ascending: false }).range(from, to) as unknown as never;
      if (q) {
        const like = formatLike(q);
        dataQ = (dataQ as never as { or: (s: string) => never }).or(`slug.ilike.${like},name.ilike.${like}`) as never;
      }
      if (billingPeriod && ["monthly", "yearly"].includes(billingPeriod)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("billing_period", billingPeriod) as never;
      }
      if (status === "active" || status === "inactive") {
        dataQ = (dataQ as never as { eq: (c: string, v: boolean) => never }).eq("is_active", status === "active") as never;
      }
      const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
        data:
          | Array<{
              id: string;
              name: string;
              slug: string;
              billing_period: string;
              amount_minor: number;
              currency: string;
              tool_id: string | null;
              is_active: boolean;
              created_at: string;
            }>
          | null;
        error: unknown;
      };
      if (error) throw error;
      const rows = data ?? [];
      const toolIds = [...new Set(rows.map((r) => r.tool_id).filter((v): v is string => Boolean(v)))];
      const { data: toolData } = toolIds.length ? await admin.from("tools").select("id, slug, name").in("id", toolIds) : { data: [] as unknown[], error: null } as never;
      const toolMap = new Map<string, { slug: string; name: string }>();
      for (const t of ((toolData ?? []) as Array<{ id: string; slug: string; name: string }>)) toolMap.set(t.id, { slug: t.slug, name: t.name });

      plans = rows.map((r) => {
        const tool = r.tool_id ? toolMap.get(r.tool_id) : null;
        return {
          id: r.id,
          name: r.name,
          slug: r.slug,
          billingPeriod: r.billing_period,
          amountMinor: r.amount_minor,
          currency: r.currency,
          toolId: r.tool_id,
          toolName: tool?.name ?? (r.tool_id ? "Unknown tool" : null),
          toolSlug: tool?.slug ?? null,
          isAllAccess: r.tool_id === null,
          isActive: r.is_active,
          createdAt: r.created_at,
        };
      });
    } catch {
      if (plans.length === 0 && !totalError) totalError = "Unable to load plans.";
    }
    hasMore = total !== null ? from + pageSize < total : plans.length === pageSize;
  }

  return {
    overview,
    section,
    query: q,
    status,
    billingPeriod,
    page,
    pageSize,
    total,
    totalError,
    hasMore,
    orders,
    payments,
    webhooks,
    plans,
  };
}
