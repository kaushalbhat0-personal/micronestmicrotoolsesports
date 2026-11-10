import type { SupabaseClient } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

/**
 * Repository: profiles table
 * Thin data access only — authorization lives in services (membership checks)
 * and RLS (own-row confinement). No business logic here.
 */

export async function findProfileById(supabase: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error) return null;
  return data as Profile;
}

/**
 * Update only the caller's Primary Workspace preference.
 * RLS policy "profiles_update_own" confines this to the caller's own row;
 * the service layer additionally requires membership in the target org.
 */
export async function updatePrimaryOrganizationId(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string | null
): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .update({ primary_organization_id: organizationId })
    .eq("id", userId)
    .select("*")
    .single();
  if (error) throw error;
  return data as Profile;
}

/** Oldest membership organization for fallback display — never persisted by callers. */
export async function findOldestMembershipOrganization(
  supabase: SupabaseClient,
  userId: string
): Promise<{ id: string; name: string; slug: string } | null> {
  const { data, error } = await supabase
    .from("organization_members")
    .select("organization:organizations(id, name, slug)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { organization: { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null }).organization;
  const org = Array.isArray(raw) ? raw[0] : raw;
  return org ?? null;
}
