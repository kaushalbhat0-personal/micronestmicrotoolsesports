import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface OrganizationListItem {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  memberCount: number;
}

export interface OrganizationsResult {
  items: OrganizationListItem[];
  total: number | null;
  totalError?: string | undefined;
  page: number;
  pageSize: number;
  query: string;
  hasMore: boolean;
}

const PAGE_SIZE = 50;
const MAX_QUERY_LEN = 100;

function parseParams(searchParams: Record<string, string | string[] | undefined>) {
  const rawQ = typeof searchParams.q === "string" ? searchParams.q : Array.isArray(searchParams.q) ? searchParams.q[0] : "";
  const q = (rawQ ?? "").trim().slice(0, MAX_QUERY_LEN);
  const rawPage = typeof searchParams.page === "string" ? searchParams.page : Array.isArray(searchParams.page) ? searchParams.page[0] : "1";
  let page = parseInt(rawPage ?? "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  // Bound page to prevent huge offset
  if (page > 1000) page = 1000;
  return { q, page, pageSize: PAGE_SIZE };
}

/**
 * Read-only organizations for Super Admin.
 * No mutations. Batched member counts, no N+1.
 */
export async function getAdminOrganizations(searchParams: Record<string, string | string[] | undefined>): Promise<OrganizationsResult> {
  await requireSuperAdmin();
  const { q, page, pageSize } = parseParams(searchParams);
  const admin = createAdminClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Build base query with search
  let total: number | null = null;
  let totalError: string | undefined;

  try {
    // Count query — exact count with same filter
    let countQuery = admin.from("organizations").select("id", { count: "exact", head: true });
    if (q) {
      const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      countQuery = countQuery.or(`name.ilike.${like},slug.ilike.${like}`);
    }
    const { count, error } = await countQuery;
    if (error) throw error;
    total = count ?? 0;
  } catch {
    totalError = "Unable to load organizations.";
  }

  // Data query
  let items: OrganizationListItem[] = [];
  try {
    let dataQuery = admin
      .from("organizations")
      .select("id, name, slug, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) {
      const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      dataQuery = dataQuery.or(`name.ilike.${like},slug.ilike.${like}`);
    }

    const { data, error } = await dataQuery;
    if (error) throw error;

    const orgs = (data ?? []) as Array<{ id: string; name: string; slug: string; created_at: string }>;

    // Batched member counts — single query for current page ids
    if (orgs.length > 0) {
      const ids = orgs.map((o) => o.id);
      const { data: memberships, error: memError } = await admin
        .from("organization_members")
        .select("organization_id")
        .in("organization_id", ids);

      if (memError) throw memError;

      const counts = new Map<string, number>();
      for (const m of (memberships ?? []) as Array<{ organization_id: string }>) {
        counts.set(m.organization_id, (counts.get(m.organization_id) ?? 0) + 1);
      }

      items = orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        created_at: o.created_at,
        memberCount: counts.get(o.id) ?? 0,
      }));
    }
  } catch {
    // Distinguish error from empty — return empty array but caller will show error if items empty and totalError?
    // Let items remain [] and signal via totalError; page will show error banner
    if (items.length === 0 && !totalError) {
      totalError = "Unable to load organizations.";
    }
  }

  const hasMore = total !== null ? from + pageSize < total : items.length === pageSize;

  return { items, total, totalError, page, pageSize, query: q, hasMore };
}
