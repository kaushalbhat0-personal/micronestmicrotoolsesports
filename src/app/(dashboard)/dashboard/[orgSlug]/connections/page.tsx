import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProviderCredentialsByOrg, toMaskedView } from "@/server/credentials/repository";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntegrationsForm } from "@/features/sponsor-sentinel/components/integrations-form";
import Link from "next/link";
import type { Route } from "next";
import { Plug, ShieldCheck, Info } from "lucide-react";

export default async function ConnectionsPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  const admin = createAdminClient();
  const providerRows = await listProviderCredentialsByOrg(admin as never, ctx.organization.id);
  const twitch = toMaskedView(providerRows.twitch);
  const youtube = toMaskedView(providerRows.youtube);
  const kick = toMaskedView(providerRows.kick);

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
        description={`Which platforms are connected for ${ctx.organization.name}? Authorize once per platform — tokens are securely stored for your workspace.`}
      />

      <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm">
        <p className="font-medium flex items-center gap-2">
          <Plug className="h-4 w-4 text-muted-foreground" /> How it works
        </p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
          <li>Authorize YouTube, Twitch or Kick via OAuth — one click, no manual keys.</li>
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
          description="Connect with one click — we securely store your platform account connection. No manual keys needed."
        />
        <p className="text-xs text-muted-foreground">Connections are securely stored and never exposed. Re-connect if a platform account expires or is revoked.</p>
      </section>
    </div>
  );
}
