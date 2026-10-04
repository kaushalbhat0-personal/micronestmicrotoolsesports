import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProviderCredentialRow, toMaskedView } from "@/server/credentials/repository";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { IntegrationsForm } from "@/features/sponsor-sentinel/components/integrations-form";
import Link from "next/link";
import type { Route } from "next";

export default async function ConnectionsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Connections"
        description={`Which platforms are connected for ${ctx.organization.name}? We use these to verify creator content — not to post or manage accounts.`}
      />
      <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm">
        <p className="font-medium">How it works</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Connect YouTube, Twitch or Kick via OAuth — your tokens are encrypted and tenant-bound.</li>
          <li>
            Then add creator channels in{" "}
            <Link href={`/dashboard/${orgSlug}/channels` as Route} className="text-primary underline">
              Channels
            </Link>
            — we verify they exist.
          </li>
          <li>Create a campaign and start tracking — campaigns check all connected channels for proof.</li>
        </ol>
      </div>

      <section className="space-y-4">
        <SectionHeader
          title="Platform connections"
          description="OAuth-first platform authorization. No manual API keys — connect with one click, we store encrypted tokens."
        />
        <IntegrationsForm orgSlug={orgSlug} twitch={twitch} youtube={youtube} kick={kick} />
        <p className="text-xs text-muted-foreground">Your workspace credentials are used first, then platform defaults if needed.</p>
      </section>
    </div>
  );
}
