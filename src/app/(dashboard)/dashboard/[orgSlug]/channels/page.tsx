import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProviderCredentialRow, toMaskedView } from "@/server/credentials/repository";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { ConnectedChannelsList } from "@/features/sponsor-sentinel/components/connected-channels-list";
import { ConnectYouTubeForm } from "@/features/sponsor-sentinel/components/connect-youtube-form";
import { ConnectTwitchForm } from "@/features/sponsor-sentinel/components/connect-twitch-form";
import { ConnectKickForm } from "@/features/sponsor-sentinel/components/connect-kick-form";
import Link from "next/link";
import type { Route } from "next";

export default async function ChannelsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  const admin = createAdminClient();
  const [twitchRow, youtubeRow, kickRow] = await Promise.all([
    getProviderCredentialRow(admin as never, ctx.organization.id, "twitch"),
    getProviderCredentialRow(admin as never, ctx.organization.id, "youtube"),
    getProviderCredentialRow(admin as never, ctx.organization.id, "kick"),
  ]);
  const twitch = toMaskedView(twitchRow);
  const youtube = toMaskedView(youtubeRow);
  const kick = toMaskedView(kickRow);

  const supabase = await createClient();
  const { data: channels } = await supabase
    .from("connected_channels")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: true });

  const hasYouTube = youtube.configured;
  const hasTwitch = twitch.configured;
  const hasKick = kick.configured;
  const anyConnected = hasYouTube || hasTwitch || hasKick;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Creator Channels"
        description={`Which creator channels are you tracking for ${ctx.organization.name}? Campaigns check these channels for proof.`}
      />
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
          title="Connected channels"
          description="Creator identities whose content is checked for sponsorship proof."
          action={<span className="text-xs text-muted-foreground">{channels?.length ?? 0} connected</span>}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Creator channels</CardTitle>
            <CardDescription>All campaigns in this workspace check these channels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ConnectedChannelsList orgSlug={orgSlug} channels={(channels ?? []) as never} />
            <div className="grid gap-6 border-t border-border pt-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[hsl(0_72%_51%)]" aria-hidden /> Connect YouTube
                </h4>
                {!hasYouTube ? (
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/dashboard/${orgSlug}/connections` as Route} className="text-primary underline">Connect YouTube</Link> in Connections first.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">YouTube is ready. Enter a handle to connect the creator’s channel.</p>
                )}
                <ConnectYouTubeForm orgSlug={orgSlug} hasCredentials={hasYouTube} />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[hsl(264_35%_48%)]" aria-hidden /> Connect Twitch
                </h4>
                {!hasTwitch ? (
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/dashboard/${orgSlug}/connections` as Route} className="text-primary underline">Connect Twitch</Link> in Connections first.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Twitch is ready. Enter the creator’s login to connect.</p>
                )}
                <ConnectTwitchForm orgSlug={orgSlug} hasCredentials={hasTwitch} />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[hsl(142_40%_42%)]" aria-hidden /> Connect Kick
                </h4>
                {!hasKick ? (
                  <p className="text-xs text-muted-foreground">
                    <Link href={`/dashboard/${orgSlug}/connections` as Route} className="text-primary underline">Connect Kick</Link> in Connections first.
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Kick is ready. Enter the creator’s slug to connect.</p>
                )}
                <ConnectKickForm orgSlug={orgSlug} hasCredentials={hasKick} />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
