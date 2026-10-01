import * as React from "react";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ReadinessCard, type ReadinessItem } from "@/components/ui/readiness-card";
import { SectionHeader } from "@/components/ui/section-header";
import { createClient } from "@/lib/supabase/server";
import { listCampaigns } from "@/features/sponsor-sentinel/services/campaign-service";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import Link from "next/link";
import type { Route } from "next";

// Orchestration-only: resolve context → render operational overview.
export default async function OrgDashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  const supabase = await createClient();

  const [campaigns, channels] = await Promise.all([
    listCampaigns(supabase, ctx.organization.id).catch(() => []),
    listConnectedChannelsByOrg(supabase, ctx.organization.id).catch(() => []),
  ]);

  const connectedCount = channels.filter((c) => c.connection_status === "connected").length;
  const hasCampaigns = campaigns.length > 0;
  const hasChannels = connectedCount > 0;
  const recentCampaigns = campaigns.slice(0, 3);

  const readinessItems: ReadinessItem[] = [
    {
      label: hasCampaigns ? `Sponsorship campaign — ${campaigns.length} created` : "Sponsorship campaign",
      status: hasCampaigns ? "complete" : "blocked",
      description: hasCampaigns ? "You can add requirements and start tracking." : "Create your first campaign to track what a creator needs to deliver.",
    },
    {
      label: hasChannels ? `Creator channel — ${connectedCount} connected` : "Creator channel not connected",
      status: hasChannels ? "complete" : "warning",
      description: hasChannels ? "Campaigns will check this channel for proof." : "Connect a Twitch or YouTube channel to start tracking sponsorship activity.",
    },
  ];

  const isReady = hasCampaigns && hasChannels;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Your sponsorship operations"
        description={`Manage sponsorship campaigns, creator channels, and proof of delivery for ${ctx.organization.name}`}
      />

      <ReadinessCard
        title={isReady ? "Workspace ready" : "Workspace setup"}
        description={isReady ? "Everything is ready. Start tracking your next sponsorship." : "Complete these steps to start tracking sponsorship delivery."}
        items={readinessItems}
        action={
          isReady ? (
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
              <Button size="sm">View campaigns</Button>
            </Link>
          ) : !hasCampaigns ? (
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
              <Button size="sm">Create campaign</Button>
            </Link>
          ) : (
            <Link href={`/dashboard/${orgSlug}/settings/integrations` as Route}>
              <Button size="sm">Connect a channel</Button>
            </Link>
          )
        }
      />

      <section className="space-y-4">
        <SectionHeader
          title="Sponsorship campaigns"
          description="Track what creators need to deliver for your sponsors."
          action={
            <div className="flex gap-2">
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
                <Button variant="outline" size="sm">
                  View campaigns
                </Button>
              </Link>
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
                <Button size="sm">Create campaign</Button>
              </Link>
            </div>
          }
        />
        {hasCampaigns ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recentCampaigns.map((c) => (
              <Card key={c.id} className={c.status === "active" ? "border-l-2 border-l-emerald-500" : undefined}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center justify-between gap-2">
                    <span className="truncate">{c.name}</span>
                    <StatusBadge status={c.status} />
                  </CardTitle>
                  <CardDescription className="line-clamp-2">{c.description ?? "No description"}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <p className="text-xs tabular-nums text-muted-foreground">
                    {new Date(c.starts_at).toLocaleDateString()} → {new Date(c.ends_at).toLocaleDateString()}
                  </p>
                  <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${c.id}` as Route}>
                    <Button variant="outline" size="sm">
                      View
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<span aria-hidden>📋</span>}
            title="No sponsorship campaigns yet"
            description="Create your first campaign to track what a creator needs to deliver for a brand."
            action={
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
                <Button>Create campaign</Button>
              </Link>
            }
            secondaryAction={
              <Link href={`/dashboard/${orgSlug}/settings/integrations` as Route}>
                <Button variant="outline">Connect a creator channel</Button>
              </Link>
            }
          />
        )}
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Creator channels"
          description="Channels connected to this workspace appear here. Connect a channel to start tracking sponsorship activity."
          action={
            <Link href={`/dashboard/${orgSlug}/settings/integrations` as Route}>
              <Button variant="outline" size="sm">
                Manage channels
              </Button>
            </Link>
          }
        />
        {hasChannels ? (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y">
                {channels.slice(0, 3).map((ch) => (
                  <li key={ch.id} className="flex items-center justify-between p-4">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {ch.display_name ?? ch.external_handle} <Badge variant="outline">{ch.platform}</Badge>
                      </p>
                      <p className="truncate text-xs text-muted-foreground">{ch.canonical_url}</p>
                    </div>
                    <StatusBadge status={ch.connection_status} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ) : (
          <EmptyState
            icon={<span aria-hidden>📺</span>}
            title="No creator channels connected"
            description="Connect a Twitch or YouTube channel to this workspace. Your sponsorship campaigns will use these channels to check for proof."
            action={
              <Link href={`/dashboard/${orgSlug}/settings/integrations` as Route}>
                <Button>Connect a channel</Button>
              </Link>
            }
            secondaryAction={<span className="text-xs text-muted-foreground">Takes ~30 seconds</span>}
          />
        )}
      </section>

      <div className="flex items-center gap-2 border-t pt-6 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
        Workspace {ctx.organization.name} • {ctx.organization.slug}
      </div>
    </div>
  );
}
