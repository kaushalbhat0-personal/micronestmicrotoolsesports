import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { listProviderCredentialsByOrg, toMaskedView } from "@/server/credentials/repository";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ConnectedChannelsList } from "@/features/sponsor-sentinel/components/connected-channels-list";
import { ConnectYouTubeForm } from "@/features/sponsor-sentinel/components/connect-youtube-form";
import { ConnectTwitchForm } from "@/features/sponsor-sentinel/components/connect-twitch-form";
import { ConnectKickForm } from "@/features/sponsor-sentinel/components/connect-kick-form";
import Link from "next/link";
import type { Route } from "next";
import { Tv, Users, ExternalLink } from "lucide-react";

export default async function ChannelsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  const admin = createAdminClient();
  const providerRows = await listProviderCredentialsByOrg(admin as never, ctx.organization.id);
  const twitch = toMaskedView(providerRows.twitch);
  const youtube = toMaskedView(providerRows.youtube);
  const kick = toMaskedView(providerRows.kick);

  const supabase = await createClient();
  const [{ data: channels }, { data: campaigns }] = await Promise.all([
    supabase.from("connected_channels").select("*").eq("organization_id", ctx.organization.id).order("created_at", { ascending: true }),
    supabase.from("sponsor_campaigns").select("id").eq("organization_id", ctx.organization.id),
  ]);

  const hasYouTube = youtube.configured;
  const hasTwitch = twitch.configured;
  const hasKick = kick.configured;
  const anyConnected = hasYouTube || hasTwitch || hasKick;
  const channelList = (channels ?? []) as never as Array<{ id: string; platform: string; external_handle: string; display_name: string | null; canonical_url: string; connection_status: string; external_channel_id: string }>;
  const campaignCount = (campaigns ?? []).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Creator Channels"
        description={`Track the creator identities your workspace uses for sponsorship tracking — ${ctx.organization.name}. Each channel is verified directly with its platform.`}
      />

      <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm">
        <p className="font-medium flex items-center gap-2">
          <Tv className="h-4 w-4 text-muted-foreground" /> How channels work
        </p>
        <p className="mt-1 text-muted-foreground">Connect a platform in Connections, then add the creator handle/login. We verify it exists and make it available to every campaign in this workspace. One connection can support multiple channels.</p>
      </div>

      {!anyConnected && (
        <div className="rounded-[12px] border border-warning/30 bg-warning-soft p-4 text-sm">
          <p className="font-medium">Connect a platform first</p>
          <p className="text-muted-foreground">
            You need a platform connection before adding channels.{" "}
            <Link href={`/dashboard/${orgSlug}/connections` as Route} className="text-primary underline">
              Go to Connections
            </Link>
          </p>
        </div>
      )}

      <section className="space-y-4">
        <SectionHeader
          title="Channels"
          description="Which creator identities are tracked for proof. Used by all campaigns in this workspace."
          action={<span className="text-xs font-medium text-muted-foreground">{channelList.length} connected</span>}
        />

        {channelList.length === 0 ? (
          <EmptyState
            icon={<Users className="h-5 w-5" />}
            title="No creator channels yet"
            description="You don't have any creator channels connected yet. Connect a platform from Connections to add your first channel."
            action={
              <Link href={`/dashboard/${orgSlug}/connections` as Route}>
                <Button>Go to Connections</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {channelList.map((ch) => (
              <Card key={ch.id} variant="default" className="overflow-hidden">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${ch.platform === "youtube" ? "bg-[hsl(0_72%_51%)]" : ch.platform === "twitch" ? "bg-[hsl(264_35%_48%)]" : "bg-[hsl(142_40%_42%)]"}`} aria-hidden />
                      <span className="text-xs font-medium capitalize text-muted-foreground">{ch.platform}</span>
                    </div>
                    <StatusBadge status={ch.connection_status} />
                  </div>
                  <div>
                    <p className="text-sm font-medium truncate">{ch.display_name ?? ch.external_handle}</p>
                    <p className="text-xs text-muted-foreground truncate">{ch.external_handle}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Used by {campaignCount} campaign{campaignCount !== 1 ? "s" : ""}</span>
                    <span aria-hidden>·</span>
                    <span className="capitalize">{ch.platform}</span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <a href={ch.canonical_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      View channel <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Manage / add channels */}
        <Card variant="muted" className="border-dashed">
          <CardHeader>
            <CardTitle className="text-base">Manage channels</CardTitle>
            <CardDescription>All campaigns check these channels. Removing a channel only removes it locally — not from the external platform.</CardDescription>
          </CardHeader>
          <CardContent>
            <ConnectedChannelsList orgSlug={orgSlug} channels={channels as never} />
          </CardContent>
        </Card>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <Card variant="default" className="p-5 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[hsl(0_72%_51%)]" aria-hidden /> YouTube
            </h4>
            {!hasYouTube ? (
              <p className="text-xs text-muted-foreground">
                <Link href={`/dashboard/${orgSlug}/connections` as Route} className="text-primary underline">Connect YouTube</Link> in Connections first.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">YouTube is ready. Enter a handle to verify the creator’s channel.</p>
            )}
            <ConnectYouTubeForm orgSlug={orgSlug} hasCredentials={hasYouTube} />
          </Card>
          <Card variant="default" className="p-5 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[hsl(264_35%_48%)]" aria-hidden /> Twitch
            </h4>
            {!hasTwitch ? (
              <p className="text-xs text-muted-foreground">
                <Link href={`/dashboard/${orgSlug}/connections` as Route} className="text-primary underline">Connect Twitch</Link> in Connections first.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Twitch is ready. Enter the creator’s login to verify.</p>
            )}
            <ConnectTwitchForm orgSlug={orgSlug} hasCredentials={hasTwitch} />
          </Card>
          <Card variant="default" className="p-5 space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-[hsl(142_40%_42%)]" aria-hidden /> Kick
            </h4>
            {!hasKick ? (
              <p className="text-xs text-muted-foreground">
                <Link href={`/dashboard/${orgSlug}/connections` as Route} className="text-primary underline">Connect Kick</Link> in Connections first.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Kick is ready. Enter the creator’s slug to verify.</p>
            )}
            <ConnectKickForm orgSlug={orgSlug} hasCredentials={hasKick} />
            <p className="text-[11px] text-muted-foreground">Kick VOD is not supported yet — live and channel verification only.</p>
          </Card>
        </div>
      </section>
    </div>
  );
}
