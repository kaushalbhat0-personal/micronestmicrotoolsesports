import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderCredentialRow, toMaskedView } from "@/server/credentials/repository";
import { PageHeader } from "@/components/ui/page-header";
import { IntegrationsForm } from "@/features/sponsor-sentinel/components/integrations-form";

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

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" description={`Provider credentials for ${ctx.organization.name} — organization-scoped, encrypted at rest, env fallback if not configured.`} />
      <IntegrationsForm orgSlug={orgSlug} twitch={twitch} youtube={youtube} kick={kick} />
      <p className="text-xs text-muted-foreground">Precedence: Organization credential → Platform environment credential. Secrets never returned to browser, never logged.</p>
    </div>
  );
}
