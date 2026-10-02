import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProviderCredentialRow, toMaskedView } from "@/server/credentials/repository";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { SectionHeader } from "@/components/ui/section-header";
import { IntegrationsForm } from "@/features/sponsor-sentinel/components/integrations-form";
import { ConnectYouTubeForm } from "@/features/sponsor-sentinel/components/connect-youtube-form";
import { ConnectTwitchForm } from "@/features/sponsor-sentinel/components/connect-twitch-form";
import { ConnectKickForm } from "@/features/sponsor-sentinel/components/connect-kick-form";
import { ConnectedChannelsList } from "@/features/sponsor-sentinel/components/connected-channels-list";

export default async function IntegrationsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  // Read via service_role to avoid RLS select limitation but still scoped
  // Use admin client with explicit org check (already verified membership)
  const admin = createAdminClient();
  const [twitchRow, youtubeRow, kickRow] = await Promise.all([
    getProviderCredentialRow(admin as never, ctx.organization.id, "twitch"),
    getProviderCredentialRow(admin as never, ctx.organization.id, "youtube"),
    getProviderCredentialRow(admin as never, ctx.organization.id, "kick"),
  ]);

  const twitch = toMaskedView(twitchRow);
  const youtube = toMaskedView(youtubeRow);
  const kick = toMaskedView(kickRow);

  // Connected channels — organization-level, RLS-scoped via authenticated client
  const supabase = await createClient();
  const { data: channels } = await supabase
    .from("connected_channels")
    .select("*")
    .eq("organization_id", ctx.organization.id)
    .order("created_at", { ascending: true });

  const hasYouTube = youtube.configured;
  const hasTwitch = twitch.configured;
  const hasKick = kick.configured;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connections"
        description={`Connect the platforms where your creators publish for ${ctx.organization.name}. We use these to verify sponsorship activity — not to post or manage your accounts.`}
      />

      <div className="rounded-lg border bg-muted/20 p-4 text-sm">
        <p className="font-medium">How it works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Connect YouTube, Twitch or Kick — your API access lets us read public channel activity.</li>
          <li>Connect a creator channel — we’ll verify it exists and save it to this workspace.</li>
          <li>Create a campaign and start tracking — campaigns check all connected channels for proof.</li>
        </ol>
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Platform connections"
          description="Connect YouTube, Twitch or Kick so we can access public channel activity. Your credentials are encrypted and never shown again."
        />
        <IntegrationsForm orgSlug={orgSlug} twitch={twitch} youtube={youtube} kick={kick} />
        <p className="text-xs text-muted-foreground">Your workspace credentials are used first, then platform defaults if needed.</p>
      </section>

      <section className="space-y-4">
        <SectionHeader
          title="Creator channels"
          description="Connect the channels where your creators publish. Sponsorship campaigns use these channels to check for proof."
          action={<span className="text-xs text-muted-foreground">{channels?.length ?? 0} connected</span>}
        />
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Connected creator channels</CardTitle>
            <CardDescription>All campaigns in this workspace check these channels.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <ConnectedChannelsList orgSlug={orgSlug} channels={(channels ?? []) as never} />
            <div className="grid gap-6 border-t pt-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-red-500" aria-hidden /> Connect YouTube
                </h4>
                {!hasYouTube ? (
                  <p className="text-sm text-destructive">Add your YouTube API key above to enable YouTube channel verification.</p>
                ) : (
                  <p className="text-xs text-muted-foreground">YouTube is ready. Enter a handle to connect the creator’s channel.</p>
                )}
                <ConnectYouTubeForm orgSlug={orgSlug} hasCredentials={hasYouTube} />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-purple-500" aria-hidden /> Connect Twitch
                </h4>
                {!hasTwitch ? (
                  <p className="text-sm">
                    <span className="text-destructive">Connect your Twitch API access first.</span>{" "}
                    <span className="text-muted-foreground">Add Client ID &amp; Secret above.</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Twitch is ready. Enter the creator’s login to connect.</p>
                )}
                <ConnectTwitchForm orgSlug={orgSlug} hasCredentials={hasTwitch} />
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden /> Connect Kick
                </h4>
                {!hasKick ? (
                  <p className="text-sm">
                    <span className="text-destructive">Connect your Kick API access first.</span>{" "}
                    <span className="text-muted-foreground">Add Client ID &amp; Secret above.</span>
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">Kick is ready. Enter the creator’s slug to connect.</p>
                )}
                <ConnectKickForm orgSlug={orgSlug} hasCredentials={hasKick} />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">We verify channels directly with YouTube, Twitch and Kick. Your keys are never shown in the browser.</p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
