import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EVIDENCE_RETENTION_DAYS,
  RETENTION_BATCH_SIZE,
  SCANS_RETENTION_DAYS,
  WEBHOOK_RETENTION_DAYS,
} from "./retention-config";

export interface RetentionSummary {
  readonly organizationsProcessed: number;
  readonly deletedScans: number;
  readonly deletedEvidence: number;
  readonly deletedEvaluations: number;
  readonly deletedWebhookEvents: number;
}

function retentionThreshold(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

function sanitizeError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  return raw.replace(/Bearer\s+[^\s]+/gi, "Bearer ***").slice(0, 200);
}

function classifyError(e: unknown): string {
  const maybe = e as { code?: string; status?: number };
  if (typeof maybe.code === "string") return maybe.code;
  if (typeof maybe.status === "number" && maybe.status >= 500) return "server";
  return "unknown";
}

export async function runRetention(
  supabase: SupabaseClient,
  opts?: { cronRunId?: string },
): Promise<RetentionSummary> {
  const cronRunId = opts?.cronRunId;
  const start = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();

  console.warn(JSON.stringify({ event: "sentinel_retention_started", cronRunId, startedAt: new Date().toISOString() }));

  // Discover organizations that have retention-candidate data — distinct orgs from scans/evidence
  // For MVP we process per-organization sequentially to maintain tenant isolation and bounded batches.
  const { data: orgRows, error: orgError } = await supabase.from("scans").select("organization_id").limit(1000);
  if (orgError) throw orgError;
  const orgIds = [...new Set((orgRows ?? []).map((r) => (r as { organization_id: string }).organization_id))];

  // Also include orgs that may have only evidence with null scan_id (historical)
  const { data: histEvidenceOrgs } = await supabase.from("evidence").select("organization_id").is("scan_id", null).limit(1000);
  for (const r of (histEvidenceOrgs ?? []) as Array<{ organization_id: string }>) {
    if (!orgIds.includes(r.organization_id)) orgIds.push(r.organization_id);
  }
  // Include webhook_events orgs (nullable) — only those with org_id
  const { data: webhookOrgs } = await supabase.from("webhook_events").select("organization_id").not("organization_id", "is", null).limit(1000);
  for (const r of (webhookOrgs ?? []) as Array<{ organization_id: string }>) {
    if (!orgIds.includes(r.organization_id)) orgIds.push(r.organization_id);
  }

  let deletedScans = 0;
  let deletedEvidence = 0;
  let deletedEvaluations = 0;
  let deletedWebhookEvents = 0;
  let organizationsProcessed = 0;

  for (const organizationId of orgIds) {
    const orgStart = typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    try {
      const res = await runRetentionForOrganization(supabase, organizationId, cronRunId);
      deletedScans += res.deletedScans;
      deletedEvidence += res.deletedEvidence;
      deletedEvaluations += res.deletedEvaluations;
      deletedWebhookEvents += res.deletedWebhookEvents;
      organizationsProcessed++;
      const dur = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - orgStart);
      console.warn(JSON.stringify({ event: "sentinel_retention_org_completed", cronRunId, organizationId, durationMs: dur, ...res }));
    } catch (e) {
      const dur = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - orgStart);
      const errorKind = classifyError(e);
      const msg = sanitizeError(e);
      console.warn(JSON.stringify({ event: "sentinel_retention_org_failed", cronRunId, organizationId, durationMs: dur, errorKind, error: msg }));
      throw e; // Fail fast: do not falsely report ok:true
    }
  }

  // Also handle historical NULL scan_id evidence/evaluations that may belong to orgs not in scans list (already included via histEvidenceOrgs)
  // Webhook events for org_id null (system) are not tenant-scoped; we clean them globally once
  try {
    const webhookGlobal = await deleteExpiredWebhookEventsForNullOrg(supabase);
    deletedWebhookEvents += webhookGlobal;
  } catch (e) {
    const msg = sanitizeError(e);
    console.warn(JSON.stringify({ event: "sentinel_retention_webhook_global_failed", cronRunId, error: msg }));
    throw e;
  }

  const durationMs = Math.round((typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now()) - start);
  console.warn(
    JSON.stringify({
      event: "sentinel_retention_completed",
      cronRunId,
      durationMs,
      organizationsProcessed,
      deletedScans,
      deletedEvidence,
      deletedEvaluations,
      deletedWebhookEvents,
    }),
  );

  return { organizationsProcessed, deletedScans, deletedEvidence, deletedEvaluations, deletedWebhookEvents };
}

