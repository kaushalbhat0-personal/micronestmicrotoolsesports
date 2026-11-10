import type { SupabaseClient } from "@supabase/supabase-js";
import type { Organization } from "@/types/database";

/**
 * Repository: organizations table
 * All queries are tenant-safe via RLS, but caller must still authorize via membership checks where needed.
 */

export async function findOrganizationById(supabase: SupabaseClient, id: string): Promise<Organization | null> {
  const { data, error } = await supabase.from("organizations").select("*").eq("id", id).single();
  if (error) return null;
  return data as Organization;
}

export async function findOrganizationBySlug(supabase: SupabaseClient, slug: string): Promise<Organization | null> {
  const { data, error } = await supabase.from("organizations").select("*").eq("slug", slug).single();
  if (error) return null;
  return data as Organization;
}

export async function createOrganization(
  supabase: SupabaseClient,
  input: { name: string; slug: string; owner_id: string }
): Promise<Organization> {
  const { data, error } = await supabase.from("organizations").insert(input).select("*").single();
  if (error) throw error;
  return data as Organization;
}

export async function listOrganizationsForUser(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("organization_members")
    .select("role, organization:organizations(*)")
    .eq("user_id", userId);
  if (error) throw error;
  return data;
}

/**
 * Find organization by slug with membership — minimal fields for context.
 * Returns null if org not found or user not member (RLS will filter).
 */
export async function findOrganizationContext(
  supabase: SupabaseClient,
  orgSlug: string,
  userId: string
): Promise<{ organization: { id: string; name: string; slug: string }; membership: { id: string; role: string } } | null> {
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("slug", orgSlug)
    .single();
  if (orgError || !org) return null;

  const { data: membership, error: memError } = await supabase
    .from("organization_members")
    .select("id, role")
    .eq("organization_id", org.id)
    .eq("user_id", userId)
    .single();
  if (memError || !membership) return null;

  return { organization: org, membership };
}
