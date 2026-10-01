import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { getCampaign } from "@/features/sponsor-sentinel/services/campaign-service";
import { listDeliverablesByCampaign } from "@/server/repositories/deliverables";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import { listEvidenceByScan } from "@/server/repositories/evidence";
import { listEvaluationsByScan } from "@/server/repositories/evaluations";
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
import { deleteDeliverableAction } from "@/features/sponsor-sentinel/actions/deliverable-actions";
import { ActivateCampaignButton } from "@/features/sponsor-sentinel/components/activate-campaign-button";
import { CheckNowButton } from "@/features/sponsor-sentinel/components/check-now-button";
import { formatRequirementDescription } from "@/features/sponsor-sentinel/components/requirement-description";
import Link from "next/link";
import type { Route } from "next";

function formatPeriod(startsAt: string, endsAt: string): string {
  try {
    const s = new Date(startsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    const e = new Date(endsAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
    return `${s} – ${e}`;
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
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();

  // P0-A: parallel independent reads after trusted context
  const [campaign, deliverables, channels] = await Promise.all([
    getCampaign(supabase, ctx.organization.id, campaignId),
    listDeliverablesByCampaign(supabase, campaignId),
    listConnectedChannelsByOrg(supabase, ctx.organization.id),
  ]);
  const usableChannels = channels.filter((c) => c.connection_status === "connected");

  // P0-C: campaign-specific DB query with limit, preserves tenant safety via organization_id
  const campaignScans = await listScansByCampaign(supabase, ctx.organization.id, campaignId, 5);
  const latestScan = campaignScans[0] ?? null;

  // P0-B: parallel evidence + evaluation reads
  let evidence: Awaited<ReturnType<typeof listEvidenceByScan>> = [];
  let evaluations: Awaited<ReturnType<typeof listEvaluationsByScan>> = [];
  if (latestScan) {
    [evidence, evaluations] = await Promise.all([
      listEvidenceByScan(supabase, latestScan.id),
      listEvaluationsByScan(supabase, latestScan.id),
    ]);
  }

  const hasConnectedChannel = usableChannels.length > 0;
  const hasRequirement = deliverables.length > 0;
  const period = formatPeriod(campaign.starts_at, campaign.ends_at);
  const isDraft = campaign.status === "draft";
  const isActive = campaign.status === "active";
  const isCompleted = campaign.status === "completed";
  const isArchived = campaign.status === "archived";
  const activeRequirementCount = deliverables.filter((d) => d.status === "active").length;
  const isRecoverableTracking = isActive && activeRequirementCount === 0;

  const activationBlockedReason = !hasConnectedChannel
    ? "Connect a creator channel before starting tracking."
    : !hasRequirement
      ? "Add at least one requirement before starting tracking."
      : null;

  // Readiness items for draft setup
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
      {/* 1 — Campaign header */}
      <PageHeader
        title={campaign.name}
        description={campaign.description ? `${period} • ${campaign.description}` : period}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={campaign.status} />
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
              <Button variant="outline" size="sm" aria-label="Back to campaigns">
                Back to campaigns
              </Button>
            </Link>
            {isDraft ? (
              <ActivateCampaignButton orgSlug={orgSlug} campaignId={campaignId} disabled={!!activationBlockedReason} disabledReason={activationBlockedReason ?? undefined} />
            ) : null}
            {isActive ? <CheckNowButton orgSlug={orgSlug} campaignId={campaignId} /> : null}
          </div>
        }
      />

      {/* 2 — Campaign readiness / tracking state */}
      {isDraft ? (
        <ReadinessCard
          title="Campaign setup"
          description="Check what the campaign needs before tracking can start."
          items={readinessItems}
          action={
            !hasConnectedChannel ? (
              <Link href={`/dashboard/${orgSlug}/settings/integrations` as Route}>
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
        <div className="flex flex-col gap-2 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 dark:border-emerald-900 dark:bg-emerald-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <StatusBadge status="active" />
              <span className="text-sm font-medium">Tracking</span>
            </div>
            <p className="text-sm text-muted-foreground">Checks run automatically when campaign activity is detected and on the scheduled check.</p>
          </div>
        </div>
      ) : null}

      {isCompleted ? (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-4">
          <StatusBadge status="completed" />
          <span className="text-sm font-medium">Completed</span>
          <span className="text-sm text-muted-foreground">This campaign has finished tracking.</span>
        </div>
      ) : null}

      {isArchived ? (
        <div className="flex items-center gap-2 rounded-lg border bg-card p-4">
          <StatusBadge status="archived" />
          <span className="text-sm font-medium">Archived</span>
          <span className="text-sm text-muted-foreground">This campaign is archived and no longer tracking.</span>
        </div>
      ) : null}

      {/* 3 — Creator channels */}
      <section className="space-y-3" aria-labelledby="creator-channels-heading">
        <SectionHeader
          title="Creator channels"
          description="These are the channels this campaign checks for sponsorship proof. The campaign uses all connected creator channels available to this workspace."
        />
        {channels.length === 0 ? (
          <EmptyState
            title="No creator channel connected"
            description="Connect a creator channel before starting tracking. This campaign will use connected channels to check for sponsorship proof."
            action={
              <Link href={`/dashboard/${orgSlug}/settings/integrations` as Route}>
                <Button size="sm">Connect a creator channel</Button>
              </Link>
            }
          />
        ) : (
          <div>
            <p className="mb-2 text-xs text-muted-foreground">Connected creator channels available to this campaign</p>
            <ul className="space-y-2">
              {channels.map((ch) => (
                <li key={ch.id} className="flex flex-col gap-3 rounded-lg border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      <Badge variant="outline" className="capitalize">
                        {platformLabel(ch.platform)}
                      </Badge>
                      <span className="truncate">{ch.display_name ?? ch.external_handle}</span>
                      {ch.connection_status === "connected" ? <Badge variant="success">Connected ✓</Badge> : <Badge variant="secondary">{ch.connection_status}</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ch.external_handle} • {platformLabel(ch.platform)}
                    </p>
                    {ch.canonical_url ? (
                      <a href={ch.canonical_url} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary underline">
                        Open channel
                      </a>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* 4 — Requirements */}
      <section className="space-y-3" aria-labelledby="requirements-heading">
        <SectionHeader title="What the creator needs to deliver" description="Set the requirements we will check for this sponsorship." />
        {deliverables.length === 0 ? (
          <EmptyState
            title="No requirements yet"
            description={
              isRecoverableTracking
                ? "This campaign is tracking but has no requirements yet. Add a requirement to continue checking sponsorship activity."
                : "Add what the creator needs to deliver so we can check it automatically."
            }
            action={isDraft || isRecoverableTracking ? <span className="text-xs text-muted-foreground">Use the form below to add a requirement.</span> : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {deliverables.map((d) => {
              const rule = d.rule as unknown;
              const human = formatRequirementDescription(rule);
              const isLastActive = isActive && activeRequirementCount === 1 && d.status === "active";
              return (
                <li key={d.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-sm font-semibold leading-none">{d.name}</h3>
                      {d.description ? <p className="text-xs text-muted-foreground">{d.description}</p> : <p className="text-xs text-muted-foreground">{human}</p>}
                      {/* Always show human requirement text */}
                      <p className="text-sm">{human}</p>
                      <div className="pt-1">
                        <Badge variant="outline">Active</Badge>
                      </div>
                    </div>
                    {isLastActive ? (
                      <span className="text-xs text-muted-foreground px-3 py-1" title="Cannot remove the last requirement while tracking">
                        Locked
                      </span>
                    ) : (
                      <form action={deleteDeliverableAction}>
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="campaignId" value={campaignId} />
                        <input type="hidden" name="deliverableId" value={d.id} />
                        <Button type="submit" variant="ghost" size="sm" aria-label={`Remove requirement ${d.name}`}>
                          Remove
                        </Button>
                      </form>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {isDraft || isRecoverableTracking ? (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-base">Add requirement</CardTitle>
            </CardHeader>
            <CardContent>
              <DeliverableForm orgSlug={orgSlug} campaignId={campaignId} />
            </CardContent>
          </Card>
        ) : isActive ? (
          <p className="text-xs text-muted-foreground">Requirements can only be added while the campaign is being set up. This campaign is tracking and requirements are locked.</p>
        ) : isCompleted || isArchived ? (
          <p className="text-xs text-muted-foreground">Requirements are locked for completed campaigns.</p>
        ) : null}
      </section>

      {/* Tracking hint for draft */}
      {isDraft ? (
        <p className="text-sm text-muted-foreground">This campaign is still being set up. Tracking starts when you start the campaign.</p>
      ) : null}

      {/* 5 — Latest proof */}
      <section className="space-y-3" aria-labelledby="proof-heading">
        <SectionHeader title="Latest proof" description="The latest activity found on the connected creator channel." />
        {isActive && evidence.length === 0 && !latestScan ? (
          <EmptyState
            title="No proof checked yet"
            description="Check the creator channel to look for the latest sponsorship activity."
            action={<CheckNowButton orgSlug={orgSlug} campaignId={campaignId} />}
          />
        ) : !latestScan ? (
          <EmptyState
            title="No sponsorship proof checked yet"
            description={isDraft ? "Start tracking to begin checking creator activity for this campaign." : "No proof has been checked for this campaign yet."}
            action={
              isDraft ? (
                <ActivateCampaignButton orgSlug={orgSlug} campaignId={campaignId} disabled={!!activationBlockedReason} disabledReason={activationBlockedReason ?? undefined} />
              ) : isActive ? (
                <CheckNowButton orgSlug={orgSlug} campaignId={campaignId} />
              ) : undefined
            }
          />
        ) : evidence.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <p className="text-sm font-medium">No proof found yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Check the creator channel to look for the latest sponsorship activity.</p>
              {isActive ? (
                <div className="mt-3">
                  <CheckNowButton orgSlug={orgSlug} campaignId={campaignId} />
                </div>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                Last check: {latestScan ? new Date(latestScan.started_at).toLocaleString() : "—"} • {latestScan.platform ? platformLabel(latestScan.platform) : "—"}
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-3">
            {evidence.map((ev) => {
              const evalForEvidence = evaluations.find((e) => e.evidence_id === ev.id);
              const resultStatus = evalForEvidence?.result ?? "PENDING";
              return (
                <li key={ev.id} className="rounded-lg border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <StatusBadge status={resultStatus} />
                      </div>
                      <p className="text-sm font-medium truncate">{ev.observed_value}</p>
                      <p className="text-xs text-muted-foreground">
                        Checked {new Date(ev.observed_at).toLocaleString()} • {platformLabel(ev.platform ?? ev.source)}
                      </p>
                      {ev.source_url ? (
                        <a href={ev.source_url} target="_blank" rel="noreferrer" className="inline-block text-xs text-primary underline">
                          View source
                        </a>
                      ) : null}
                      {evalForEvidence?.reason ? <p className="text-xs text-muted-foreground">Why: {evalForEvidence.reason}</p> : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 6 — Check history */}
      <section className="space-y-2" aria-labelledby="history-heading">
        <SectionHeader
          title="Check history"
          description="See past checks for this campaign."
          action={
            campaignScans.length > 0 ? (
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="text-sm text-primary underline">
                View check history
              </Link>
            ) : undefined
          }
        />
        {latestScan ? (
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm">
                Last check: <span className="font-medium">{new Date(latestScan.started_at).toLocaleString()}</span> • {platformLabel(latestScan.platform)}
              </p>
              {campaignScans.length > 1 ? (
                <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="mt-2 inline-block text-xs text-primary underline">
                  View check history ({campaignScans.length} checks)
                </Link>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </section>
    </div>
  );
}
