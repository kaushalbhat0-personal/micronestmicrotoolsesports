import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminEntitlementItem {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  toolId: string | null;
  toolName: string | null;
  toolSlug: string | null;
  isAllAccess: boolean;
  expiresAt: string | null;
  source: string;
  status: "Active" | "Expired" | "Permanent";
  isPermanent: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AdminEntitlementsResult {
  items: AdminEntitlementItem[];
  total: number | null;
  totalError?: string | undefined;
  page: number;
  pageSize: number;
  query: string;
  tool: string; // slug or all-access or empty for all
  status: string; // active|expired|all
  hasMore: boolean;
  tools: Array<{ slug: string; name: string }>;
}

const PAGE_SIZE = 50;
const MAX_QUERY_LEN = 100;

function parseParams(searchParams: Record<string, string | string[] | undefined>) {
  const get = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
  };
  const q = get("q").trim().slice(0, MAX_QUERY_LEN);
  const toolRaw = get("tool").trim().slice(0, 80).toLowerCase();
  const statusRaw = get("status").trim().toLowerCase();
  const status = statusRaw === "active" || statusRaw === "expired" ? statusRaw : "all";
  const tool = toolRaw;
  let page = parseInt(get("page") || "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 1000) page = 1000;
  return { q, tool, status, page, pageSize: PAGE_SIZE };
}

/**
 * Read-only entitlements for Super Admin.
 * Preserves is_all_access + tool_id + expires_at NULL semantics.
 * Batched organization/tool lookups, no N+1, no mutations.
 */
export async function getAdminEntitlements(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<AdminEntitlementsResult> {
  await requireSuperAdmin();
  const { q, tool, status, page, pageSize } = parseParams(searchParams);
  const admin = createAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const serverNowIso = new Date().toISOString();

  // Load tools for filter dropdown — authoritative
  let tools: Array<{ slug: string; name: string }> = [];
  try {
    const { data: toolRows } = await admin.from("tools").select("slug, name").order("name", { ascending: true });
    tools = ((toolRows ?? []) as Array<{ slug: string; name: string }>) ?? [];
  } catch {
    tools = [];
  }

  // Resolve tool filter slug → id
  let toolId: string | null | undefined = undefined; // undefined = no filter, null = All Access, string = per-tool
  let toolFilterValid = true;
  if (tool) {
    if (tool === "all-access") {
      toolId = null; // signifies All Access
    } else {
      const found = tools.find((t) => t.slug === tool);
      if (found) {
        const { data: toolRow } = await admin.from("tools").select("id").eq("slug", tool).maybeSingle();
        toolId = (toolRow as { id: string } | null)?.id ?? null;
        if (!toolId) toolFilterValid = false;
      } else {
        toolFilterValid = false;
      }
    }
  }

  // Organization search: resolve q → organization ids via two-step to avoid ilike on entitlements
  let orgIdsForSearch: string[] | null = null; // null = no filter
  if (q) {
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const { data: orgs, error } = await admin
      .from("organizations")
      .select("id")
      .or(`name.ilike.${like},slug.ilike.${like}`)
      .limit(200);
    if (error) {
      return {
        items: [],
        total: null,
        totalError: "Unable to load entitlements.",
        page,
        pageSize,
        query: q,
        tool,
        status,
        hasMore: false,
        tools,
      };
    }
    const ids = ((orgs ?? []) as Array<{ id: string }>).map((o) => o.id);
    if (ids.length === 0) {
      return {
        items: [],
        total: 0,
        page,
        pageSize,
        query: q,
        tool,
        status,
        hasMore: false,
        tools,
      };
    }
    orgIdsForSearch = ids;
  }

  if (!toolFilterValid) {
    return {
      items: [],
      total: 0,
      page,
      pageSize,
      query: q,
      tool,
      status,
      hasMore: false,
      tools,
    };
  }

  // Total count with filters
  let total: number | null = null;
  let totalError: string | undefined;
  try {
    const countQ = admin.from("tool_entitlements").select("id", { count: "exact", head: true }) as unknown as never;
    // apply filters via any
    const filtered = (() => {
      let cur: unknown = countQ;
      if (tool) {
        if (toolId === null) cur = (cur as never as { eq: (c:string,v:boolean)=>never }).eq("is_all_access", true);
        else if (toolId) {
          cur = (cur as never as { eq: (c:string,v:string)=>never }).eq("tool_id", toolId);
          cur = (cur as never as { eq: (c:string,v:boolean)=>never }).eq("is_all_access", false);
        }
      }
      if (status === "active") cur = (cur as never as { or: (s:string)=>never }).or(`expires_at.is.null,expires_at.gt.${serverNowIso}`);
      else if (status === "expired") {
        cur = (cur as never as { not: (c:string,op:string,v:unknown)=>never }).not("expires_at","is",null);
        cur = (cur as never as { lte: (c:string,v:string)=>never }).lte("expires_at", serverNowIso);
      }
      if (orgIdsForSearch) cur = (cur as never as { in: (c:string,v:string[])=>never }).in("organization_id", orgIdsForSearch);
      return cur as never as { then: (on:any)=>Promise<{count:number|null,error:unknown}> };
    })();
    const { count, error } = (await (filtered as unknown as Promise<{ count: number | null; error: unknown }>)) as { count: number | null; error: unknown };
    if (error) throw error;
    total = count ?? 0;
  } catch {
    totalError = "Unable to load entitlements.";
  }

  // Data page
  let items: AdminEntitlementItem[] = [];
  try {
    let dataQ = admin
      .from("tool_entitlements")
      .select("id, organization_id, tool_id, is_all_access, expires_at, source, created_at")
      .order("created_at", { ascending: false })
      .range(from, to) as unknown as never;

    if (tool) {
      if (toolId === null) dataQ = (dataQ as never as { eq: (c:string,v:boolean)=>never }).eq("is_all_access", true) as never;
      else if (toolId) {
        dataQ = (dataQ as never as { eq: (c:string,v:string)=>never }).eq("tool_id", toolId) as never;
        dataQ = (dataQ as never as { eq: (c:string,v:boolean)=>never }).eq("is_all_access", false) as never;
      }
    }
    if (status === "active") dataQ = (dataQ as never as { or: (s:string)=>never }).or(`expires_at.is.null,expires_at.gt.${serverNowIso}`) as never;
    else if (status === "expired") {
      dataQ = (dataQ as never as { not: (c:string,op:string,v:unknown)=>never }).not("expires_at","is",null) as never;
      dataQ = (dataQ as never as { lte: (c:string,v:string)=>never }).lte("expires_at", serverNowIso) as never;
    }
    if (orgIdsForSearch) dataQ = (dataQ as never as { in: (c:string,v:string[])=>never }).in("organization_id", orgIdsForSearch) as never;

    const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
      data: Array<{ id: string; organization_id: string; tool_id: string | null; is_all_access: boolean; expires_at: string | null; source: string; created_at: string }> | null;
      error: unknown;
    };
    if (error) throw error;

    const rows = data ?? [];
    if (rows.length === 0) {
      const hasMore = total !== null ? from + pageSize < total : false;
      return { items: [], total, totalError, page, pageSize, query: q, tool, status, hasMore, tools };
    }

    // Batch fetch organizations + tools
    const orgIds = [...new Set(rows.map((r) => r.organization_id))];
    const toolIds = [...new Set(rows.map((r) => r.tool_id).filter((v): v is string => Boolean(v)))];

    const [{ data: orgData }, { data: toolData }] = await Promise.all([
      orgIds.length
        ? admin.from("organizations").select("id, name, slug").in("id", orgIds)
        : Promise.resolve({ data: [], error: null } as never),
      toolIds.length
        ? admin.from("tools").select("id, slug, name").in("id", toolIds)
        : Promise.resolve({ data: [], error: null } as never),
    ]);

    const orgMap = new Map<string, { name: string; slug: string }>();
    for (const o of ((orgData ?? []) as Array<{ id: string; name: string; slug: string }>)) orgMap.set(o.id, { name: o.name, slug: o.slug });

    const toolMap = new Map<string, { slug: string; name: string }>();
    for (const t of ((toolData ?? []) as Array<{ id: string; slug: string; name: string }>)) toolMap.set(t.id, { slug: t.slug, name: t.name });

    const now = new Date(serverNowIso);
    items = rows.map((r) => {
      const isPermanent = r.expires_at === null;
      const isActive = isPermanent || new Date(r.expires_at as string) > now;
      // Detect inconsistent: is_all_access true must have tool_id null, false must have tool_id
      const inconsistent =
        (r.is_all_access && r.tool_id !== null) || (!r.is_all_access && r.tool_id === null && !isPermanent && false);
      // We display safe invalid state but don't mutate
      let toolName: string | null = null;
      let toolSlug: string | null = null;
      if (r.is_all_access) {
        toolName = "All Access";
        toolSlug = "all-access";
      } else if (r.tool_id) {
        const t = toolMap.get(r.tool_id);
        toolName = t?.name ?? "Unknown tool";
        toolSlug = t?.slug ?? null;
      }

      let status: "Active" | "Expired" | "Permanent" = "Active";
      if (isPermanent) status = "Permanent";
      else if (!isActive) status = "Expired";

      return {
        id: r.id,
        organizationId: r.organization_id,
        organizationName: orgMap.get(r.organization_id)?.name ?? "Unknown organization",
        organizationSlug: orgMap.get(r.organization_id)?.slug ?? "—",
        toolId: r.tool_id,
        toolName,
        toolSlug,
        isAllAccess: r.is_all_access,
        expiresAt: r.expires_at,
        source: r.source,
        status,
        isPermanent,
        isActive,
        createdAt: r.created_at,
      };
    });
  } catch {
    if (items.length === 0 && !totalError) totalError = "Unable to load entitlements.";
  }

  const hasMore = total !== null ? from + pageSize < total : items.length === pageSize;

  return { items, total, totalError, page, pageSize, query: q, tool, status, hasMore, tools };
}
