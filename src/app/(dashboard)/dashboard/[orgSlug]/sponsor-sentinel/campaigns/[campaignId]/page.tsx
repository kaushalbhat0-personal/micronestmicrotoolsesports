import * as React from "react";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createClient } from "@/lib/supabase/server";
import { getCampaign } from "@/features/sponsor-sentinel/services/campaign-service";
import { listDeliverablesByCampaign } from "@/server/repositories/deliverables";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import { listScansByCampaign } from "@/server/repositories/scans";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { ReadinessCard } from "@/components/ui/readiness-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeliverableForm } from "@/features/sponsor-sentinel/components/deliverable-form";
import { DeleteRequirementButton } from "@/features/sponsor-sentinel/components/delete-requirement-button";
import { ActivateCampaignButton } from "@/features/sponsor-sentinel/components/activate-campaign-button";
import { ArchiveCampaignButton } from "@/features/sponsor-sentinel/components/archive-campaign-button";
import { CheckNowButton } from "@/features/sponsor-sentinel/components/check-now-button";
import { CompleteCampaignButton } from "@/features/sponsor-sentinel/components/complete-campaign-button";
import { CampaignProofSection, CampaignProofSkeleton } from "@/features/sponsor-sentinel/components/campaign-proof-section";
import { formatRequirementDescription } from "@/features/sponsor-sentinel/components/requirement-description";
import { APP_TIMEZONE, formatDateTimeKolkata } from "@/lib/utils/format";
import Link from "next/link";
import type { Route } from "next";

function formatPeriod(startsAt: string, endsAt: string): string {
  try {
    const fmt = (v: string) =>
      new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", year: "numeric", timeZone: APP_TIMEZONE }).format(new Date(v));
    return `${fmt(startsAt)} – ${fmt(endsAt)}`;
  } catch {
    return `${startsAt} – ${endsAt}`;
  }
}

