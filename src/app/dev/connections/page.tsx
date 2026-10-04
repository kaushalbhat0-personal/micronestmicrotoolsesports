import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plug, ShieldCheck, Info } from "lucide-react";

const mockOrgs = [{ id: "9790375e-5ebb-4bab-b8a4-e36e8f7f7381", name: "TAG Esports", slug: "tag-esports" }];

export default function ConnectionsPreview() {
  const platforms = [
    { name: "YouTube", icon: "bg-[hsl(0_72%_51%)]", desc: "Connect YouTube to discover creator videos and verify sponsorship requirements.", note: null as string | null, connected: true },
    { name: "Twitch", icon: "bg-[hsl(264_35%_48%)]", desc: "Connect Twitch to verify sponsored livestream and VOD content.", note: null as string | null, connected: true },
    { name: "Kick", icon: "bg-[hsl(142_40%_42%)]", desc: "Connect Kick to support sponsored content where supported.", note: "Some content types may not be supported yet — Kick VOD is not available in this MVP.", connected: true },
  ];
  return (
    <DashboardShell organizations={mockOrgs}>
      <div className="space-y-8">
        <PageHeader title="Platform Connections" description="Which platforms are connected for TAG Esports? Authorize once per platform via OAuth — tokens are encrypted and tenant-bound." />
        <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm">
          <p className="font-medium flex items-center gap-2"><Plug className="h-4 w-4 text-muted-foreground" /> How it works</p>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
            <li>Authorize YouTube, Twitch or Kick via OAuth — one click, no manual keys.</li>
            <li>Add creator channels in Channels — we verify they exist.</li>
            <li>Sponsorship Tracking then uses all channels to check for proof.</li>
          </ol>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {platforms.map((p) => (
            <Card key={p.name} variant="default" className="p-4">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full ${p.icon}`} aria-hidden />
                <span className="text-sm font-medium">{p.name}</span>
                <Badge variant={p.connected ? "success" : "secondary"} className="ml-auto text-[11px]">{p.connected ? "Connected" : "Not connected"}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground line-clamp-2">{p.desc}</p>
              {p.note ? <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" />{p.note}</p> : null}
            </Card>
          ))}
        </div>
        <section className="space-y-4">
          <SectionHeader title="Manage connections" description="OAuth-first — connect with one click, we store encrypted tokens." />
          <Card variant="default" className="p-6 text-center">
            <p className="text-sm text-muted-foreground">OAuth buttons appear here for each platform (Twitch/YouTube/Kick). Real flow verified via server actions.</p>
            <div className="mt-3 flex justify-center gap-2"><Button size="sm">Connect Twitch</Button><Button size="sm" variant="outline">Connect YouTube</Button></div>
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}
