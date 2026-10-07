import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { listCampaigns } from "@/features/sponsor-sentinel/services/campaign-service";
import { getRequirementCounts } from "@/features/sponsor-sentinel/services/deliverable-service";
import { getScanHistory } from "@/features/sponsor-sentinel/services/scan-history";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import type { Route } from "next";
import { ShieldCheck } from "lucide-react";

export default async function CampaignsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();
  const [campaigns, scanHistory, reqCounts] = await Promise.all([
    listCampaigns(supabase, ctx.organization.id),
    getScanHistory(supabase, ctx.organization.id).catch(() => ({ scans: [], total: 0 }) as never),
    getRequirementCounts(supabase, ctx.organization.id),
  ]);
  const scanByCampaign = new Map<string, (typeof scanHistory.scans)[number]>();
  for (const item of scanHistory.scans) {
    if (!scanByCampaign.has(item.scan.campaign_id)) scanByCampaign.set(item.scan.campaign_id, item);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        description={`Sponsor campaigns for ${ctx.organization.name}`}
        action={
          <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
            <Button size="sm" aria-label="Create campaign">
              Create campaign
            </Button>
          </Link>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={<ShieldCheck className="h-5 w-5" />}
          title="No campaigns"
          description="Create your first sponsor campaign to start tracking requirements."
          action={
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
              <Button aria-label="Create first campaign">Create campaign</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => {
            const reqCount = reqCounts.failed ? null : (reqCounts.counts.get(c.id) ?? 0);
            const last = scanByCampaign.get(c.id);
            return (
              <Link key={c.id} href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${c.id}` as Route} className="group rounded-[16px] border border-border bg-card p-5 hover:bg-surface-muted/50 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">{c.name}</p>
                      <StatusBadge status={c.status} />
                    </div>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{c.description ?? "No description"}</p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {reqCount === null ? (
                        <Badge variant="secondary" className="text-[11px]" title="Requirement counts couldn't be loaded">
                          Requirements unavailable
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="text-[11px]">{reqCount} requirements</Badge>
                      )}
                      {last ? (
                        <Badge variant={last.scan.platform === "youtube" ? "platform-youtube" : last.scan.platform === "twitch" ? "platform-twitch" : "platform-kick"} className="capitalize text-[10px]">{last.scan.platform}</Badge>
                      ) : null}
                      <span className="text-xs text-muted-foreground">{new Date(c.ends_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}</span>
                    </div>
                    {last ? (
                      <p className="text-xs text-muted-foreground">Last check {new Date(last.scan.started_at).toLocaleDateString()} • {last.evidenceCount} proof</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">No checks yet</p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs font-medium text-primary group-hover:underline">View →</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
