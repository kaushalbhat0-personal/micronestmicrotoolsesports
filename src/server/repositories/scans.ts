import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scan } from "@/types/database";

export type CreateScanInput = {
  organization_id: string;
  campaign_id: string;
  platform: "twitch" | "youtube" | "kick";
  status?: Scan["status"];
  started_at?: string;
  completed_at?: string | null;
  scanner_version: string;
  error_code?: string | null;
  error_message?: string | null;
};

export async function createScan(supabase: SupabaseClient, input: CreateScanInput): Promise<Scan> {
  const { data, error } = await supabase
    .from("scans")
    .insert({
      organization_id: input.organization_id,
      campaign_id: input.campaign_id,
      platform: input.platform,
      status: input.status ?? "pending",
      started_at: input.started_at ?? new Date().toISOString(),
      completed_at: input.completed_at ?? null,
      scanner_version: input.scanner_version,
      error_code: input.error_code ?? null,
      error_message: input.error_message ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Scan;
}

export async function findScanById(supabase: SupabaseClient, id: string): Promise<Scan | null> {
  const { data, error } = await supabase.from("scans").select("*").eq("id", id).single();
  if (error) return null;
  return data as Scan;
}

export async function listScansByOrg(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Scan[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Scan[];
}

export async function listScansByCampaign(
  supabase: SupabaseClient,
  organizationId: string,
  campaignId: string,
  limit: number = 5,
): Promise<Scan[]> {
  const { data, error } = await supabase
    .from("scans")
    .select("id, campaign_id, organization_id, platform, status, started_at, completed_at, created_at")
    .eq("organization_id", organizationId)
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as Scan[];
}

export async function updateScanStatus(
  supabase: SupabaseClient,
  id: string,
  patch: { status: Scan["status"]; completed_at?: string | null; error_code?: string | null; error_message?: string | null },
): Promise<Scan> {
  const { data, error } = await supabase.from("scans").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Scan;
}

export async function updateScanPlatform(
  supabase: SupabaseClient,
  id: string,
  platform: "twitch" | "youtube" | "kick",
): Promise<Scan> {
  const { data, error } = await supabase.from("scans").update({ platform }).eq("id", id).select("*").single();
  if (error) throw error;
  return data as Scan;
}
