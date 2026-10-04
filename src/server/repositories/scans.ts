import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scan } from "@/types/database";
import { AppError } from "@/lib/errors";

export const SCAN_STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes
export const SCAN_ALREADY_RUNNING_CODE = "CONFLICT" as const;

export async function expireStaleScans(supabase: SupabaseClient, campaignId: string): Promise<number> {
  try {
    if (!supabase || typeof (supabase as unknown as { from?: unknown }).from !== "function") return 0;
    const threshold = new Date(Date.now() - SCAN_STALE_THRESHOLD_MS).toISOString();
    const { data, error } = await (supabase as unknown as { from: (t: string) => { update: (p: unknown) => { eq: (k: string, v: unknown) => { in: (k: string, v: unknown[]) => { lt: (k: string, v: string) => { select: (s: string) => Promise<{ data: unknown[] | null; error: unknown }> } } } } } }).from("scans")
      .update({ status: "failed", completed_at: new Date().toISOString(), error_code: "stale_timeout", error_message: "Scan expired: stale pending/running beyond threshold" } as never)
      .eq("campaign_id", campaignId)
      .in("status", ["pending", "running"] as never[])
      .lt("started_at", threshold)
      .select("id");
    if (error) return 0;
    return (data as unknown[] | null)?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function findActiveScanForCampaign(supabase: SupabaseClient, campaignId: string): Promise<Scan | null> {
  const { data, error } = await supabase
    .from("scans")
    .select("*")
    .eq("campaign_id", campaignId)
    .in("status", ["pending", "running"] as never[])
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return data as Scan;
}

export async function tryCreateScanWithLock(supabase: SupabaseClient, input: CreateScanInput): Promise<Scan> {
  try {
    await expireStaleScans(supabase, input.campaign_id);
  } catch {
    // ignore stale cleanup errors in tests
  }
  try {
    // Use dynamic import so vi.spyOn(scanRepo, "createScan") mocks are respected
    const mod = await import("./scans");
    const fn = (mod.createScan as unknown as typeof createScan) ?? createScan;
    return await fn(supabase, input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const code = (e as { code?: string })?.code;
    // Postgres unique violation 23505 or message containing duplicate
    if (code === "23505" || msg.includes("duplicate") || msg.includes("unique") || msg.includes("scans_campaign_active_unique")) {
      throw new AppError({ code: SCAN_ALREADY_RUNNING_CODE, status: 409, message: "A check is already running for this campaign. Please wait a moment and try again." });
    }
    throw e;
  }
}

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
