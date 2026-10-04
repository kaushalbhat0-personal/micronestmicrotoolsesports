import { notFound } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { getScanDetail } from "@/features/sponsor-sentinel/services/scan-detail";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SectionHeader } from "@/components/ui/section-header";
import { ScanStatusBadge } from "@/features/sponsor-sentinel/components/scan-status-badge";
import { ContentProofSections } from "@/features/sponsor-sentinel/components/content-proof-sections";
import { StatusBadge } from "@/components/ui/status-badge";
import { AppError } from "@/lib/errors";
import { formatDateTimeKolkata } from "@/lib/utils/format";
import { groupProofByContent } from "@/features/sponsor-sentinel/services/proof-grouping";

export const dynamic = "force-dynamic";

function formatDateTime(value: string | null) {
  return formatDateTimeKolkata(value);
}

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; scanId: string }>;
}) {
  const { orgSlug, scanId } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  const supabase = await createClient();

  let detail;
  try {
    detail = await getScanDetail(supabase, ctx.organization.id, scanId);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }

  const { scan, campaignName, evidence, evaluations, evaluationSummary } = detail;
  const proofGroups = groupProofByContent(evidence, evaluations, detail.deliverableMap);
  // Proof count per requirement (many-to-many)
  const proofCountByRequirement = new Map<string, number>();
  for (const g of proofGroups) {
    for (const r of g.requirements) {
      proofCountByRequirement.set(r.deliverableId, (proofCountByRequirement.get(r.deliverableId) ?? 0) + 1);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader title={campaignName ?? "Check"} description={`${scan.platform} · ${scan.status} · ${formatDateTime(scan.started_at)}`} />

      <Card variant="default" className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex flex-wrap items-center gap-2">
            Check <ScanStatusBadge status={scan.status} />
            <Badge variant={scan.platform === "youtube" ? "platform-youtube" : scan.platform === "twitch" ? "platform-twitch" : "platform-kick"} className="capitalize text-[11px]">
              {scan.platform}
            </Badge>
            <span className="text-xs font-normal text-muted-foreground ml-auto">{formatDateTime(scan.started_at)} → {formatDateTime(scan.completed_at) ?? "—"}</span>
          </CardTitle>
          <CardDescription>
            Campaign {campaignName ?? "Campaign"} • {evidence.length} proof items • {evaluations.length} results • {Object.entries(evaluationSummary).map(([k, v]) => `${k}:${v}`).join(" ") || "No results"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {(scan.error_code || scan.error_message) && (
            <div className="rounded-[12px] border border-destructive/30 bg-destructive-soft p-3">
              <p className="font-medium text-destructive">We couldn&apos;t complete this check</p>
              <p className="text-xs mt-1 text-muted-foreground">Please try again in a moment. If the problem continues, contact support.</p>
            </div>
          )}
          <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="inline-flex text-xs font-medium text-primary hover:underline">
            ← Back to checks
          </Link>
        </CardContent>
      </Card>

      <section className="space-y-3" aria-labelledby="results-heading">
        <SectionHeader title="Requirement Results" description="Each requirement evaluated against all eligible content (content × requirements). Reason explains why." />
        {evaluations.length === 0 ? (
          <Card variant="muted" className="p-6 text-center">
            <p className="text-sm font-medium">No results yet</p>
            <p className="text-xs text-muted-foreground">This check did not produce results.</p>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from(detail.deliverableMap.entries()).map(([delivId, meta]) => {
              const relatedEvals = evaluations.filter((ev) => ev.deliverable_id === delivId);
              // One eval per deliverable in current scan (Cartesian creates one per evidence, but summary picks first PASS/FAIL per requirement)
              // For dashboard we show first eval's result/reason and proof count
              const primary = relatedEvals[0];
              const result = primary?.result ?? "PENDING";
              const reason = primary?.reason ?? "Pending evaluation";
              const proofCount = proofCountByRequirement.get(delivId) ?? 0;
              return (
                <div key={delivId} className="rounded-[16px] border border-border bg-card p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium leading-snug line-clamp-2 flex-1">{meta.name}</p>
                    <StatusBadge status={result} />
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2" title={reason}>
                    {reason}
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-xs rounded-full bg-surface-muted px-2.5 py-1 text-muted-foreground">Proof: {proofCount}</span>
                    <span className="text-xs text-muted-foreground">{relatedEvals.length} evaluations</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="space-y-3" aria-labelledby="proof-heading">
        <SectionHeader title={`Proof — ${String(evidence.length)} items`} description="Many-to-many · One content item appears once with all requirements it satisfies. Thumbnails from stored content ID (no provider call)." />
        <ContentProofSections evidence={evidence} evaluations={evaluations} deliverableMap={detail.deliverableMap} />
      </section>
    </div>
  );
}
