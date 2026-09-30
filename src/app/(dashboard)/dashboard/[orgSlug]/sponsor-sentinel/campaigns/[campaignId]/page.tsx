import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { getCampaign } from "@/features/sponsor-sentinel/services/campaign-service";
import { listDeliverablesByCampaign } from "@/server/repositories/deliverables";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import { listEvidenceByScan } from "@/server/repositories/evidence";
import { listEvaluationsByScan } from "@/server/repositories/evaluations";
import { listScansByOrg } from "@/server/repositories/scans";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeliverableForm } from "@/features/sponsor-sentinel/components/deliverable-form";
import { deleteDeliverableAction } from "@/features/sponsor-sentinel/actions/deliverable-actions";
import { activateCampaignAction, requestScanAction } from "@/features/sponsor-sentinel/actions/campaign-actions";
import Link from "next/link";
import type { Route } from "next";

function StatusBadge({ status }: { status: string }) {
  const variant = status === "active" ? "success" : status === "draft" ? "secondary" : "outline";
  return <Badge variant={variant as never}>{status}</Badge>;
}

function EvaluationBadge({ result }: { result: string }) {
  const variant = result === "PASS" ? "success" : result === "FAIL" ? "destructive" : result === "NOT_SUPPORTED" ? "outline" : "secondary";
  return <Badge variant={variant as never}>{result}</Badge>;
}

