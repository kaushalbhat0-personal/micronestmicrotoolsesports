import type { SupabaseClient } from "@supabase/supabase-js";
import type { SponsorCampaign } from "@/types/database";

export type CreateCampaignInput = {
  organization_id: string;
  name: string;
  description?: string | null;
  status?: "draft" | "active" | "completed" | "archived";
  starts_at: string;
  ends_at: string;
};

export type UpdateCampaignInput = {
  name?: string;
  description?: string | null;
  status?: "draft" | "active" | "completed" | "archived";
  starts_at?: string;
  ends_at?: string;
};

export async function createSponsorCampaign(
  supabase: SupabaseClient,
  input: CreateCampaignInput,
): Promise<SponsorCampaign> {
  const { data, error } = await supabase
    .from("sponsor_campaigns")
    .insert({
      organization_id: input.organization_id,
      name: input.name,
      description: input.description ?? null,
      status: input.status ?? "draft",
      starts_at: input.starts_at,
      ends_at: input.ends_at,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as SponsorCampaign;
}

export async function findSponsorCampaignById(
  supabase: SupabaseClient,
  id: string,
): Promise<SponsorCampaign | null> {
  const { data, error } = await supabase
    .from("sponsor_campaigns")
    .select("id, organization_id, name, description, status, starts_at, ends_at")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as SponsorCampaign;
}

export async function listSponsorCampaignsByOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<SponsorCampaign[]> {
  const { data, error } = await supabase
    .from("sponsor_campaigns")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SponsorCampaign[];
}

export async function updateSponsorCampaign(
  supabase: SupabaseClient,
  id: string,
  input: UpdateCampaignInput,
): Promise<SponsorCampaign> {
  const { data, error } = await supabase.from("sponsor_campaigns").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data as SponsorCampaign;
}

export async function deleteSponsorCampaign(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("sponsor_campaigns").delete().eq("id", id);
  if (error) throw error;
}
