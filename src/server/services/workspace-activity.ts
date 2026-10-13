import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDayKolkata } from "@/lib/utils/format";
import { listCampaigns } from "@/features/sponsor-sentinel/services/campaign-service";
import { getScanHistory } from "@/features/sponsor-sentinel/services/scan-history";
import { listConnectedChannelsByOrg } from "@/server/repositories/connected-channels";
import { getHistory as getTieBreakerHistory } from "@/features/tie-breaker/services/history";
import { getHistory as getDraftBanHistory } from "@/features/draft-ban/services/match-service";
import { listTrackers } from "@/features/payout-tracker/services/tracker-service";
import { resolveTieBreakerAccessLevel } from "@/server/services/tie-breaker-policy";
import { resolveDraftBanAccessLevel } from "@/server/services/draft-ban-policy";

/**
 * Workspace home view-model composer (RCCF-FIRST-VALUE-FIX-03 F3).
 *
 * Read-only aggregation for the toolbox workspace home: recent activity
 * across operational tools plus a compact sponsorship status strip. No
 * writes, no authorization decisions (page gates + RLS own those), and
 * every source degrades to empty on failure so one broken tool never
 * breaks the workspace home.
 *
 * Layering note: this composer calls feature list-services directly. That
 * is deliberate — reimplementing their Free-window logic in repositories
 * would duplicate policy. It never writes and never bypasses gates.
 */

export interface WorkspaceActivityItem {
  readonly kind: "competition" | "match" | "tracker";
  readonly title: string;
  readonly detail: string;
  readonly href: string;
  /** ISO timestamp used for newest-first ordering. */
  readonly at: string;
}

export interface SponsorshipStrip {
  readonly campaignsTotal: number;
  readonly activeCampaigns: number;
  readonly connectedChannels: number;
  readonly lastCheckAt: string | null;
  readonly lastCheckPlatform: string | null;
}

function toTime(value: string | null | undefined): number {
  const t = value ? Date.parse(value) : NaN;
  return Number.isFinite(t) ? (t as number) : 0;
}

function formatDate(iso: string): string {
  return formatDayKolkata(iso);
}

/**
 * Newest-first activity across Tie-Breaker, Draft & Ban, and Payout
 * Tracker. Stateless tools (Splitter, Roster) persist nothing by design
 * and therefore contribute no activity.
 */
export async function getWorkspaceRecentActivity(
  supabase: SupabaseClient,
  orgSlug: string,
  organizationId: string,
  limit = 6
): Promise<WorkspaceActivityItem[]> {
  const [tieLevel, draftLevel] = await Promise.all([
    resolveTieBreakerAccessLevel(supabase, { organizationId }).catch(() => "paid" as const),
    resolveDraftBanAccessLevel(supabase, { organizationId }).catch(() => "paid" as const),
  ]);

  const [competitions, matches, trackers] = await Promise.all([
    getTieBreakerHistory(
      supabase,
      organizationId,
      { limit: 3 },
      tieLevel === "free" ? "free" : "paid"
    )
      .then((h) => h.competitions)
      .catch(() => []),
    getDraftBanHistory(
      supabase,
      organizationId,
      { limit: 3 },
      draftLevel === "free" ? "free" : "paid"
    )
      .then((h) => h.matches)
      .catch(() => []),
    listTrackers(supabase, organizationId)
      .then((r) => r.summaries)
      .catch(() => []),
  ]);

  const items: WorkspaceActivityItem[] = [];
  for (const c of competitions.slice(0, 3)) {
    items.push({
      kind: "competition",
      title: c.name,
      detail: c.status === "locked" && c.record_number ? `Locked · ${c.record_number}` : c.status,
      href: `/dashboard/${orgSlug}/tie-breaker/${c.id}`,
      at: c.updated_at,
    });
  }
  for (const m of matches.slice(0, 3)) {
    items.push({
      kind: "match",
      title: m.match_name ?? `${m.team_a} vs ${m.team_b}`,
      detail: m.status === "completed" ? "Completed official record" : m.status.replace("_", " "),
      href: `/dashboard/${orgSlug}/draft-ban/${m.id}`,
      at: m.updated_at,
    });
  }
  for (const s of trackers.slice(0, 3)) {
    items.push({
      kind: "tracker",
      title: s.tracker.event_name,
      detail: `${s.tracker.status} · ${s.paidCount}/${s.totalCount} paid`,
      href: `/dashboard/${orgSlug}/payout-tracker/${s.tracker.id}`,
      at: s.tracker.updated_at,
    });
  }
  return items.sort((a, b) => toTime(b.at) - toTime(a.at)).slice(0, limit);
}

/** Compact sponsorship presence for the workspace home (full detail lives in Sponsorship Tracking). */
export async function getWorkspaceSponsorshipStrip(
  supabase: SupabaseClient,
  organizationId: string
): Promise<SponsorshipStrip> {
  const [campaigns, channels, scans] = await Promise.all([
    listCampaigns(supabase, organizationId).catch(() => []),
    listConnectedChannelsByOrg(supabase, organizationId).catch(() => []),
    getScanHistory(supabase, organizationId).catch(() => ({ scans: [], total: 0 })),
  ]);
  const last = scans.scans[0];
  return {
    campaignsTotal: campaigns.length,
    activeCampaigns: campaigns.filter((c) => c.status === "active").length,
    connectedChannels: channels.filter((c) => c.connection_status === "connected").length,
    lastCheckAt: last ? last.scan.started_at : null,
    lastCheckPlatform: last ? last.scan.platform : null,
  };
}

export function formatActivityDate(iso: string): string {
  return formatDate(iso);
}