async function runRetentionForOrganization(
  supabase: SupabaseClient,
  organizationId: string,
  cronRunId?: string,
): Promise<{ deletedScans: number; deletedEvidence: number; deletedEvaluations: number; deletedWebhookEvents: number }> {
  let deletedScans = 0;
  let deletedEvidence = 0;
  let deletedEvaluations = 0;
  let deletedWebhookEvents = 0;

  // 1. Select expired scan IDs (bounded)
  const scanThreshold = retentionThreshold(SCANS_RETENTION_DAYS);
  const { data: expiredScans, error: scanErr } = await supabase
    .from("scans")
    .select("id")
    .eq("organization_id", organizationId)
    .in("status", ["success", "partial", "failed"])
    .lt("completed_at", scanThreshold)
    .order("completed_at", { ascending: true })
    .limit(RETENTION_BATCH_SIZE);

  if (scanErr) throw scanErr;
  const expiredScanIds = ((expiredScans ?? []) as Array<{ id: string }>).map((r) => r.id);

  if (expiredScanIds.length > 0) {
    // 2. Delete evaluations for those scans (must be before evidence)
    const { error: evalErr, count: evalCount } = (await supabase
      .from("evaluations")
      .delete({ count: "exact" })
      .eq("organization_id", organizationId)
      .in("scan_id", expiredScanIds)) as unknown as { error: unknown; count: number | null };
    if (evalErr) throw evalErr;
    deletedEvaluations += evalCount ?? 0;

    // 3. Delete evidence for those scans
    const { error: evErr, count: evCount } = (await supabase
      .from("evidence")
      .delete({ count: "exact" })
      .eq("organization_id", organizationId)
      .in("scan_id", expiredScanIds)) as unknown as { error: unknown; count: number | null };
    if (evErr) throw evErr;
    deletedEvidence += evCount ?? 0;

    // 4. Delete scans
    const { error: scanDelErr, count: scanCount } = (await supabase
      .from("scans")
      .delete({ count: "exact" })
      .eq("organization_id", organizationId)
      .in("id", expiredScanIds)) as unknown as { error: unknown; count: number | null };
    if (scanDelErr) throw scanDelErr;
    deletedScans += scanCount ?? 0;

    if (cronRunId) {
      console.warn(JSON.stringify({ event: "sentinel_retention_scans_deleted", cronRunId, organizationId, deletedScans: scanCount, expiredScanIds: expiredScanIds.slice(0, 3) }));
    }
  }

  // 5. Historical NULL scan_id evidence: observed_at < 90d
  const evidenceThreshold = retentionThreshold(EVIDENCE_RETENTION_DAYS);
  // Need to delete evaluations for those evidence first
  // Find expired historical evidence ids
  const { data: histEvidence, error: histErr } = await supabase
    .from("evidence")
    .select("id")
    .eq("organization_id", organizationId)
    .is("scan_id", null)
    .lt("observed_at", evidenceThreshold)
    .limit(RETENTION_BATCH_SIZE);

  if (histErr) throw histErr;
  const histEvidenceIds = ((histEvidence ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (histEvidenceIds.length > 0) {
    const { error: histEvalErr, count: histEvalCount } = (await supabase
      .from("evaluations")
      .delete({ count: "exact" })
      .eq("organization_id", organizationId)
      .in("evidence_id", histEvidenceIds)) as unknown as { error: unknown; count: number | null };
    if (histEvalErr) throw histEvalErr;
    deletedEvaluations += histEvalCount ?? 0;

    const { error: histEvErr, count: histEvCount } = (await supabase
      .from("evidence")
      .delete({ count: "exact" })
      .eq("organization_id", organizationId)
      .is("scan_id", null)
      .lt("observed_at", evidenceThreshold)
      .in("id", histEvidenceIds)) as unknown as { error: unknown; count: number | null };
    if (histEvErr) throw histEvErr;
    deletedEvidence += histEvCount ?? 0;
  }

  // 6. Webhook events for this org: received_at < 30d
  const webhookThreshold = retentionThreshold(WEBHOOK_RETENTION_DAYS);
  const { error: whErr, count: whCount } = (await supabase
    .from("webhook_events")
    .delete({ count: "exact" })
    .eq("organization_id", organizationId)
    .lt("received_at", webhookThreshold)) as unknown as { error: unknown; count: number | null };
  if (whErr) throw whErr;
  deletedWebhookEvents += whCount ?? 0;

  return { deletedScans, deletedEvidence, deletedEvaluations, deletedWebhookEvents };
}

async function deleteExpiredWebhookEventsForNullOrg(supabase: SupabaseClient): Promise<number> {
  const webhookThreshold = retentionThreshold(WEBHOOK_RETENTION_DAYS);
  const { error, count } = (await supabase
    .from("webhook_events")
    .delete({ count: "exact" })
    .is("organization_id", null)
    .lt("received_at", webhookThreshold)) as unknown as { error: unknown; count: number | null };
  if (error) throw error;
  return count ?? 0;
}
