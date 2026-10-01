import type { SupabaseClient } from "@supabase/supabase-js";
import { notFoundError } from "@/lib/errors";
import type { Scan, Evidence, Evaluation } from "@/types/database";
import { findScanById } from "@/server/repositories/scans";
import { listEvidenceByScan } from "@/server/repositories/evidence";
import { listEvaluationsByScan } from "@/server/repositories/evaluations";

export interface ScanDetail {
  readonly scan: Scan;
  readonly campaignName: string | null;
  readonly evidence: readonly Evidence[];
  readonly evaluations: readonly Evaluation[];
  readonly evaluationSummary: Record<string, number>;
  readonly deliverableMap: ReadonlyMap<string, { name: string; rule: unknown }>;
}

export async function getScanDetail(
  supabase: SupabaseClient,
  organizationId: string,
  scanId: string,
): Promise<ScanDetail> {
  const scan = await findScanById(supabase, scanId);
  if (!scan) throw notFoundError("Scan not found");
  if (scan.organization_id !== organizationId) throw notFoundError("Scan not found");

  // Fetch campaign name
  let campaignName: string | null = null;
  const { data: campaignData } = await supabase.from("sponsor_campaigns").select("name").eq("id", scan.campaign_id).single();
  if (campaignData && typeof (campaignData as { name?: string }).name === "string") {
    campaignName = (campaignData as { name: string }).name;
  }

  // Per-scan evidence (exact attribution via scan_id) — projection now includes organization_id/scan_id (P1 fix 07B)
  const evidence = await listEvidenceByScan(supabase, scanId);
  // Defense-in-depth tenant filter: DB RLS already scopes to org, but filter here catches cross-tenant misuse.
  // Now correct because listEvidenceByScan projects organization_id/scan_id.
  const filteredEvidence = evidence.filter(
    (e) => e.organization_id === organizationId && e.scan_id === scanId,
  );

  // Per-scan evaluations via scan_id — projection now includes organization_id/scan_id
  const evaluations = await listEvaluationsByScan(supabase, scanId);
  const filteredEvals = evaluations.filter(
    (ev) => ev.organization_id === organizationId && ev.scan_id === scanId,
  );

  const evaluationSummary: Record<string, number> = {};
  for (const ev of filteredEvals) {
    evaluationSummary[ev.result] = (evaluationSummary[ev.result] ?? 0) + 1;
  }

  // Deliverable names for display
  const { data: deliverableRows } = await supabase
    .from("deliverables")
    .select("id, name, rule")
    .eq("campaign_id", scan.campaign_id);
  const deliverableMap = new Map<string, { name: string; rule: unknown }>();
  for (const d of (deliverableRows ?? []) as Array<{ id: string; name: string; rule: unknown }>) {
    deliverableMap.set(d.id, { name: d.name, rule: d.rule });
  }

  return {
    scan,
    campaignName,
    evidence: filteredEvidence,
    evaluations: filteredEvals,
    evaluationSummary,
    deliverableMap,
  };
}
