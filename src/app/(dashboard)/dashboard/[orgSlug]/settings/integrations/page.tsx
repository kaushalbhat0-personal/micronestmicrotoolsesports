import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getProviderCredentialRow, toMaskedView } from "@/server/credentials/repository";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { IntegrationsForm } from "@/features/sponsor-sentinel/components/integrations-form";
import { ConnectYouTubeForm } from "@/features/sponsor-sentinel/components/connect-youtube-form";
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

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description={`Provider credentials for ${ctx.organization.name} — organization-scoped, encrypted at rest, env fallback if not configured.`} />
      <IntegrationsForm orgSlug={orgSlug} twitch={twitch} youtube={youtube} kick={kick} />
      <p className="text-xs text-muted-foreground">Precedence: Organization credential → Platform environment credential. Secrets never returned to browser, never logged.</p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connected Channels</CardTitle>
          <CardDescription>Organization-level channels. Campaigns use your connected channels for Sponsor Sentinel scanning.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <ConnectedChannelsList orgSlug={orgSlug} channels={(channels ?? []) as never} />
          <div className="border-t pt-6">
            <h4 className="mb-3 text-sm font-medium">Connect YouTube Channel</h4>
            {!youtube.configured ? (
              <p className="mb-3 text-sm text-destructive">Configure your YouTube API key above first.</p>
            ) : null}
            <ConnectYouTubeForm orgSlug={orgSlug} hasCredentials={youtube.configured} />
            <p className="mt-2 text-xs text-muted-foreground">Enter handle with or without @, e.g., @GoogleDevelopers. Channel is resolved via YouTube Data API channels.list forHandle.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
