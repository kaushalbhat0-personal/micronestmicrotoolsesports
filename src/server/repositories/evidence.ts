import type { SupabaseClient } from "@supabase/supabase-js";
import type { Evidence } from "@/types/database";

export type CreateEvidenceInput = {
  organization_id: string;
  campaign_id: string;
  deliverable_id: string;
  platform: "twitch" | "youtube" | "kick";
  external_channel_id: string;
  external_content_id?: string | null;
  evidence_type: "live_stream" | "video";
  source: Evidence["source"];
  source_id: string;
  source_url?: string | null;
  observed_at: string;
  observed_value: string;
  normalized_value: string;
  raw_ref?: unknown | null;
  scanner_version: string;
  scan_id?: string | null;
};

export async function createEvidence(
  supabase: SupabaseClient,
  input: CreateEvidenceInput,
): Promise<Evidence> {
  const { data, error } = await supabase
    .from("evidence")
    .insert({
      organization_id: input.organization_id,
      campaign_id: input.campaign_id,
      deliverable_id: input.deliverable_id,
      platform: input.platform,
      external_channel_id: input.external_channel_id,
      external_content_id: input.external_content_id ?? null,
      evidence_type: input.evidence_type,
      source: input.source,
      source_id: input.source_id,
      source_url: input.source_url ?? null,
      observed_at: input.observed_at,
      observed_value: input.observed_value,
      normalized_value: input.normalized_value,
      raw_ref: input.raw_ref ?? null,
      scanner_version: input.scanner_version,
      scan_id: input.scan_id ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as Evidence;
}

export async function findEvidenceById(
  supabase: SupabaseClient,
  id: string,
): Promise<Evidence | null> {
  const { data, error } = await supabase.from("evidence").select("*").eq("id", id).single();
  if (error) return null;
  return data as Evidence;
}

export async function listEvidenceByDeliverable(
  supabase: SupabaseClient,
  deliverableId: string,
): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select("*")
    .eq("deliverable_id", deliverableId)
    .order("observed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Evidence[];
}

export async function listEvidenceByScan(
  supabase: SupabaseClient,
  scanId: string,
): Promise<Evidence[]> {
  const { data, error } = await supabase
    .from("evidence")
    .select(
      "id, organization_id, campaign_id, deliverable_id, scan_id, platform, external_channel_id, external_content_id, evidence_type, source, source_id, source_url, observed_value, observed_at, normalized_value, scanner_version, created_at",
    )
    .eq("scan_id", scanId)
    .order("observed_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Evidence[];
}
