import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import Link from "next/link";
import { ShieldCheck, Tv, History, CheckCircle } from "lucide-react";

const mockOrgs = [{ id: "1", name: "TAG Esports", slug: "tag-esports" }];

export default function CampaignDetailPreview() {
  return (
    <DashboardShell organizations={mockOrgs}>
      <div className="space-y-8">
        <PageHeader title="YouTube Cartesian Proof E2E" description="Mar 10, 2026 – Mar 30, 2026 • E2E test campaign for proof verification" action={<div className="flex gap-2"><StatusBadge status="active" /><Button size="sm">Check now</Button></div>} />
        <Card variant="default" className="border-success/20 bg-success-soft">
          <CardContent className="p-4 flex items-center gap-2">
            <StatusBadge status="active" />
            <span className="text-sm font-medium">Tracking</span>
            <span className="text-sm text-muted-foreground">Checks run automatically and on demand.</span>
          </CardContent>
        </Card>
        <section className="space-y-3">
          <SectionHeader title="Requirements" description="What the sponsor requires. Each requirement shows its latest result and proof count." />
          <ul className="space-y-3">
            {[
              { name: "#spirituality", result: "PASS", proof: 2, human: "Title contains #spirituality" },
              { name: "#bhagavadgita", result: "PASS", proof: 2, human: "Title contains #bhagavadgita" },
              { name: "#yoga", result: "FAIL", proof: 0, human: "Title contains #yoga" },
            ].map((d) => (
              <li key={d.name} className="rounded-[16px] border border-border bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold">{d.name}</h3>
                      <StatusBadge status={d.result} />
                      <span className="text-xs rounded-full bg-surface-muted px-2 py-0.5 text-muted-foreground">{d.proof} proof</span>
                    </div>
                    <p className="text-sm">{d.human}</p>
                  </div>
                  <Button variant="ghost" size="sm">Remove</Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="space-y-3">
          <SectionHeader title="Latest Check" description="Most recent verification for this campaign." />
          <Card variant="default">
            <CardContent className="p-4 flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status="success" />
                  <Badge variant="platform-youtube" className="text-[11px]">youtube</Badge>
                  <span className="text-xs text-muted-foreground">Oct 5, 10:32 PM</span>
                </div>
                <p className="text-sm">3 proof items • 3 results • PASS:2 FAIL:1</p>
              </div>
              <span className="text-sm font-medium text-primary">View check →</span>
            </CardContent>
          </Card>
        </section>
        <section className="space-y-3">
          <SectionHeader title="Proof" description="Latest proof from this campaign — one content item appears once with all requirements it satisfies." />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[16px] border border-border bg-card p-4">
              <div className="flex gap-3">
                <div className="h-[68px] w-[120px] rounded-[8px] bg-surface-muted border flex items-center justify-center"><ShieldCheck className="h-5 w-5 text-muted-foreground" /></div>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1.5"><Badge variant="platform-youtube" className="text-[10px]">youtube</Badge><span className="text-xs text-muted-foreground">2h ago</span></div>
                  <p className="text-sm font-medium line-clamp-2">#spirituality #bhagavadgita — Sponsored Stream</p>
                  <a href="#" className="text-xs font-medium text-primary">View source</a>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-surface-muted px-3 py-2"><span className="h-6 w-6 rounded-full bg-success text-white flex items-center justify-center"><CheckCircle className="h-3.5 w-3.5" /></span><span className="text-xs font-medium">2 requirements satisfied</span></div>
            </div>
          </div>
        </section>
        <section className="space-y-3">
          <SectionHeader title="Creator Channels" description="This campaign checks content from your connected creator channels. All campaigns use every connected channel in this workspace." />
          <div className="rounded-[16px] border border-border bg-card p-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm"><Badge variant="outline">YouTube</Badge><span>Mystic Minutes</span><Badge variant="success">Ready</Badge></div>
            <a href="#" className="text-xs font-medium text-primary">Open channel</a>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
