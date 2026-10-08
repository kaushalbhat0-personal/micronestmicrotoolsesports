import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AdminUserGrantItem {
  id: string;
  userId: string;
  email: string | null;
  displayName: string | null;
  toolSlug: string | null;
  toolName: string | null;
  source: string;
  expiresAt: string | null;
  status: "Active" | "Expired" | "Permanent";
  isPermanent: boolean;
  isActive: boolean;
  createdAt: string;
}

const MAX_ROWS = 100;
const MAX_QUERY_LEN = 100;

/**
 * Read-only user-scoped Sponsorship grants for Super Admin.
 * Keeps user grants visible without redesigning the organization-grant
 * console. No mutations, no impersonation.
 */
export async function getAdminUserGrants(query: string): Promise<{ items: AdminUserGrantItem[]; query: string }> {
  await requireSuperAdmin();
  const admin = createAdminClient();
  const q = query.trim().slice(0, MAX_QUERY_LEN);
  const serverNow = new Date();

  let userIds: string[] | null = null; // null = no filter
  if (q) {
    const like = `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
    const { data: profiles, error } = await admin
      .from("profiles")
      .select("id")
      .or(`email.ilike.${like},display_name.ilike.${like}`)
      .limit(200);
    if (error) return { items: [], query: q };
    userIds = ((profiles ?? []) as Array<{ id: string }>).map((p) => p.id);
    if (userIds.length === 0) return { items: [], query: q };
  }

  let grantsQuery = admin
    .from("user_tool_entitlements")
    .select("id, user_id, tool_id, source, expires_at, created_at, tool:tools(id, slug, name)")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  if (userIds) grantsQuery = grantsQuery.in("user_id", userIds);
  const { data: grants, error: grantsError } = await grantsQuery;
  if (grantsError) return { items: [], query: q };

  const rows = ((grants ?? []) as unknown) as Array<{
    id: string;
    user_id: string;
    source: string;
    expires_at: string | null;
    created_at: string;
    tool: { slug: string; name: string } | { slug: string; name: string }[] | null;
  }>;

  const profileIds = [...new Set(rows.map((r) => r.user_id))];
  let profilesById = new Map<string, { email: string | null; display_name: string | null }>();
  if (profileIds.length > 0) {
    const { data: profiles } = await admin.from("profiles").select("id, email, display_name").in("id", profileIds);
    profilesById = new Map(
      ((profiles ?? []) as Array<{ id: string; email: string | null; display_name: string | null }>).map((p) => [
        p.id,
        { email: p.email, display_name: p.display_name },
      ])
    );
  }

  const items = rows.map((r) => {
    const isPermanent = r.expires_at === null;
    const isActive = isPermanent || new Date(r.expires_at as string) > serverNow;
    const tool = Array.isArray(r.tool) ? (r.tool[0] ?? null) : r.tool;
    return {
      id: r.id,
      userId: r.user_id,
      email: profilesById.get(r.user_id)?.email ?? null,
      displayName: profilesById.get(r.user_id)?.display_name ?? null,
      toolSlug: tool?.slug ?? null,
      toolName: tool?.name ?? null,
      source: r.source,
      expiresAt: r.expires_at,
      status: (isPermanent ? "Permanent" : isActive ? "Active" : "Expired") as AdminUserGrantItem["status"],
      isPermanent,
      isActive,
      createdAt: r.created_at,
    };
  });

  return { items, query: q };
}
