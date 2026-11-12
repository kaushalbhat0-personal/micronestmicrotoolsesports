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
 * - Avoids N+1: 1 scan query + 1 count query + 1 campaign query + 1 evidence batch + 1 evaluation batch.
 * - Returns newest first, limited to HISTORY_LIMIT for MVP (dataset small, no silent infinite scroll).
 * - `total` is the true org-wide scan count so "Showing X of Y" stays honest when capped.
 * - Free tier: `historyWindowDays` applies a non-destructive read window
 *   (created_at >= now() - window). Older rows stay in the database and
 *   re-appear on upgrade. Null/undefined = full retained history (paid).
 */
export async function getScanHistory(
  supabase: SupabaseClient,
  organizationId: string,
  opts?: { historyWindowDays?: number | null },
): Promise<ScanHistoryResult> {
  const windowDays = opts?.historyWindowDays;
  const cutoff = typeof windowDays === "number" && windowDays >= 0
    ? new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString()
    : null;
  // 1. Scans (constrained to org) + true total for the honest "Showing X of Y" label.
  // The count is a single head query — no per-row/per-scan fan-out.
  const pageQuery = supabase
    .from("scans")
    .select("id, organization_id, campaign_id, platform, status, started_at, completed_at, scanner_version, error_code, error_message, created_at")
    .eq("organization_id", organizationId);
  const windowedPageQuery = cutoff ? pageQuery.gte("created_at", cutoff) : pageQuery;
  const countQuery = supabase.from("scans").select("id", { count: "exact", head: true }).eq("organization_id", organizationId);
  const windowedCountQuery = cutoff ? countQuery.gte("created_at", cutoff) : countQuery;
  const [pageRes, countRes] = await Promise.all([
    windowedPageQuery.order("created_at", { ascending: false }).limit(HISTORY_LIMIT),
    windowedCountQuery,
  ]);

  const { data: scans, error: scanError } = pageRes;
  const exactTotal = typeof (countRes as { count?: unknown }).count === "number" ? (countRes as { count: number }).count : null;

  if (scanError) throw scanError;
  const scanRows = (scans ?? []) as Scan[];
  if (scanRows.length === 0) return { scans: [], total: exactTotal ?? 0 };

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

  // 3. Evidence counts — per-scan via scan_id (07B fix, replaces campaign aggregation)
  // Avoids N+1: single batched query for all scanIds in this page.
  // Explicit tenant filter defense-in-depth (matches evaluations query).
  const scanIds = scanRows.map((s) => s.id);
  const { data: evidenceRows } = await supabase
    .from("evidence")
    .select("scan_id")
    .eq("organization_id", organizationId)
    .in("scan_id", scanIds);

  const evidenceCountByScan = new Map<string, number>();
  for (const e of (evidenceRows ?? []) as Array<{ scan_id: string | null }>) {
    if (!e.scan_id) continue; // historical NULL scan_id not attributed to any scan
    if (!scanIds.includes(e.scan_id)) continue;
    evidenceCountByScan.set(e.scan_id, (evidenceCountByScan.get(e.scan_id) ?? 0) + 1);
  }

  // 4. Evaluation summary — per-scan via scan_id (denormalized, direct)
  // Uses evaluations.scan_id added in 20251003000001; no deliverable→campaign join needed.
  const evalSummaryByScan = new Map<string, Record<string, number>>();
  // Guard: Supabase .in() with empty array would error; scanIds is non-empty here.
  const { data: evalRows } = await supabase
    .from("evaluations")
    .select("scan_id, result")
    .eq("organization_id", organizationId)
    .in("scan_id", scanIds);

  for (const ev of (evalRows ?? []) as Array<{ scan_id: string | null; result: string }>) {
    if (!ev.scan_id) continue; // historical NULL
    if (!scanIds.includes(ev.scan_id)) continue;
    const map = evalSummaryByScan.get(ev.scan_id) ?? {};
    map[ev.result] = (map[ev.result] ?? 0) + 1;
    evalSummaryByScan.set(ev.scan_id, map);
  }

  const items: ScanHistoryItem[] = scanRows.map((scan) => ({
    scan,
    campaignName: campaignMap.get(scan.campaign_id) ?? null,
    evidenceCount: evidenceCountByScan.get(scan.id) ?? 0,
    evaluationSummary: evalSummaryByScan.get(scan.id) ?? {},
  }));

  return { scans: items, total: exactTotal ?? scanRows.length };
}
