import * as React from "react";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { SectionHeader } from "@/components/ui/section-header";
import { createClient } from "@/lib/supabase/server";
import { listCampaigns } from "@/features/sponsor-sentinel/services/campaign-service";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import { getScanHistory } from "@/features/sponsor-sentinel/services/scan-history";
import { groupProofByContent } from "@/features/sponsor-sentinel/services/proof-grouping";
import Link from "next/link";
import type { Route } from "next";
import { ShieldCheck, Tv, History, TriangleAlert, CheckCircle, ArrowRight, Sparkles, Clock3, ExternalLink, Video } from "lucide-react";

function youtubeThumb(externalContentId: string | null): string | null {
  if (!externalContentId) return null;
  // YouTube video IDs are 11 chars, alphanumeric + _-
  if (!/^[a-zA-Z0-9_-]{6,}$/.test(externalContentId)) return null;
  return `https://i.ytimg.com/vi/${externalContentId}/hqdefault.jpg`;
}

function formatRelative(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `${days}d ago`;
    return new Intl.DateTimeFormat("en-GB", { month: "short", day: "numeric", year: "numeric" }).format(d);
  } catch {
    return iso;
  }
}

export default async function OrgDashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  const supabase = await createClient();

  const [campaigns, channels, scanHistory, deliverables] = await Promise.all([
    listCampaigns(supabase, ctx.organization.id).catch(() => []),
    listConnectedChannelsByOrg(supabase, ctx.organization.id).catch(() => []),
    getScanHistory(supabase, ctx.organization.id).catch(() => ({ scans: [], total: 0 }) as never),
    (async () => {
      try {
        const { data } = await supabase.from("deliverables").select("id, campaign_id, name, rule, status").eq("organization_id", ctx.organization.id);
        return (data ?? []) as unknown as Array<{ id: string; campaign_id: string; name: string; rule: unknown; status: string }>;
      } catch {
        return [] as Array<{ id: string; campaign_id: string; name: string; rule: unknown; status: string }>;
      }
    })(),
  ]);

  const connectedCount = channels.filter((c) => c.connection_status === "connected").length;
  const activeCampaigns = campaigns.filter((c) => c.status === "active");
  const hasCampaigns = campaigns.length > 0;
  const hasChannels = connectedCount > 0;
  const deliverablesByCampaign = new Map<string, typeof deliverables>();
  for (const d of deliverables) {
    const arr = deliverablesByCampaign.get(d.campaign_id) ?? [];
    arr.push(d);
    deliverablesByCampaign.set(d.campaign_id, arr);
  }

  // Recent proof — last 6 evidence, content-centric
  let proofGroups: ReturnType<typeof groupProofByContent> = [];
  let proofTodayCount = 0;
  try {
    const { data: evRows } = await supabase
      .from("evidence")
      .select("id, organization_id, campaign_id, deliverable_id, scan_id, platform, external_channel_id, external_content_id, evidence_type, source, source_id, source_url, observed_value, observed_at, normalized_value, scanner_version, created_at")
      .eq("organization_id", ctx.organization.id)
      .order("observed_at", { ascending: false })
      .limit(6);
    const evidence = (evRows ?? []) as never as import("@/types/database").Evidence[];
    if (evidence.length > 0) {
      const evIds = evidence.map((e) => e.id);
      const { data: evalRows } = await supabase.from("evaluations").select("id, evidence_id, deliverable_id, result, reason, evaluated_at, scan_id").in("evidence_id", evIds).eq("organization_id", ctx.organization.id);
      const evaluations = (evalRows ?? []) as never as import("@/types/database").Evaluation[];
      const deliverableMap = new Map<string, { name: string; rule: unknown }>(deliverables.map((d) => [d.id, { name: d.name, rule: d.rule }]));
      proofGroups = groupProofByContent(evidence, evaluations, deliverableMap);
      const today = new Date().toISOString().slice(0, 10);
      proofTodayCount = evidence.filter((e) => e.observed_at?.slice(0, 10) === today).length;
    }
  } catch {
    proofGroups = [];
  }

  const scans = scanHistory.scans.slice(0, 5);
  const recentCampaigns = campaigns.slice(0, 4);

  // Needs Attention — priority ordered
  type Attention = { title: string; reason: string; href: Route; tone: "warning" | "destructive" | "info"; meta?: string };
  const attention: Attention[] = [];
  if (!hasCampaigns) {
    attention.push({ title: "Create your first campaign", reason: "No sponsorship campaign yet — create one to start tracking proof.", href: `/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route, tone: "info" });
  }
  if (hasCampaigns && !hasChannels) {
    attention.push({ title: "Connect a creator channel", reason: "Campaigns need a channel to check for proof.", href: `/dashboard/${orgSlug}/channels` as Route, tone: "warning" });
  }
  for (const c of campaigns) {
    const reqs = deliverablesByCampaign.get(c.id) ?? [];
    if (c.status === "active" && reqs.length === 0) {
      attention.push({ title: c.name, reason: "Active campaign has no requirements — add a requirement to keep checking.", href: `/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${c.id}` as Route, tone: "warning", meta: "No requirements" });
    }
    if (c.status === "active" && new Date(c.ends_at) < new Date()) {
      attention.push({ title: c.name, reason: "Campaign window ended — still tracking. Consider completing it.", href: `/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${c.id}` as Route, tone: "destructive", meta: "Ended" });
    }
  }
  // failed recent check
  for (const item of scans.slice(0, 3)) {
    if (item.scan.status === "failed") {
      attention.push({ title: item.campaignName ?? "Check failed", reason: "Last check did not complete — view check for details.", href: `/dashboard/${orgSlug}/sponsor-sentinel/scans/${item.scan.id}` as Route, tone: "destructive", meta: item.scan.platform });
    }
  }
  const attentionDisplay = attention.slice(0, 4);

  const heroMetrics = [
    { label: "Campaigns tracking", value: String(activeCampaigns.length), sub: `${campaigns.length} total`, icon: ShieldCheck },
    { label: "Proof found today", value: String(proofTodayCount), sub: proofGroups.length > 0 ? `${proofGroups.length} recent` : "No proof yet", icon: CheckCircle },
    { label: "Connected channels", value: String(connectedCount), sub: hasChannels ? "Ready" : "Not connected", icon: Tv },
  ];

  return (
    <div className="space-y-10">
      {/* Greeting */}
      <div className="space-y-2">
        <h1 className="font-display text-[30px] leading-tight tracking-[-0.02em] sm:text-[32px]">{ctx.organization.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">Sponsorship tracking at a glance.</p>
      </div>

      {/* Hero metrics — 3 compact editorial tiles */}
      <div className="grid gap-3 sm:grid-cols-3">
        {heroMetrics.map((m) => {
          const Icon = m.icon;
          return (
            <div key={m.label} className="rounded-[16px] border border-border bg-card p-4 sm:p-5">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-surface-muted border border-border">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </span>
                <span className="text-xs font-medium text-muted-foreground">{m.label}</span>
              </div>
              <p className="mt-3 text-[28px] font-bold leading-none tracking-[-0.02em] tabular-nums">{m.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{m.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Needs Attention */}
      <section className="space-y-3" aria-labelledby="needs-attention-heading">
        <SectionHeader title="Needs Attention" description="What should you care about now?" icon={<TriangleAlert className="h-4 w-4" />} />
        {attentionDisplay.length === 0 ? (
          <Card variant="muted">
            <CardContent className="flex items-center gap-3 py-6">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success text-success-foreground">
                <CheckCircle className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-medium">All clear — nothing needs attention.</p>
                <p className="text-xs text-muted-foreground">Campaigns, channels and checks are in good shape.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60" aria-label="Needs attention">
                {attentionDisplay.map((item, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex items-start gap-3">
                      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${item.tone === "destructive" ? "bg-destructive text-destructive-foreground" : item.tone === "warning" ? "bg-warning text-warning-foreground" : "bg-info text-white"}`} aria-hidden>
                        {item.tone === "destructive" ? "!" : item.tone === "warning" ? "•" : "○"}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground line-clamp-1">{item.reason}</p>
                        {item.meta ? <p className="text-[11px] text-muted-foreground">{item.meta}</p> : null}
                      </div>
                    </div>
                    <Link href={item.href} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary hover:underline">
                      View <ArrowRight className="h-3 w-3" />
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>

      {/* Recent Proof — hero */}
      <section className="space-y-3" aria-labelledby="recent-proof-heading">
        <SectionHeader
          title="Recent Proof"
          description="Content-centric — each item once with all requirements it satisfies."
          icon={<Sparkles className="h-4 w-4" />}
          action={
            proofGroups.length > 0 ? (
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1">
                View checks <ArrowRight className="h-3 w-3" />
              </Link>
            ) : undefined
          }
        />
        {proofGroups.length === 0 ? (
          <EmptyState
            icon={<Sparkles className="h-5 w-5" />}
            title="No proof yet"
            description="Once eligible content is checked, verified proof will appear here."
            action={
              hasCampaigns ? (
                <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
                  <Button>View campaigns</Button>
                </Link>
              ) : (
                <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
                  <Button>Create campaign</Button>
                </Link>
              )
            }
            secondaryAction={
              !hasChannels ? (
                <Link href={`/dashboard/${orgSlug}/channels` as Route}>
                  <Button variant="outline">Connect channel</Button>
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {proofGroups.slice(0, 4).map((g) => {
              const ytThumb = g.platform === "youtube" ? youtubeThumb(g.contentId) : null;
              const passCount = g.requirements.filter((r) => r.result === "PASS").length;
              const total = g.requirements.length;
              return (
                <div key={`${g.scanId}-${g.contentId}`} className="rounded-[16px] border border-border bg-card p-4">
                  <div className="flex gap-3">
                    <div className="h-[68px] w-[120px] shrink-0 overflow-hidden rounded-[8px] border border-border bg-surface-muted flex items-center justify-center">
                      {ytThumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={ytThumb} alt="" className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <Video className="h-5 w-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={g.platform === "youtube" ? "platform-youtube" : g.platform === "twitch" ? "platform-twitch" : "platform-kick"} className="capitalize text-[10px]">
                          {g.platform}
                        </Badge>
                        {g.observedAt ? <span className="text-xs text-muted-foreground">{formatRelative(g.observedAt)}</span> : null}
                      </div>
                      <p className="line-clamp-2 text-sm font-medium leading-snug" title={g.title}>
                        {g.title ?? `Content ${g.contentId.slice(0, 8)}`}
                      </p>
                      {g.sourceUrl ? (
                        <a href={g.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                          View source <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 rounded-[8px] bg-surface-muted px-3 py-2">
                    <span className={`flex h-6 w-6 items-center justify-center rounded-full ${passCount === total && total > 0 ? "bg-success text-white" : passCount > 0 ? "bg-warning text-white" : "bg-muted text-muted-foreground"}`}>
                      <CheckCircle className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-xs font-medium">
                      {passCount === total && total > 0 ? `${total} requirements satisfied` : `${passCount}/${total} satisfied`}
                    </span>
                    <span className="ml-auto text-xs text-muted-foreground">{total} requirements</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Campaigns strip */}
      <section className="space-y-3" aria-labelledby="campaigns-strip-heading">
        <SectionHeader
          title="Campaigns"
          description="Active sponsorship tracking."
          icon={<ShieldCheck className="h-4 w-4" />}
          action={
            <div className="flex gap-2">
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
                <Button variant="outline" size="sm">View all</Button>
              </Link>
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
                <Button size="sm">Create</Button>
              </Link>
            </div>
          }
        />
        {recentCampaigns.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-5 w-5" />}
            title="No campaigns yet"
            description="Create your first sponsorship campaign to start tracking proof."
            action={
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/new` as Route}>
                <Button>Create campaign</Button>
              </Link>
            }
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {recentCampaigns.map((c) => {
              const reqCount = deliverablesByCampaign.get(c.id)?.length ?? 0;
              return (
                <Link key={c.id} href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${c.id}` as Route} className="group rounded-[16px] border border-border bg-card p-4 hover:bg-surface-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium group-hover:text-primary transition-colors">{c.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{c.description ?? "No description"}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{reqCount} requirements • {new Date(c.ends_at).toLocaleDateString("en-GB", { month: "short", day: "numeric", year: "numeric" })}</p>
                    </div>
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {/* Recent Checks */}
      <section className="space-y-3" aria-labelledby="recent-checks-heading">
        <SectionHeader
          title="Recent Checks"
          description="Latest checks — newest first."
          icon={<History className="h-4 w-4" />}
          action={
            scans.length > 0 ? (
              <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route} className="text-xs font-medium text-primary hover:underline">
                View all checks
              </Link>
            ) : undefined
          }
        />
        {scans.length === 0 ? (
          <EmptyState
            icon={<Clock3 className="h-5 w-5" />}
            title="No checks yet"
            description="Checks run automatically for active campaigns. Start tracking to see history."
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              <ul className="divide-y divide-border/60">
                {scans.map((item) => (
                  <li key={item.scan.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium truncate">
                        <span className="truncate">{item.campaignName ?? "Campaign"}</span>
                        <Badge variant={item.scan.platform === "youtube" ? "platform-youtube" : item.scan.platform === "twitch" ? "platform-twitch" : "platform-kick"} className="capitalize text-[10px]">
                          {item.scan.platform}
                        </Badge>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatRelative(item.scan.started_at)} • {item.evidenceCount} proof • {Object.entries(item.evaluationSummary).map(([k, v]) => `${k}:${v}`).join(" ") || "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={item.scan.status} />
                      <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans/${item.scan.id}` as Route} className="text-xs text-primary hover:underline">
                        View
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </section>
    </div>
  );
}
