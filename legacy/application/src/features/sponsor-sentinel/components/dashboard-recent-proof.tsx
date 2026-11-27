import * as React from "react";
import { createClient } from "@/lib/supabase/server";
import { groupProofByContent } from "@/features/sponsor-sentinel/services/proof-grouping";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { CheckCircle, Sparkles, ExternalLink, Video } from "lucide-react";
import Link from "next/link";
import type { Route } from "next";

function youtubeThumb(externalContentId: string | null): string | null {
  if (!externalContentId) return null;
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

export async function DashboardRecentProof({
  orgSlug,
  orgId,
  hasCampaigns,
  hasChannels,
  deliverables,
}: {
  orgSlug: string;
  orgId: string;
  hasCampaigns: boolean;
  hasChannels: boolean;
  deliverables: Array<{ id: string; name: string; rule: unknown }>;
}) {
  const supabase = await createClient();
  let proofGroups: ReturnType<typeof groupProofByContent> = [];
  try {
    const { data: evRows } = await supabase
      .from("evidence")
      .select("id, organization_id, campaign_id, deliverable_id, scan_id, platform, external_channel_id, external_content_id, evidence_type, source, source_id, source_url, observed_value, observed_at, normalized_value, scanner_version, created_at")
      .eq("organization_id", orgId)
      .order("observed_at", { ascending: false })
      .limit(6);
    const evidence = (evRows ?? []) as never as import("@/types/database").Evidence[];
    if (evidence.length > 0) {
      const evIds = evidence.map((e) => e.id);
      const { data: evalRows } = await supabase.from("evaluations").select("id, evidence_id, deliverable_id, result, reason, evaluated_at, scan_id").in("evidence_id", evIds).eq("organization_id", orgId);
      const evaluations = (evalRows ?? []) as never as import("@/types/database").Evaluation[];
      const deliverableMap = new Map<string, { name: string; rule: unknown }>(deliverables.map((d) => [d.id, { name: d.name, rule: d.rule }]));
      proofGroups = groupProofByContent(evidence, evaluations, deliverableMap);
    }
  } catch {
    proofGroups = [];
  }

  if (proofGroups.length === 0) {
    return (
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
    );
  }

  return (
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
              <span className="text-xs font-medium">{passCount === total && total > 0 ? `${total} requirements satisfied` : `${passCount}/${total} satisfied`}</span>
              <span className="ml-auto text-xs text-muted-foreground">{total} requirements</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DashboardRecentProofSkeleton() {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {[0, 1, 2, 3].map((k) => (
        <div key={k} className="rounded-[16px] border border-border bg-card p-4 animate-pulse">
          <div className="flex gap-3">
            <div className="h-[68px] w-[120px] shrink-0 rounded-[8px] bg-surface-muted" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-20 rounded bg-surface-muted" />
              <div className="h-3 w-full rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
