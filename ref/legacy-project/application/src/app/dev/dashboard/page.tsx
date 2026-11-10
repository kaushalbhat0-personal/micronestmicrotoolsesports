import { DashboardShell } from "@/components/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionHeader } from "@/components/ui/section-header";
import Link from "next/link";
import { ShieldCheck, Tv, History, TriangleAlert, CheckCircle, ArrowRight, Sparkles, ExternalLink, Video } from "lucide-react";

const mockOrgs = [{ id: "1", name: "TAG Esports", slug: "tag-esports" }];

export default function DashboardPreview() {
  return (
    <DashboardShell organizations={mockOrgs}>
      <div className="space-y-10">
        <div className="space-y-2">
          <h1 className="font-display text-[30px] leading-tight tracking-[-0.02em] sm:text-[32px]">TAG Esports</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Sponsorship tracking at a glance.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Campaigns tracking", value: "2", sub: "3 total", Icon: ShieldCheck },
            { label: "Proof found today", value: "4", sub: "2 recent", Icon: CheckCircle },
            { label: "Connected channels", value: "2", sub: "Ready", Icon: Tv },
          ].map((m) => (
            <div key={m.label} className="rounded-[16px] border border-border bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-surface-muted border border-border">
                  <m.Icon className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
              </div>
              <p className="mt-3 text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums">{m.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.sub}</p>
            </div>
          ))}
        </div>
        <section className="space-y-3">
          <SectionHeader title="Needs Attention" description="What should you care about now?" icon={<TriangleAlert className="h-4 w-4" />} />
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                <li className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-warning text-warning-foreground text-xs">•</span>
                    <div>
                      <p className="text-sm font-medium">Spring Sponsor 2026</p>
                      <p className="text-xs text-muted-foreground">Active campaign has no requirements — add a requirement to keep checking.</p>
                      <p className="text-[11px] text-muted-foreground">No requirements</p>
                    </div>
                  </div>
                  <Link href="#" className="inline-flex items-center gap-1 text-xs font-medium text-primary">View <ArrowRight className="h-3 w-3" /></Link>
                </li>
                <li className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">!</span>
                    <div>
                      <p className="text-sm font-medium">Summer Cup — Check failed</p>
                      <p className="text-xs text-muted-foreground">Last check did not complete — view check for details.</p>
                    </div>
                  </div>
                  <Link href="#" className="inline-flex items-center gap-1 text-xs font-medium text-primary">View <ArrowRight className="h-3 w-3" /></Link>
                </li>
              </ul>
            </CardContent>
          </Card>
        </section>
        <section className="space-y-3">
          <SectionHeader title="Recent Proof" description="Content-centric — each item once with all requirements it satisfies." icon={<Sparkles className="h-4 w-4" />} action={<span className="text-xs font-medium text-primary">View checks →</span>} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[16px] border border-border bg-card p-4">
              <div className="flex gap-3">
                <div className="h-[68px] w-[120px] shrink-0 overflow-hidden rounded-[8px] border border-border bg-surface-muted flex items-center justify-center">
                  <img src="https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg" alt="" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="platform-youtube" className="capitalize text-[10px]">youtube</Badge>
                    <span className="text-xs text-muted-foreground">2h ago</span>
                  </div>
                  <p className="line-clamp-2 text-sm font-medium leading-snug">#OurBrand Cup Finals — Sponsored Stream Title</p>
                  <a href="#" className="inline-flex items-center gap-1 text-xs font-medium text-primary">View source <ExternalLink className="h-3 w-3" /></a>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-surface-muted px-3 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success text-white"><CheckCircle className="h-3.5 w-3.5" /></span>
                <span className="text-xs font-medium">2 requirements satisfied</span>
                <span className="ml-auto text-xs text-muted-foreground">2 requirements</span>
              </div>
            </div>
            <div className="rounded-[16px] border border-border bg-card p-4">
              <div className="flex gap-3">
                <div className="h-[68px] w-[120px] shrink-0 overflow-hidden rounded-[8px] border border-border bg-surface-muted flex items-center justify-center"><Video className="h-5 w-5 text-muted-foreground" /></div>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-1.5"><Badge variant="platform-twitch" className="capitalize text-[10px]">twitch</Badge><span className="text-xs text-muted-foreground">5h ago</span></div>
                  <p className="line-clamp-2 text-sm font-medium leading-snug">divine1701 — Live: SponsorCup Qualifiers</p>
                  <a href="#" className="inline-flex items-center gap-1 text-xs font-medium text-primary">View source <ExternalLink className="h-3 w-3" /></a>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-surface-muted px-3 py-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning text-white"><CheckCircle className="h-3.5 w-3.5" /></span>
                <span className="text-xs font-medium">1/2 satisfied</span>
                <span className="ml-auto text-xs text-muted-foreground">2 requirements</span>
              </div>
            </div>
          </div>
        </section>
        <section className="space-y-3">
          <SectionHeader title="Campaigns" description="Active sponsorship tracking." icon={<ShieldCheck className="h-4 w-4" />} action={<Button size="sm">Create</Button>} />
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-[16px] border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Spring Sponsor 2026</p><p className="text-xs text-muted-foreground line-clamp-1">Sponsor deliverables for spring</p><p className="mt-1 text-xs text-muted-foreground">2 requirements • Mar 30, 2026</p></div><StatusBadge status="active" /></div>
            </div>
            <div className="rounded-[16px] border border-border bg-card p-4">
              <div className="flex items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">Summer Cup</p><p className="text-xs text-muted-foreground line-clamp-1">No description</p><p className="mt-1 text-xs text-muted-foreground">1 requirements • Jun 15, 2026</p></div><StatusBadge status="draft" /></div>
            </div>
          </div>
        </section>
        <section className="space-y-3">
          <SectionHeader title="Recent Checks" description="Latest checks — newest first." icon={<History className="h-4 w-4" />} />
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                <li className="flex items-center justify-between gap-3 p-4"><div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-medium"><span>Spring Sponsor 2026</span><Badge variant="platform-youtube" className="text-[10px]">youtube</Badge></p><p className="text-xs text-muted-foreground">2h ago • 3 proof • PASS:2 FAIL:1</p></div><div className="flex items-center gap-2"><StatusBadge status="success" /><span className="text-xs text-primary">View</span></div></li>
                <li className="flex items-center justify-between gap-3 p-4"><div className="min-w-0 flex-1"><p className="flex items-center gap-2 text-sm font-medium"><span>Summer Cup</span><Badge variant="platform-twitch" className="text-[10px]">twitch</Badge></p><p className="text-xs text-muted-foreground">5h ago • 1 proof • PASS:1</p></div><div className="flex items-center gap-2"><StatusBadge status="partial" /><span className="text-xs text-primary">View</span></div></li>
              </ul>
            </CardContent>
          </Card>
        </section>
      </div>
    </DashboardShell>
  );
}
