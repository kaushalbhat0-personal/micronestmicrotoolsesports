import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { Tv, ExternalLink } from "lucide-react";

const mockOrgs = [{ id: "9790375e-5ebb-4bab-b8a4-e36e8f7f7381", name: "TAG Esports", slug: "tag-esports" }];

export default function ChannelsPreview() {
  const channels: Array<{ id: string; platform: string; external_handle: string; display_name: string | null; canonical_url: string; connection_status: string }> = [
    { id: "1", platform: "youtube", external_handle: "@mysticminutes17", display_name: "Mystic Minutes", canonical_url: "https://youtube.com/@mysticminutes17", connection_status: "connected" },
    { id: "2", platform: "twitch", external_handle: "divine1701", display_name: "divine1701", canonical_url: "https://twitch.tv/divine1701", connection_status: "connected" },
    { id: "3", platform: "kick", external_handle: "kaush1701", display_name: "Kaush1701", canonical_url: "https://kick.com/kaush1701", connection_status: "connected" },
  ];
  return (
    <DashboardShell organizations={mockOrgs}>
      <div className="space-y-8">
        <PageHeader title="Creator Channels" description="Track the creator identities your workspace uses for sponsorship tracking — TAG Esports. Each channel is verified directly with its platform." />
        <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm">
          <p className="font-medium flex items-center gap-2"><Tv className="h-4 w-4 text-muted-foreground" /> How channels work</p>
          <p className="mt-1 text-muted-foreground">Connect a platform in Connections, then add the creator handle/login. We verify it exists and make it available to every campaign in this workspace.</p>
        </div>
        <section className="space-y-4">
          <SectionHeader title="Channels" description="Which creator identities are tracked for proof." action={<span className="text-xs font-medium text-muted-foreground">3 connected</span>} />
          <div className="grid gap-3 sm:grid-cols-2">
            {channels.map((ch) => (
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
                    <p className="text-sm font-medium truncate">{ch.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{ch.external_handle}</p>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>Used by 3 campaigns</span><span>·</span><span className="capitalize">{ch.platform}</span>
                  </div>
                  <a href={ch.canonical_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">View channel <ExternalLink className="h-3 w-3" /></a>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
