import type { SupabaseClient } from "@supabase/supabase-js";
import type { Deliverable } from "@/types/database";

export type CreateDeliverableInput = {
  organization_id: string;
  campaign_id: string;
  name: string;
  description?: string | null;
  rule: unknown;
  status?: "active" | "paused" | "completed" | "archived";
};

export type UpdateDeliverableInput = {
  name?: string;
  description?: string | null;
  rule?: unknown;
  status?: "active" | "paused" | "completed" | "archived";
};

export async function createDeliverable(
  supabase: SupabaseClient,
  input: CreateDeliverableInput,
): Promise<Deliverable> {
  const { data, error } = await supabase
    .from("deliverables")
    .insert({
      organization_id: input.organization_id,
      campaign_id: input.campaign_id,
      name: input.name,
      description: input.description ?? null,
      rule: input.rule,
      status: input.status ?? "active",
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Deliverable;
}

export async function findDeliverableById(
  supabase: SupabaseClient,
  id: string,
): Promise<Deliverable | null> {
  const { data, error } = await supabase.from("deliverables").select("*").eq("id", id).single();
  if (error) return null;
  return data as Deliverable;
}

export async function listDeliverablesByCampaign(
  supabase: SupabaseClient,
  campaignId: string,
): Promise<Deliverable[]> {
  const { data, error } = await supabase
    .from("deliverables")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Deliverable[];
}

export async function updateDeliverable(
  supabase: SupabaseClient,
  id: string,
  input: UpdateDeliverableInput,
): Promise<Deliverable> {
  const { data, error } = await supabase.from("deliverables").update(input).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Deliverable;
}

export async function deleteDeliverable(supabase: SupabaseClient, id: string): Promise<void> {
  const { error } = await supabase.from("deliverables").delete().eq("id", id);
  if (error) throw error;
}
