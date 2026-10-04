import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { listEvidenceByScan } from "@/server/repositories/evidence";
import { listEvaluationsByScan } from "@/server/repositories/evaluations";
import { groupProofByContent } from "@/features/sponsor-sentinel/services/proof-grouping";
import { ContentProofSections } from "./content-proof-sections";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { CheckNowButton } from "./check-now-button";
import { formatDateTimeKolkata } from "@/lib/utils/format";
import Link from "next/link";
import type { Route } from "next";

function platformLabel(platform: string) {
  if (platform === "youtube") return "YouTube";
  if (platform === "twitch") return "Twitch";
  if (platform === "kick") return "Kick";
  return platform;
}

export async function CampaignProofSection({
  orgSlug,
  campaignId,
  scanId,
  scanPlatform,
  scanStartedAt,
  isActive,
  isDraft,
  deliverables,
}: {
  orgSlug: string;
  campaignId: string;
  scanId: string | null;
  scanPlatform?: string | undefined;
  scanStartedAt?: string | undefined;
  isActive: boolean;
  isDraft: boolean;
  deliverables: Array<{ id: string; name: string; rule: unknown }>;
}) {
  if (!scanId) {
    if (isActive) {
      return <EmptyState title="No proof checked yet" description="Check the creator channel to look for the latest sponsorship activity." action={<CheckNowButton orgSlug={orgSlug} campaignId={campaignId} />} />;
    }
    return <EmptyState title="No proof yet" description={isDraft ? "Start tracking to begin checking creator activity for this campaign." : "Proof will appear when eligible content matches campaign requirements."} />;
  }

  const supabase = await createClient();
  const [evidence, evaluations] = await Promise.all([listEvidenceByScan(supabase, scanId), listEvaluationsByScan(supabase, scanId)]);
  const deliverableMap = new Map<string, { name: string; rule: unknown }>(deliverables.map((d) => [d.id, { name: d.name, rule: d.rule }]));

  if (evidence.length === 0) {
    return (
      <Card variant="default">
        <CardContent className="pt-6">
          <p className="text-sm font-medium">No proof found yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Check the creator channel to look for the latest sponsorship activity.</p>
          {isActive ? <div className="mt-3"><CheckNowButton orgSlug={orgSlug} campaignId={campaignId} /></div> : null}
          <p className="mt-2 text-xs text-muted-foreground">Last check: {formatDateTimeKolkata(scanStartedAt!)} • {platformLabel(scanPlatform!)}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <ContentProofSections evidence={evidence} evaluations={evaluations} deliverableMap={deliverableMap} />
      <p className="text-xs text-muted-foreground">Last check: {formatDateTimeKolkata(scanStartedAt!)} • {platformLabel(scanPlatform!)} · <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="text-primary underline">View all checks →</Link></p>
    </div>
  );
}

export function CampaignProofSkeleton() {
  return <div className="h-[180px] animate-pulse rounded-[16px] bg-surface-muted" />;
}
