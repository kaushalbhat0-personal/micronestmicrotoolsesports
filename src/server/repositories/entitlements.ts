import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolEntitlement } from "@/types/database";

export async function listEntitlementsForOrg(supabase: SupabaseClient, organizationId: string) {
  const { data, error } = await supabase
    .from("tool_entitlements")
    .select("*, tool:tools(id, slug, name, description)")
    .eq("organization_id", organizationId);
  if (error) throw error;
  return data;
}

export async function hasEntitlement(
  supabase: SupabaseClient,
  organizationId: string,
  toolSlug: string
): Promise<boolean> {
  const { data, error } = await supabase.rpc("has_tool_access", {
    org_id: organizationId,
    tool_slug: toolSlug,
  });
  if (!error && typeof data === "boolean") return data;

  // Fallback if RPC not deployed yet
  const { data: tool } = await supabase.from("tools").select("id").eq("slug", toolSlug).single();
  if (!tool) return false;

  const { data: ents } = await supabase
    .from("tool_entitlements")
    .select("id, is_all_access, expires_at")
    .eq("organization_id", organizationId)
    .or(`is_all_access.eq.true,tool_id.eq.${tool.id}`);

  if (!ents || ents.length === 0) return false;
  return ents.some((e) => !e.expires_at || new Date(e.expires_at) > new Date());
}

export async function createEntitlement(
  supabase: SupabaseClient,
  input: Omit<ToolEntitlement, "id" | "created_at">
): Promise<ToolEntitlement> {
  const { data, error } = await supabase.from("tool_entitlements").insert(input).select("*").single();
  if (error) throw error;
  return data as ToolEntitlement;
}