export default async function CampaignDetailPage({ params }: { params: Promise<{ orgSlug: string; campaignId: string }> }) {
  const { orgSlug, campaignId } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();

  const campaign = await getCampaign(supabase, ctx.organization.id, campaignId);
  const deliverables = await listDeliverablesByCampaign(supabase, campaignId);
  const channels = await listConnectedChannelsByOrg(supabase, ctx.organization.id);
  const usableChannels = channels.filter((c) => c.connection_status === "connected");

  // Latest scans for this campaign
  const allScans = await listScansByOrg(supabase, ctx.organization.id);
  const campaignScans = allScans.filter((s) => s.campaign_id === campaignId).slice(0, 5);
  const latestScan = campaignScans[0] ?? null;

  // Fetch evidence/evaluations for latest scan if exists
  let evidence: Awaited<ReturnType<typeof listEvidenceByScan>> = [];
  let evaluations: Awaited<ReturnType<typeof listEvaluationsByScan>> = [];
  if (latestScan) {
    evidence = await listEvidenceByScan(supabase, latestScan.id);
    evaluations = await listEvaluationsByScan(supabase, latestScan.id);
  }

  const canActivate = campaign.status === "draft";
  const canScan = campaign.status === "active";

  return (
    <div className="space-y-6">
      <PageHeader
        title={campaign.name}
        description={campaign.description ?? "No description"}
        action={
          <div className="flex gap-2">
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
              <Button variant="outline" size="sm" aria-label="Back to campaigns">
                Back
              </Button>
            </Link>
            {canActivate ? (
              <form action={activateCampaignAction}>
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <Button type="submit" size="sm" aria-label="Activate campaign">
                  Activate
                </Button>
              </form>
            ) : null}
            {canScan ? (
              <form action={requestScanAction}>
                <input type="hidden" name="orgSlug" value={orgSlug} />
                <input type="hidden" name="campaignId" value={campaignId} />
                <Button type="submit" variant="outline" size="sm" aria-label="Run manual scan">
                  Run scan
                </Button>
              </form>
            ) : null}
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Campaign</span>
            <StatusBadge status={campaign.status} />
          </CardTitle>
          <CardDescription>
            {new Date(campaign.starts_at).toLocaleDateString()} → {new Date(campaign.ends_at).toLocaleDateString()}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <p>
            <span className="font-medium">Status:</span> <StatusBadge status={campaign.status} />
          </p>
          <p className="text-muted-foreground">Draft campaigns are editable and do not trigger scanning. Only active campaigns participate in scheduled/webhook scanning.</p>
          {campaign.status === "draft" && deliverables.length === 0 ? <p role="alert" className="text-destructive">Add at least one deliverable before activation.</p> : null}
          {campaign.status === "draft" && usableChannels.length === 0 ? <p role="alert" className="text-destructive">Connect a channel before activation.</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected channels</CardTitle>
          <CardDescription>Channels for this organization. Campaigns use all connected channels for scanning.</CardDescription>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No connected channels. Connect a channel to enable scanning.</p>
          ) : (
            <ul className="space-y-2">
              {channels.map((ch) => (
                <li key={ch.id} className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <p className="text-sm font-medium">
                      {ch.display_name ?? ch.external_handle} <Badge variant="outline">{ch.platform}</Badge>
                    </p>
                    <p className="text-xs text-muted-foreground">{ch.canonical_url}</p>
                  </div>
                  <Badge variant={ch.connection_status === "connected" ? "success" : "secondary"}>{ch.connection_status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Deliverables ({deliverables.length})</CardTitle>
          <CardDescription>Each deliverable has a rule evaluated against provider evidence.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {deliverables.length === 0 ? (
            <p className="text-sm text-muted-foreground">No deliverables. Add one to define sponsor proof.</p>
          ) : (
            <ul className="space-y-3">
              {deliverables.map((d) => {
                const rule = d.rule as Record<string, unknown>;
                return (
                  <li key={d.id} className="rounded-md border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.description ?? "No description"}</p>
                        <p className="mt-1 text-xs">
                          <span className="font-medium">Rule:</span> <code className="rounded bg-muted px-1 py-0.5">{JSON.stringify(rule)}</code>
                        </p>
                        <p className="text-xs">
                          <span className="font-medium">Status:</span> <Badge variant="outline">{d.status}</Badge>
                        </p>
                      </div>
                      <form action={deleteDeliverableAction}>
                        <input type="hidden" name="orgSlug" value={orgSlug} />
                        <input type="hidden" name="campaignId" value={campaignId} />
                        <input type="hidden" name="deliverableId" value={d.id} />
                        <Button type="submit" variant="ghost" size="sm" aria-label={`Delete deliverable ${d.name}`}>
                          Delete
                        </Button>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {campaign.status === "draft" ? (
            <div className="border-t pt-4">
              <h4 className="mb-2 text-sm font-medium">Add deliverable</h4>
              <DeliverableForm orgSlug={orgSlug} campaignId={campaignId} />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Deliverables can only be added to draft campaigns.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Latest scan</CardTitle>
          <CardDescription>Most recent scan for this campaign. Webhook and scheduled scans appear here.</CardDescription>
        </CardHeader>
        <CardContent>
          {latestScan ? (
            <div className="space-y-2 text-sm">
              <p>
                <span className="font-medium">Status:</span> <Badge>{latestScan.status}</Badge> • <span className="text-muted-foreground">{new Date(latestScan.started_at).toLocaleString()}</span>
              </p>
              <p>
                <span className="font-medium">Platform:</span> {latestScan.platform} • <span className="font-medium">Evidence:</span> {evidence.length} • <span className="font-medium">Evaluations:</span> {evaluations.length}
              </p>
              {campaignScans.length > 1 ? (
                <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="text-xs text-primary underline">
                  View all scans ({campaignScans.length})
                </Link>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No scans yet. Activate the campaign and run a scan.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Evidence & evaluation</CardTitle>
          <CardDescription>Immutable evidence from provider APIs and derived evaluations.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {evidence.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence yet. Run a scan to fetch provider state.</p>
          ) : (
            <ul className="space-y-3">
              {evidence.map((ev) => {
                const evalForEvidence = evaluations.find((e) => e.evidence_id === ev.id);
                return (
                  <li key={ev.id} className="rounded-md border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="font-medium">{ev.observed_value}</p>
                      {evalForEvidence ? <EvaluationBadge result={evalForEvidence.result} /> : <Badge variant="outline">PENDING</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {ev.source} • {ev.external_channel_id} • {new Date(ev.observed_at).toLocaleString()}
                    </p>
                    <p className="text-xs">
                      Normalized: <code className="rounded bg-muted px-1">{ev.normalized_value}</code>
                    </p>
                    {ev.source_url ? (
                      <a href={ev.source_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
                        Source
                      </a>
                    ) : null}
                    {evalForEvidence ? <p className="text-xs">Reason: {evalForEvidence.reason}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
