import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface UserListItem {
  id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  organizationCount: number;
  organizations: Array<{ id: string; name: string; slug: string }>;
}

export interface UsersResult {
  items: UserListItem[];
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
  if (page > 1000) page = 1000;
  return { q, page, pageSize: PAGE_SIZE };
}

/**
 * Read-only users for Super Admin — uses profiles (safe source), never auth.users directly.
 * Batched organization memberships, no N+1.
 */
export async function getAdminUsers(searchParams: Record<string, string | string[] | undefined>): Promise<UsersResult> {
  await requireSuperAdmin();
  const { q, page, pageSize } = parseParams(searchParams);
  const admin = createAdminClient();

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let total: number | null = null;
  let totalError: string | undefined;

  try {
    let countQuery = admin.from("profiles").select("id", { count: "exact", head: true });
    if (q) {
      const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      countQuery = countQuery.or(`email.ilike.${like},display_name.ilike.${like}`);
    }
    const { count, error } = await countQuery;
    if (error) throw error;
    total = count ?? 0;
  } catch {
    totalError = "Unable to load users.";
  }

  let items: UserListItem[] = [];
  try {
    let dataQuery = admin
      .from("profiles")
      .select("id, email, display_name, avatar_url, created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (q) {
      const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
      dataQuery = dataQuery.or(`email.ilike.${like},display_name.ilike.${like}`);
    }

    const { data, error } = await dataQuery;
    if (error) throw error;

    const profiles = (data ?? []) as Array<{ id: string; email: string | null; display_name: string | null; avatar_url: string | null; created_at: string }>;

    if (profiles.length > 0) {
      const ids = profiles.map((p) => p.id);
      // Batched membership lookup — single query for page
      const { data: memberships, error: memError } = await admin
        .from("organization_members")
        .select("user_id, organization_id, organization:organizations(id, name, slug)")
        .in("user_id", ids);

      if (memError) throw memError;

      const grouped = new Map<string, Array<{ id: string; name: string; slug: string }>>();
      for (const m of (memberships ?? []) as unknown as Array<{
        user_id: string;
        organization: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
        organization_id: string;
      }>) {
        const orgRaw = m.organization;
        const org = Array.isArray(orgRaw) ? orgRaw[0] : orgRaw;
        if (!org) continue;
        const list = grouped.get(m.user_id) ?? [];
        list.push({ id: org.id, name: org.name, slug: org.slug });
        grouped.set(m.user_id, list);
      }

      items = profiles.map((p) => {
        const orgs = grouped.get(p.id) ?? [];
        return {
          id: p.id,
          email: p.email,
          display_name: p.display_name,
          avatar_url: p.avatar_url,
          created_at: p.created_at,
          organizationCount: orgs.length,
          organizations: orgs,
        };
      });
    }
  } catch {
    if (items.length === 0 && !totalError) {
      totalError = "Unable to load users.";
    }
  }

  const hasMore = total !== null ? from + pageSize < total : items.length === pageSize;

  return { items, total, totalError, page, pageSize, query: q, hasMore };
}
