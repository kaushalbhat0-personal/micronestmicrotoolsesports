import type { SupabaseClient } from "@supabase/supabase-js";
import type { UserToolEntitlement } from "@/types/database";

/**
 * Repository: user_tool_entitlements table.
 * Thin data access only. The sponsorship-only fence lives in the service
 * layer; this module never decides which tools may be user-granted.
 * Writes are RLS-denied for authenticated clients — callers must use a
 * service-role client (billing provisioning, super-admin tooling).
 */

export async function findUserGrant(
  supabase: SupabaseClient,
  userId: string,
  toolId: string
): Promise<UserToolEntitlement | null> {
  const { data, error } = await supabase
    .from("user_tool_entitlements")
    .select("*")
    .eq("user_id", userId)
    .eq("tool_id", toolId)
    .maybeSingle();
  if (error) throw error;
  return (data as UserToolEntitlement | null) ?? null;
}

export async function listUserGrants(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("user_tool_entitlements")
    .select("id, user_id, tool_id, source, expires_at, created_at, tool:tools(id, slug, name)")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

export async function createUserGrant(
  supabase: SupabaseClient,
  input: { user_id: string; tool_id: string; source: UserToolEntitlement["source"]; expires_at: string | null }
): Promise<UserToolEntitlement> {
  const { data, error } = await supabase.from("user_tool_entitlements").insert(input).select("*").single();
  if (error) throw error;
  return data as UserToolEntitlement;
}

export async function deleteUserGrant(supabase: SupabaseClient, userId: string, toolId: string): Promise<void> {
  const { error } = await supabase
    .from("user_tool_entitlements")
    .delete()
    .eq("user_id", userId)
    .eq("tool_id", toolId);
  if (error) throw error;
}
