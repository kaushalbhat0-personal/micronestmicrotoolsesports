import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProviderCredentialsByOrg, toMaskedView } from "@/server/credentials/repository";
import { getOAuthAvailability } from "@/server/oauth/availability";
import { IntegrationsForm } from "@/features/sponsor-sentinel/components/integrations-form";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import type { Route } from "next";
import { Plug, ShieldCheck, Info, TriangleAlert } from "lucide-react";

const CHANNEL_SAVE_FAILED_COPY: Record<string, string> = {
  youtube: "Your YouTube account was authorized, but the channel couldn't be saved. Please try connecting again. If the problem continues, contact support.",
  twitch: "Your Twitch account was authorized, but the channel couldn't be saved. Please try connecting again. If the problem continues, contact support.",
  kick: "Your Kick account was authorized, but the channel couldn't be saved. Please try connecting again. If the problem continues, contact support.",
};

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ oauth?: string; provider?: string }>;
}) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  } catch (e) {
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }

  const admin = createAdminClient();
  const providerRows = await listProviderCredentialsByOrg(admin as never, ctx.organization.id);
  const twitch = toMaskedView(providerRows.twitch);
  const youtube = toMaskedView(providerRows.youtube);
  const kick = toMaskedView(providerRows.kick);

  // Server-side OAuth capability — the only availability signal. Never faked.
  const availability = getOAuthAvailability();

  const sp = searchParams ? await searchParams : undefined;
  const channelSaveFailed =
    sp?.oauth === "channel_save_failed" && sp?.provider && CHANNEL_SAVE_FAILED_COPY[sp.provider]
      ? sp.provider
      : null;

  const platforms = [
    {
      key: "youtube" as const,
      name: "YouTube",
      icon: "bg-[hsl(0_72%_51%)]",
      desc: "Connect YouTube to discover creator videos and verify sponsorship requirements. Videos and channel metadata.",
      note: null as string | null,
      masked: youtube,
    },
    {
      key: "twitch" as const,
      name: "Twitch",
      icon: "bg-[hsl(264_35%_48%)]",
      desc: "Connect Twitch to verify sponsored livestream and VOD content. Live and past broadcasts.",
      note: null as string | null,
      masked: twitch,
    },
    {
      key: "kick" as const,
      name: "Kick",
      icon: "bg-[hsl(142_40%_42%)]",
      desc: "Connect Kick to support sponsored content where supported. Live and channel verification.",
      note: "Some content types may not be supported yet — Kick VOD is not available in this MVP.",
      masked: kick,
    },
  ];

  const allConnected = platforms.every((p) => p.masked.configured);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Platform Connections"
        description={`Which accounts are connected for ${ctx.organization.name}? Connect once per platform — we keep your connection secure.`}
      />

      {channelSaveFailed ? (
        <div role="alert" className="rounded-[12px] border border-warning/30 bg-warning-soft p-4 text-sm">
          <p className="font-medium flex items-center gap-2">
            <TriangleAlert className="h-4 w-4" /> Channel couldn’t be saved
          </p>
          <p className="mt-1 text-muted-foreground">{CHANNEL_SAVE_FAILED_COPY[channelSaveFailed]}</p>
        </div>
      ) : null}

      <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm">
        <p className="font-medium flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" /> How it works
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Connect your YouTube, Twitch, or Kick account — one click, nothing to set up.</li>
          <li>
            Add creator channels in{" "}
            <Link href={`/dashboard/${orgSlug}/channels` as Route} className="text-primary underline">
              Channels
            </Link>
            — we verify they exist with the platform.
          </li>
          <li>
            Sponsorship Tracking then uses all channels in{" "}
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route} className="text-primary underline">
              Campaigns
            </Link>{" "}
            to check for proof.
          </li>
        </ol>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {platforms.map((p) => (
          <Card key={p.key} variant="default" className="p-4">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${p.icon}`} aria-hidden />
              <span className="text-sm font-medium">{p.name}</span>
              <Badge variant={p.masked.configured ? "success" : "secondary"} className="ml-auto text-[11px]">
                {p.masked.configured ? (p.masked.lastTestStatus === "success" ? "Connected" : "Connected") : "Not connected"}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.desc}</p>
            {p.note ? <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />{p.note}</p> : null}
          </Card>
        ))}
      </div>

      {allConnected ? (
        <div className="rounded-[12px] border border-success/20 bg-success-soft p-3 flex items-center gap-2 text-sm">
          <ShieldCheck className="h-4 w-4 text-success" />
          <span className="font-medium">All platforms connected</span>
          <span className="text-muted-foreground">— your workspace can track creators on YouTube, Twitch and Kick.</span>
        </div>
      ) : null}

      <section className="space-y-4">
        <SectionHeader
          title="Manage connections"
          description="Connect with one click — we keep your account connection secure. Nothing to set up."
        />
        <IntegrationsForm orgSlug={orgSlug} twitch={twitch} youtube={youtube} kick={kick} availability={availability} />
        <p className="text-xs text-muted-foreground">Connections are securely stored and never exposed. Re-connect if a platform account expires or is revoked.</p>
      </section>
    </div>
  );
}
