import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { createAdminClient } from "@/lib/supabase/admin";

export type SentinelSection = "campaigns" | "channels" | "scans";

export interface SentinelOverview {
  campaigns: { count: number | null; error?: string };
  activeCampaigns: { count: number | null; error?: string };
  connectedChannels: { count: number | null; error?: string };
  totalScans: { count: number | null; error?: string };
  successfulScans: { count: number | null; error?: string };
  failedScans: { count: number | null; error?: string };
}

export interface AdminCampaignItem {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  name: string;
  status: string;
  startsAt: string;
  endsAt: string;
  createdAt: string;
}

export interface AdminChannelItem {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  platform: string;
  externalHandle: string;
  externalChannelId: string;
  connectionStatus: string;
  connectionMode: string;
  createdAt: string;
  updatedAt: string;
}

export interface AdminScanItem {
  id: string;
  organizationId: string;
  organizationName: string;
  organizationSlug: string;
  campaignId: string;
  campaignName: string | null;
  platform: string;
  status: string;
  startedAt: string | null;
  completedAt: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  scannerVersion: string;
  createdAt: string;
}

export interface AdminSentinelResult {
  overview: SentinelOverview;
  section: SentinelSection;
  query: string;
  campaignStatus: string;
  channelPlatform: string;
  channelStatus: string;
  scanStatus: string;
  scanPlatform: string;
  page: number;
  pageSize: number;
  total: number | null;
  totalError?: string | undefined;
  hasMore: boolean;
  campaigns: AdminCampaignItem[];
  channels: AdminChannelItem[];
  scans: AdminScanItem[];
  // For filter dropdowns
  platforms: string[];
}

const PAGE_SIZE = 50;
const MAX_QUERY_LEN = 100;