function platformLabel(platform: string): string {
  if (platform === "youtube") return "YouTube";
  if (platform === "twitch") return "Twitch";
  if (platform === "kick") return "Kick";
  return platform;
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ orgSlug: string; campaignId: string }> }) {
  const { orgSlug, campaignId } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  } catch (e) {
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }
  const supabase = await createClient();

  const [campaign, deliverables, channels, campaignScans] = await Promise.all([
    getCampaign(supabase, ctx.organization.id, campaignId),
    listDeliverablesByCampaign(supabase, campaignId),
    listConnectedChannelsByOrg(supabase, ctx.organization.id),
    listScansByCampaign(supabase, ctx.organization.id, campaignId, 5),
  ]);
  const usableChannels = channels.filter((c) => c.connection_status === "connected");

  const latestScan = campaignScans[0] ?? null;

  const hasConnectedChannel = usableChannels.length > 0;
  const hasRequirement = deliverables.length > 0;
  const period = formatPeriod(campaign.starts_at, campaign.ends_at);
  const isDraft = campaign.status === "draft";
  const isActive = campaign.status === "active";
  const isCompleted = campaign.status === "completed";
  const isArchived = campaign.status === "archived";
  const isEnded = isActive && new Date(campaign.ends_at) < new Date();
  const activeRequirementCount = deliverables.filter((d) => d.status === "active").length;
  const isRecoverableTracking = isActive && activeRequirementCount === 0;

  const activationBlockedReason = !hasConnectedChannel
    ? "Connect a creator channel before starting tracking."
    : !hasRequirement
      ? "Add at least one requirement before starting tracking."
      : null;

  const readinessItems = [
    { label: "Campaign details", status: "complete" as const, description: `${campaign.name} • ${period}` },
    {
      label: hasConnectedChannel ? "Creator channel connected" : "Creator channel not connected",
      status: hasConnectedChannel ? ("complete" as const) : ("blocked" as const),
      description: hasConnectedChannel ? `${usableChannels.length} channel${usableChannels.length > 1 ? "s" : ""} available` : "Connect a creator channel to start tracking this campaign.",
    },
    {
      label: hasRequirement ? "Requirement added" : "No requirement yet",
      status: hasRequirement ? ("complete" as const) : ("blocked" as const),
      description: hasRequirement ? `${deliverables.length} requirement${deliverables.length > 1 ? "s" : ""} configured` : "Add at least one requirement before starting tracking.",
    },
  ];



  return (
    <div className="space-y-8">
      {/* 1 — Identity / Hero */}
      <PageHeader
        title={campaign.name}
        description={campaign.description ? `${period} • ${campaign.description}` : period}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
              <Button variant="outline" size="sm" aria-label="Back to campaigns" className="min-h-[44px]">
                Back to campaigns
              </Button>
            </Link>
            {isDraft ? <ActivateCampaignButton orgSlug={orgSlug} campaignId={campaignId} disabled={!!activationBlockedReason} disabledReason={activationBlockedReason ?? undefined} /> : null}
            {isActive ? (
              <>
                <CompleteCampaignButton orgSlug={orgSlug} campaignId={campaignId} />
                <CheckNowButton orgSlug={orgSlug} campaignId={campaignId} />
              </>
            ) : null}
            {isDraft ? (
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}/edit` as Route}>
                <Button variant="outline" size="sm" aria-label="Edit draft campaign" className="min-h-[44px]">
                  Edit
                </Button>
              </Link>
            ) : null}
            {!isArchived ? <ArchiveCampaignButton orgSlug={orgSlug} campaignId={campaignId} /> : null}
          </div>
        }
      />

      {/* 2 — Health / Readiness — server-authoritative */}
      {isDraft ? (
        <ReadinessCard
          title="Campaign setup"
          description="Check what the campaign needs before tracking can start. Server enforces channel + requirement before activation."
          items={readinessItems}
          action={
            !hasConnectedChannel ? (
              <Link href={`/dashboard/${orgSlug}/channels` as Route}>
                <Button size="sm" variant="outline">
                  Connect a creator channel
                </Button>
              </Link>
            ) : !hasRequirement ? (
              <span className="text-xs text-muted-foreground">Add a requirement below to continue.</span>
            ) : null
          }
        />
      ) : null}

      {isActive ? (
        <div className="flex flex-col gap-3 rounded-[12px] border border-success/20 bg-success-soft p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge status="active" />
              <span className="text-sm font-medium">Tracking</span>
              {isEnded ? <Badge variant="warning">Window ended</Badge> : null}
            </div>
            <p className="text-sm text-muted-foreground">
              {isEnded ? "Campaign window has ended — still tracking. Complete the campaign to stop checks." : "Checks run automatically and on demand. Requirements are locked while tracking."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CompleteCampaignButton orgSlug={orgSlug} campaignId={campaignId} />
          </div>
        </div>
      ) : null}

      {isCompleted ? (
        <div className="flex items-center gap-2 rounded-[12px] border border-border bg-card p-4">
          <StatusBadge status="completed" />
          <span className="text-sm font-medium">Completed</span>
          <span className="text-sm text-muted-foreground">This campaign has finished tracking.</span>
        </div>
      ) : null}
      {isArchived ? (
        <div className="flex items-center gap-2 rounded-[12px] border border-border bg-card p-4">
          <StatusBadge status="archived" />
          <span className="text-sm font-medium">Archived</span>
          <span className="text-sm text-muted-foreground">This campaign is archived and no longer tracking.</span>
        </div>
      ) : null}

      {/* 3 — Requirements — with health */}
      <section className="space-y-3" aria-labelledby="requirements-heading">
        <SectionHeader title="Requirements" description="What the sponsor requires." />
        {deliverables.length === 0 ? (
          <EmptyState
            title="No requirements yet"
            description={isRecoverableTracking ? "This campaign is tracking but has no requirements yet. Add a requirement to continue checking." : "Add what the creator needs to deliver so we can check it automatically."}
            action={isDraft || isRecoverableTracking ? <span className="text-xs text-muted-foreground">Use the form below to add a requirement.</span> : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {deliverables.map((d) => {
              const human = formatRequirementDescription(d.rule as unknown);
              const isLastActive = isActive && activeRequirementCount === 1 && d.status === "active";
              return (
                <li key={d.id} className="rounded-[16px] border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold leading-none">{d.name}</h3>
                        <Badge variant="outline">Active</Badge>
                      </div>
                      {d.description ? <p className="text-xs text-muted-foreground">{d.description}</p> : null}
                      <p className="text-sm">{human}</p>
                    </div>
                    {isLastActive ? (
                      <span className="text-xs text-muted-foreground px-3 py-1" title="Cannot remove the last requirement while tracking">
                        Locked
                      </span>
                    ) : (
                      <DeleteRequirementButton orgSlug={orgSlug} campaignId={campaignId} deliverableId={d.id} name={d.name} />
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {isDraft || isRecoverableTracking ? (
          <Card className="mt-4" variant="default">
            <CardHeader>
              <CardTitle className="text-base">Add requirement</CardTitle>
            </CardHeader>
            <CardContent>
              <DeliverableForm orgSlug={orgSlug} campaignId={campaignId} />
            </CardContent>
          </Card>
        ) : isActive ? (
          <p className="text-xs text-muted-foreground">Requirements are locked while tracking.</p>
        ) : isCompleted || isArchived ? (
          <p className="text-xs text-muted-foreground">Requirements are locked for completed campaigns.</p>
        ) : null}
      </section>

      {/* 4 — Latest Check — compact summary, not duplicated detail */}
      <section className="space-y-3" aria-labelledby="latest-check-heading">
        <SectionHeader title="Latest Check" description="Most recent verification for this campaign." />
        {!latestScan ? (
          <EmptyState
            title="No checks yet"
            description={isDraft ? "Start tracking to begin checking creator activity for this campaign." : "No checks have run for this campaign. Once a check runs, verification results will appear here."}
            action={
              isDraft ? (
                <ActivateCampaignButton orgSlug={orgSlug} campaignId={campaignId} disabled={!!activationBlockedReason} disabledReason={activationBlockedReason ?? undefined} />
              ) : isActive ? (
                <CheckNowButton orgSlug={orgSlug} campaignId={campaignId} />
              ) : undefined
            }
          />
        ) : (
          <Card variant="default">
            <CardContent className="p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={latestScan.status} />
                  <Badge variant={latestScan.platform === "youtube" ? "platform-youtube" : latestScan.platform === "twitch" ? "platform-twitch" : "platform-kick"} className="capitalize text-[11px]">{platformLabel(latestScan.platform)}</Badge>
                  <span className="text-xs text-muted-foreground">{formatDateTimeKolkata(latestScan.started_at)}</span>
                </div>
                <p className="text-sm">Latest verification for this campaign.</p>
              </div>
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans/${latestScan.id}` as Route} className="inline-flex text-sm font-medium text-primary hover:underline">
                View check →
              </Link>
            </CardContent>
          </Card>
        )}
      </section>

      {/* 5 — Proof — streamed: hero + requirements render before evidence query */}
      <section className="space-y-3" aria-labelledby="proof-heading">
        <SectionHeader title="Proof" description="Latest proof from this campaign — one content item appears once with all requirements it satisfies. Full history via checks." />
        <React.Suspense fallback={<CampaignProofSkeleton />}>
          <CampaignProofSection
            orgSlug={orgSlug}
            campaignId={campaignId}
            scanId={latestScan?.id ?? null}
            scanPlatform={latestScan?.platform}
            scanStartedAt={latestScan?.started_at}
            isActive={isActive}
            isDraft={isDraft}
            deliverables={deliverables.map((d) => ({ id: d.id, name: d.name, rule: d.rule }))}
          />
        </React.Suspense>
      </section>

      {/* 6 — Creator Channels — contextual, not primary */}
      <section className="space-y-3" aria-labelledby="creator-channels-heading">
        <SectionHeader title="Creator Channels" description="This campaign checks content from your connected creator channels. All campaigns use every connected channel in this workspace." />
        {channels.length === 0 ? (
          <EmptyState
            title="No creator channel connected"
            description="Connect a creator channel before starting tracking. This campaign will use connected channels to check for sponsorship proof."
            action={
              <Link href={`/dashboard/${orgSlug}/channels` as Route}>
                <Button size="sm">Connect a creator channel</Button>
              </Link>
            }
          />
        ) : (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">All connected channels are checked for this campaign</p>
            <ul className="space-y-2">
              {channels.map((ch) => (
                <li key={ch.id} className="flex flex-col gap-3 rounded-[16px] border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <Badge variant="outline" className="capitalize">
                        {platformLabel(ch.platform)}
                      </Badge>
                      <span className="truncate">{ch.display_name ?? ch.external_handle}</span>
                      {ch.connection_status === "connected" ? <Badge variant="success">Ready</Badge> : <Badge variant="secondary">{ch.connection_status}</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{ch.external_handle} • {platformLabel(ch.platform)}</p>
                    {ch.canonical_url ? <a href={ch.canonical_url} target="_blank" rel="noreferrer" className="inline-block text-xs font-medium text-primary hover:underline">Open channel</a> : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 7 — Check History — compact, not duplicated */}
      <section className="space-y-2" aria-labelledby="history-heading">
        <SectionHeader
          title="Check History"
          description="Recent checks for this campaign — View check history for full detail."
          action={
            campaignScans.length > 0 ? (
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="text-sm font-medium text-primary hover:underline">
                View check history
              </Link>
            ) : undefined
          }
        />
        {latestScan ? (
          <Card variant="default">
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                {campaignScans.slice(0, 3).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <StatusBadge status={s.status} />
                      <span className="text-xs text-muted-foreground">{formatDateTimeKolkata(s.started_at)}</span>
                      <Badge variant={s.platform === "youtube" ? "platform-youtube" : s.platform === "twitch" ? "platform-twitch" : "platform-kick"} className="capitalize text-[11px]">{platformLabel(s.platform)}</Badge>
                    </div>
                    <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans/${s.id}` as Route} className="text-xs font-medium text-primary hover:underline">View →</Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <p className="text-xs text-muted-foreground">No checks have run for this campaign.</p>
        )}
      </section>
    </div>
  );
}
