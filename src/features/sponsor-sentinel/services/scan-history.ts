import type { SupabaseClient } from "@supabase/supabase-js";
import type { Scan } from "@/types/database";

export interface ScanHistoryItem {
  readonly scan: Scan;
  readonly campaignName: string | null;
  readonly evidenceCount: number;
  readonly evaluationSummary: Record<string, number>;
}

export interface ScanHistoryResult {
  readonly scans: readonly ScanHistoryItem[];
  readonly total: number;
}

const HISTORY_LIMIT = 50;

/**
 * Get scan history for an organization — organization-scoped, read-only.
 * - Uses trusted organizationId from requireOrganizationContext, never client input.
 * - Avoids N+1: 1 scan query + 1 campaign query + 1 evidence batch + 1 evaluation batch.
 * - Returns newest first, limited to HISTORY_LIMIT for MVP (dataset small, no silent infinite scroll).
 */
export async function getScanHistory(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<ScanHistoryResult> {
  // 1. Scans (constrained to org)
  const { data: scans, error: scanError } = await supabase
    .from("scans")
    .select("id, organization_id, campaign_id, platform, status, started_at, completed_at, scanner_version, error_code, error_message, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_LIMIT);

  if (scanError) throw scanError;
  const scanRows = (scans ?? []) as Scan[];
  if (scanRows.length === 0) return { scans: [], total: 0 };

  const campaignIds = [...new Set(scanRows.map((s) => s.campaign_id))];

  // 2. Campaign names (for display)
  const { data: campaigns } = await supabase
    .from("sponsor_campaigns")
    .select("id, name")
    .in("id", campaignIds);

  const campaignMap = new Map<string, string>();
  for (const c of (campaigns ?? []) as Array<{ id: string; name: string }>) {
    campaignMap.set(c.id, c.name);
  }

  // 3. Evidence counts batched by campaign_id (per-scan counts derived from campaign/platform if needed;
  //    for MVP we show per-campaign evidence total, not per-scan time window, to avoid expensive time-range joins)
  const { data: evidenceRows } = await supabase
    .from("evidence")
    .select("campaign_id, platform")
    .in("campaign_id", campaignIds);

  const evidenceCountByCampaign = new Map<string, number>();
  for (const e of (evidenceRows ?? []) as Array<{ campaign_id: string }>) {
    evidenceCountByCampaign.set(e.campaign_id, (evidenceCountByCampaign.get(e.campaign_id) ?? 0) + 1);
  }

  // 4. Evaluation summary batched via deliverables (evaluations has no campaign_id, only deliverable_id)
  // Fetch deliverables for these campaigns
  const { data: deliverableRows } = await supabase
    .from("deliverables")
    .select("id, campaign_id")
    .in("campaign_id", campaignIds);

  const deliverableIdToCampaign = new Map<string, string>();
  const deliverableIds: string[] = [];
  for (const d of (deliverableRows ?? []) as Array<{ id: string; campaign_id: string }>) {
    deliverableIdToCampaign.set(d.id, d.campaign_id);
    deliverableIds.push(d.id);
  }

  const evalSummaryByCampaign = new Map<string, Record<string, number>>();
  if (deliverableIds.length > 0) {
    const { data: evalRows } = await supabase
      .from("evaluations")
      .select("deliverable_id, result")
      .eq("organization_id", organizationId)
      .in("deliverable_id", deliverableIds);

    for (const ev of (evalRows ?? []) as Array<{ deliverable_id: string; result: string }>) {
      const campId = deliverableIdToCampaign.get(ev.deliverable_id);
      if (!campId) continue;
      const map = evalSummaryByCampaign.get(campId) ?? {};
      map[ev.result] = (map[ev.result] ?? 0) + 1;
      evalSummaryByCampaign.set(campId, map);
    }
  }

  // Fallback: if evaluation rows had no campaign_id (schema without it), we can fetch via deliverable → campaign join not needed for MVP;
  // show empty summaries instead of failing.

  const items: ScanHistoryItem[] = scanRows.map((scan) => ({
    scan,
    campaignName: campaignMap.get(scan.campaign_id) ?? null,
    evidenceCount: evidenceCountByCampaign.get(scan.campaign_id) ?? 0,
    evaluationSummary: evalSummaryByCampaign.get(scan.campaign_id) ?? {},
  }));

  return { scans: items, total: scanRows.length };
}
