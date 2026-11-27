import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import Link from "next/link";

const mockOrgs = [{ id: "1", name: "TAG Esports", slug: "tag-esports" }];

const campaigns = [
  { id: "c1", name: "Spring Sponsor 2026", description: "Sponsor deliverables for spring", status: "active", ends_at: "2026-04-30T00:00:00Z", reqCount: 3, platform: "youtube", proof: 3, result: "PASS:2 FAIL:1" },
  { id: "c2", name: "Summer Cup", description: "No description", status: "draft", ends_at: "2026-06-15T00:00:00Z", reqCount: 1, platform: null, proof: 0, result: "—" },
  { id: "c3", name: "YouTube Cartesian Proof E2E", description: "E2E test campaign", status: "active", ends_at: "2026-03-30T00:00:00Z", reqCount: 4, platform: "youtube", proof: 18, result: "PASS:4" },
];

export default function CampaignsPreview() {
  return (
    <DashboardShell organizations={mockOrgs}>
      <div className="space-y-8">
        <PageHeader title="Campaigns" description="Sponsor campaigns for TAG Esports" action={<Button size="sm">Create campaign</Button>} />
        <div className="grid gap-3 md:grid-cols-2">
          {campaigns.map((c) => (
            <Link key={c.id} href="#" className="group rounded-[16px] border border-border bg-card p-5 hover:bg-surface-muted/50 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">{c.name}</p>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <Badge variant="secondary" className="text-[11px]">{c.reqCount} requirements</Badge>
                    {c.platform ? <Badge variant={c.platform === "youtube" ? "platform-youtube" : c.platform === "twitch" ? "platform-twitch" : "platform-kick"} className="capitalize text-[10px]">{c.platform}</Badge> : null}
                    <span className="text-xs text-muted-foreground">{new Date(c.ends_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{c.proof === 0 ? "No checks yet" : `${c.proof} proof • ${c.result}`}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-primary group-hover:underline">View →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}