function parseParams(searchParams: Record<string, string | string[] | undefined>) {
  const get = (k: string) => {
    const v = searchParams[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
  };
  const rawSection = get("section").trim().toLowerCase();
  const section: SentinelSection =
    rawSection === "campaigns" || rawSection === "channels" ? (rawSection as SentinelSection) : "scans";
  const q = get("q").trim().slice(0, MAX_QUERY_LEN);
  const campaignStatus = get("campaign_status").trim().toLowerCase();
  const channelPlatform = get("platform").trim().toLowerCase();
  const channelStatus = get("channel_status").trim().toLowerCase();
  const scanStatus = get("scan_status").trim().toLowerCase();
  const scanPlatform = get("scan_platform").trim().toLowerCase();
  let page = parseInt(get("page") || "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > 1000) page = 1000;
  return { section, q, campaignStatus, channelPlatform, channelStatus, scanStatus, scanPlatform, page, pageSize: PAGE_SIZE };
}

function formatLike(q: string): string {
  return `%${q.replace(/%/g, "\\%").replace(/_/g, "\\_")}%`;
}

/**
 * Read-only Sentinel for Super Admin — no mutations, no provider calls.
 * Uses service_role after requireSuperAdmin, batched org/campaign lookups, no N+1.
 */
export async function getAdminSentinel(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<AdminSentinelResult> {
  await requireSuperAdmin();
  const { section, q, campaignStatus, channelPlatform, channelStatus, scanStatus, scanPlatform, page, pageSize } =
    parseParams(searchParams);
  const admin = createAdminClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  // Overview counts — isolated
  const overview: SentinelOverview = {
    campaigns: { count: null },
    activeCampaigns: { count: null },
    connectedChannels: { count: null },
    totalScans: { count: null },
    successfulScans: { count: null },
    failedScans: { count: null },
  };

  try {
    const { count, error } = await admin.from("sponsor_campaigns").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.campaigns = { count: count ?? 0 };
  } catch {
    overview.campaigns = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("sponsor_campaigns").select("id", { count: "exact", head: true }).eq("status", "active");
    if (error) throw error;
    overview.activeCampaigns = { count: count ?? 0 };
  } catch {
    overview.activeCampaigns = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("connected_channels").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.connectedChannels = { count: count ?? 0 };
  } catch {
    overview.connectedChannels = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("scans").select("id", { count: "exact", head: true });
    if (error) throw error;
    overview.totalScans = { count: count ?? 0 };
  } catch {
    overview.totalScans = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("scans").select("id", { count: "exact", head: true }).eq("status", "success");
    if (error) throw error;
    overview.successfulScans = { count: count ?? 0 };
  } catch {
    overview.successfulScans = { count: null, error: "Unavailable" };
  }
  try {
    const { count, error } = await admin.from("scans").select("id", { count: "exact", head: true }).eq("status", "failed");
    if (error) throw error;
    overview.failedScans = { count: count ?? 0 };
  } catch {
    overview.failedScans = { count: null, error: "Unavailable" };
  }

  // Section data
  let campaigns: AdminCampaignItem[] = [];
  let channels: AdminChannelItem[] = [];
  let scans: AdminScanItem[] = [];
  let total: number | null = null;
  let totalError: string | undefined;
  let hasMore = false;

  // Helper to resolve org ids for q search
  const resolveOrgIds = async (query: string): Promise<string[] | null> => {
    if (!query) return null;
    const like = formatLike(query);
    const { data } = await admin.from("organizations").select("id").or(`name.ilike.${like},slug.ilike.${like}`).limit(200);
    return ((data ?? []) as Array<{ id: string }>).map((o) => o.id);
  };

  if (section === "campaigns") {
    const orgIds = await resolveOrgIds(q);
    if (q && orgIds !== null && orgIds.length === 0) {
      // No org matches, but campaign name might still match — we will check campaign name separately
      // For campaigns, search is name ilike OR org in ids — if orgIds empty, we still search name
      // To handle, we keep orgIds as empty array to indicate no org matches, but we still allow name search
      // For count we need to handle both
    }

    try {
      let countQ = admin.from("sponsor_campaigns").select("id", { count: "exact", head: true }) as unknown as never;
      if (q) {
        const like = formatLike(q);
        if (orgIds && orgIds.length > 0) {
          const inList = `(${orgIds.join(",")})`;
          countQ = (countQ as never as { or: (s: string) => never }).or(`name.ilike.${like},organization_id.in.${inList}`) as never;
        } else {
          countQ = (countQ as never as { ilike: (c: string, v: string) => never }).ilike("name", like) as never;
        }
      }
      if (campaignStatus && ["draft", "active", "completed", "archived"].includes(campaignStatus)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("status", campaignStatus) as never;
      }
      const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
        count: number | null;
        error: unknown;
      };
      if (error) throw error;
      total = count ?? 0;
    } catch {
      totalError = "Unable to load campaigns.";
    }

    try {
      let dataQ = admin
        .from("sponsor_campaigns")
        .select("id, organization_id, name, status, starts_at, ends_at, created_at")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as never;

      if (q) {
        const like = formatLike(q);
        const orgIdsForQ = orgIds;
        if (orgIdsForQ && orgIdsForQ.length > 0) {
          const inList = `(${orgIdsForQ.join(",")})`;
          dataQ = (dataQ as never as { or: (s: string) => never }).or(`name.ilike.${like},organization_id.in.${inList}`) as never;
        } else {
          dataQ = (dataQ as never as { ilike: (c: string, v: string) => never }).ilike("name", like) as never;
        }
      }
      if (campaignStatus && ["draft", "active", "completed", "archived"].includes(campaignStatus)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("status", campaignStatus) as never;
      }

      const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
        data:
          | Array<{
              id: string;
              organization_id: string;
              name: string;
              status: string;
              starts_at: string;
              ends_at: string;
              created_at: string;
            }>
          | null;
        error: unknown;
      };
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length > 0) {
        const orgIdsRows = [...new Set(rows.map((r) => r.organization_id))];
        const { data: orgData } = orgIdsRows.length
          ? await admin.from("organizations").select("id, name, slug").in("id", orgIdsRows)
          : ({ data: [] } as never);
        const orgMap = new Map<string, { name: string; slug: string }>();
        for (const o of ((orgData ?? []) as Array<{ id: string; name: string; slug: string }>)) orgMap.set(o.id, { name: o.name, slug: o.slug });
        campaigns = rows.map((r) => ({
          id: r.id,
          organizationId: r.organization_id,
          organizationName: orgMap.get(r.organization_id)?.name ?? "Unknown",
          organizationSlug: orgMap.get(r.organization_id)?.slug ?? "—",
          name: r.name,
          status: r.status,
          startsAt: r.starts_at,
          endsAt: r.ends_at,
          createdAt: r.created_at,
        }));
      }
    } catch {
      if (campaigns.length === 0 && !totalError) totalError = "Unable to load campaigns.";
    }
    hasMore = total !== null ? from + pageSize < total : campaigns.length === pageSize;
  } else if (section === "channels") {
    const orgIds = await resolveOrgIds(q);

    try {
      let countQ = admin.from("connected_channels").select("id", { count: "exact", head: true }) as unknown as never;
      if (q) {
        const like = formatLike(q);
        if (orgIds && orgIds.length > 0) {
          const inList = `(${orgIds.join(",")})`;
          countQ = (countQ as never as { or: (s: string) => never }).or(`external_handle.ilike.${like},organization_id.in.${inList}`) as never;
        } else {
          countQ = (countQ as never as { ilike: (c: string, v: string) => never }).ilike("external_handle", like) as never;
        }
      }
      if (channelPlatform && ["twitch", "youtube", "kick"].includes(channelPlatform)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("platform", channelPlatform) as never;
      }
      if (channelStatus && ["connected", "disconnected", "expired", "revoked"].includes(channelStatus)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("connection_status", channelStatus) as never;
      }
      const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
        count: number | null;
        error: unknown;
      };
      if (error) throw error;
      total = count ?? 0;
    } catch {
      totalError = "Unable to load channels.";
    }

    try {
      let dataQ = admin
        .from("connected_channels")
        .select("id, organization_id, platform, external_handle, external_channel_id, connection_status, connection_mode, created_at, updated_at")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as never;

      if (q) {
        const like = formatLike(q);
        const orgIdsForQ = orgIds;
        if (orgIdsForQ && orgIdsForQ.length > 0) {
          const inList = `(${orgIdsForQ.join(",")})`;
          dataQ = (dataQ as never as { or: (s: string) => never }).or(`external_handle.ilike.${like},organization_id.in.${inList}`) as never;
        } else {
          dataQ = (dataQ as never as { ilike: (c: string, v: string) => never }).ilike("external_handle", like) as never;
        }
      }
      if (channelPlatform && ["twitch", "youtube", "kick"].includes(channelPlatform)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("platform", channelPlatform) as never;
      }
      if (channelStatus && ["connected", "disconnected", "expired", "revoked"].includes(channelStatus)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("connection_status", channelStatus) as never;
      }

      const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
        data:
          | Array<{
              id: string;
              organization_id: string;
              platform: string;
              external_handle: string;
              external_channel_id: string;
              connection_status: string;
              connection_mode: string;
              created_at: string;
              updated_at: string;
            }>
          | null;
        error: unknown;
      };
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length > 0) {
        const orgIdsRows = [...new Set(rows.map((r) => r.organization_id))];
        const { data: orgData } = orgIdsRows.length
          ? await admin.from("organizations").select("id, name, slug").in("id", orgIdsRows)
          : ({ data: [] } as never);
        const orgMap = new Map<string, { name: string; slug: string }>();
        for (const o of ((orgData ?? []) as Array<{ id: string; name: string; slug: string }>)) orgMap.set(o.id, { name: o.name, slug: o.slug });
        channels = rows.map((r) => ({
          id: r.id,
          organizationId: r.organization_id,
          organizationName: orgMap.get(r.organization_id)?.name ?? "Unknown",
          organizationSlug: orgMap.get(r.organization_id)?.slug ?? "—",
          platform: r.platform,
          externalHandle: r.external_handle,
          externalChannelId: r.external_channel_id,
          connectionStatus: r.connection_status,
          connectionMode: r.connection_mode,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }));
      }
    } catch {
      if (channels.length === 0 && !totalError) totalError = "Unable to load channels.";
    }
    hasMore = total !== null ? from + pageSize < total : channels.length === pageSize;
  } else {
    // scans — default
    // For scan search, q matches campaign name or org
    let campaignIdsForQ: string[] | null = null;
    let orgIdsForScan: string[] | null = null;
    if (q) {
      const like = formatLike(q);
      const [{ data: campData }, { data: orgData }] = await Promise.all([
        admin.from("sponsor_campaigns").select("id").ilike("name", like).limit(100) as unknown as Promise<{ data: Array<{ id: string }> | null }>,
        admin.from("organizations").select("id").or(`name.ilike.${like},slug.ilike.${like}`).limit(200) as unknown as Promise<{ data: Array<{ id: string }> | null }>,
      ]);
      campaignIdsForQ = ((campData ?? []) as Array<{ id: string }>).map((c) => c.id);
      orgIdsForScan = ((orgData ?? []) as Array<{ id: string }>).map((o) => o.id);
      // If both empty, we will return 0 quickly
      if (campaignIdsForQ.length === 0 && (orgIdsForScan?.length ?? 0) === 0) {
        total = 0;
        scans = [];
        hasMore = false;
        return {
          overview,
          section,
          query: q,
          campaignStatus,
          channelPlatform,
          channelStatus,
          scanStatus,
          scanPlatform,
          page,
          pageSize,
          total,
          totalError,
          hasMore,
          campaigns,
          channels,
          scans,
          platforms: ["twitch", "youtube", "kick"],
        };
      }
    }

    try {
      let countQ = admin.from("scans").select("id", { count: "exact", head: true }) as unknown as never;
      if (q && (campaignIdsForQ !== null || orgIdsForScan !== null)) {
        const parts: string[] = [];
        if (campaignIdsForQ && campaignIdsForQ.length > 0) parts.push(`campaign_id.in.(${campaignIdsForQ.join(",")})`);
        if (orgIdsForScan && orgIdsForScan.length > 0) parts.push(`organization_id.in.(${orgIdsForScan.join(",")})`);
        if (parts.length > 0) countQ = (countQ as never as { or: (s: string) => never }).or(parts.join(",")) as never;
      }
      if (scanStatus && ["pending", "running", "success", "failed", "partial"].includes(scanStatus)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("status", scanStatus) as never;
      }
      if (scanPlatform && ["twitch", "youtube", "kick"].includes(scanPlatform)) {
        countQ = (countQ as never as { eq: (c: string, v: string) => never }).eq("platform", scanPlatform) as never;
      }
      const { count, error } = (await (countQ as unknown as Promise<{ count: number | null; error: unknown }>)) as {
        count: number | null;
        error: unknown;
      };
      if (error) throw error;
      total = count ?? 0;
    } catch {
      totalError = "Unable to load scans.";
    }

    try {
      let dataQ = admin
        .from("scans")
        .select("id, organization_id, campaign_id, platform, status, started_at, completed_at, scanner_version, error_code, error_message, created_at")
        .order("created_at", { ascending: false })
        .range(from, to) as unknown as never;

      if (q && (campaignIdsForQ !== null || orgIdsForScan !== null)) {
        const parts: string[] = [];
        if (campaignIdsForQ && campaignIdsForQ.length > 0) parts.push(`campaign_id.in.(${campaignIdsForQ.join(",")})`);
        if (orgIdsForScan && orgIdsForScan.length > 0) parts.push(`organization_id.in.(${orgIdsForScan.join(",")})`);
        if (parts.length > 0) dataQ = (dataQ as never as { or: (s: string) => never }).or(parts.join(",")) as never;
      }
      if (scanStatus && ["pending", "running", "success", "failed", "partial"].includes(scanStatus)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("status", scanStatus) as never;
      }
      if (scanPlatform && ["twitch", "youtube", "kick"].includes(scanPlatform)) {
        dataQ = (dataQ as never as { eq: (c: string, v: string) => never }).eq("platform", scanPlatform) as never;
      }

      const { data, error } = (await (dataQ as unknown as Promise<{ data: unknown[] | null; error: unknown }>)) as {
        data:
          | Array<{
              id: string;
              organization_id: string;
              campaign_id: string;
              platform: string;
              status: string;
              started_at: string | null;
              completed_at: string | null;
              scanner_version: string;
              error_code: string | null;
              error_message: string | null;
              created_at: string;
            }>
          | null;
        error: unknown;
      };
      if (error) throw error;
      const rows = data ?? [];
      if (rows.length > 0) {
        const orgIdsRows = [...new Set(rows.map((r) => r.organization_id))];
        const campIds = [...new Set(rows.map((r) => r.campaign_id))];
        const [{ data: orgData }, { data: campData }] = await Promise.all([
          orgIdsRows.length ? admin.from("organizations").select("id, name, slug").in("id", orgIdsRows) : Promise.resolve({ data: [] } as never),
          campIds.length ? admin.from("sponsor_campaigns").select("id, name").in("id", campIds) : Promise.resolve({ data: [] } as never),
        ]);
        const orgMap = new Map<string, { name: string; slug: string }>();
        for (const o of ((orgData ?? []) as Array<{ id: string; name: string; slug: string }>)) orgMap.set(o.id, { name: o.name, slug: o.slug });
        const campMap = new Map<string, string>();
        for (const c of ((campData ?? []) as Array<{ id: string; name: string }>)) campMap.set(c.id, c.name);

        scans = rows.map((r) => ({
          id: r.id,
          organizationId: r.organization_id,
          organizationName: orgMap.get(r.organization_id)?.name ?? "Unknown",
          organizationSlug: orgMap.get(r.organization_id)?.slug ?? "—",
          campaignId: r.campaign_id,
          campaignName: campMap.get(r.campaign_id) ?? null,
          platform: r.platform,
          status: r.status,
          startedAt: r.started_at,
          completedAt: r.completed_at,
          errorCode: r.error_code,
          errorMessage: r.error_message ? r.error_message.slice(0, 200) : null,
          scannerVersion: r.scanner_version,
          createdAt: r.created_at,
        }));
      }
    } catch {
      if (scans.length === 0 && !totalError) totalError = "Unable to load scans.";
    }
    hasMore = total !== null ? from + pageSize < total : scans.length === pageSize;
  }

  return {
    overview,
    section,
    query: q,
    campaignStatus,
    channelPlatform,
    channelStatus,
    scanStatus,
    scanPlatform,
    page,
    pageSize,
    total,
    totalError,
    hasMore,
    campaigns,
    channels,
    scans,
    platforms: ["twitch", "youtube", "kick"],
  };
}
