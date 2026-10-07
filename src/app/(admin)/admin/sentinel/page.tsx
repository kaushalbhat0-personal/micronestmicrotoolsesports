import Link from "next/link";
import type { Route } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminSentinel } from "@/server/admin/sentinel";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Trophy, Tv, History, CheckCircle, AlertTriangle, Clock, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function AdminSentinelPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const data = await getAdminSentinel(params);

  const section = data.section;
  const buildSectionHref = (s: string) => {
    const p = new URLSearchParams();
    p.set("section", s);
    const qs = p.toString();
    return `/admin/sentinel?${qs}` as Route;
  };

  const buildPageHref = (page: number) => {
    const p = new URLSearchParams();
    p.set("section", section);
    if (data.query) p.set("q", data.query);
    if (section === "campaigns" && data.campaignStatus) p.set("campaign_status", data.campaignStatus);
    if (section === "channels") {
      if (data.channelPlatform) p.set("platform", data.channelPlatform);
      if (data.channelStatus) p.set("channel_status", data.channelStatus);
    }
    if (section === "scans") {
      if (data.scanStatus) p.set("scan_status", data.scanStatus);
      if (data.scanPlatform) p.set("scan_platform", data.scanPlatform);
    }
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/admin/sentinel?${qs}` as Route;
  };

  const totalPages = data.total !== null ? Math.max(1, Math.ceil(data.total / data.pageSize)) : null;
  const showPagination = data.total !== null ? data.total > data.pageSize : data.hasMore || data.page > 1;
  const hasError = !!data.totalError && (section === "campaigns" ? data.campaigns.length === 0 : section === "channels" ? data.channels.length === 0 : data.scans.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Sentinel</h1>
        <p className="mt-1 text-sm text-muted-foreground">Read-only visibility into campaigns, channels, scans, and retention.</p>
      </div>

      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Campaigns</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.campaigns.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.campaigns.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.campaigns.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Active Campaigns</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.activeCampaigns.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.activeCampaigns.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.activeCampaigns.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Connected Channels</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.connectedChannels.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.connectedChannels.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.connectedChannels.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Total Scans</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.totalScans.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.totalScans.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.totalScans.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Successful Scans</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.successfulScans.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.successfulScans.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.successfulScans.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Failed Scans</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.failedScans.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.failedScans.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.failedScans.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Retention + Provider health */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" aria-hidden /> Retention
            </CardTitle>
            <CardDescription>90d scans/evidence/evaluations, 30d webhooks — cron daily 04:00 UTC. State is not persisted beyond deletions.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Retention state is not persisted — retention is implemented solely through cron code (`/api/cron/sentinel-retention`) with no persisted operational state. Last run and deleted count are not stored.
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden /> Provider Health
            </CardTitle>
            <CardDescription>Twitch/YouTube/Kick adapters — health derived from stored channel/scans, no live external calls.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Provider health is not persisted — channel `connection_status` and recent scan `error_code` are the authoritative signals. This page does not call external providers to avoid budget consumption.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Sentinel sections">
        {(["scans", "campaigns", "channels"] as const).map((s) => {
          const active = section === s;
          return (
            <Link
              key={s}
              href={buildSectionHref(s) as never}
              role="tab"
              aria-selected={active}
              aria-current={active ? "page" : undefined}
              className={`inline-flex min-h-[44px] items-center rounded-full border px-4 text-sm font-medium capitalize focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-primary text-primary-foreground border-transparent" : "bg-card border-border hover:bg-muted"}`}
            >
              {s}
            </Link>
          );
        })}
      </div>

      {/* Filters — per section */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid gap-3 sm:grid-cols-4" role="search" aria-label="Sentinel filters">
            <input type="hidden" name="section" value={section} />
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="q" className="text-xs font-medium">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="q"
                  name="q"
                  defaultValue={data.query}
                  placeholder={section === "campaigns" ? "Campaign or organization" : section === "channels" ? "Handle or organization" : "Campaign or organization"}
                  maxLength={100}
                  className="pl-9"
                  aria-label="Search sentinel records"
                />
              </div>
            </div>

            {section === "campaigns" && (
              <div className="space-y-1.5">
                <Label htmlFor="campaign_status" className="text-xs font-medium">
                  Status
                </Label>
                <select
                  id="campaign_status"
                  name="campaign_status"
                  defaultValue={data.campaignStatus}
                  className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            )}
            {section === "channels" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="platform" className="text-xs font-medium">
                    Platform
                  </Label>
                  <select
                    id="platform"
                    name="platform"
                    defaultValue={data.channelPlatform}
                    className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">All</option>
                    <option value="twitch">Twitch</option>
                    <option value="youtube">YouTube</option>
                    <option value="kick">Kick</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="channel_status" className="text-xs font-medium">
                    Status
                  </Label>
                  <select
                    id="channel_status"
                    name="channel_status"
                    defaultValue={data.channelStatus}
                    className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">All</option>
                    <option value="connected">Connected</option>
                    <option value="disconnected">Disconnected</option>
                    <option value="expired">Expired</option>
                    <option value="revoked">Revoked</option>
                  </select>
                </div>
              </>
            )}
            {section === "scans" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="scan_status" className="text-xs font-medium">
                    Status
                  </Label>
                  <select
                    id="scan_status"
                    name="scan_status"
                    defaultValue={data.scanStatus}
                    className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">All</option>
                    <option value="pending">Pending</option>
                    <option value="running">Running</option>
                    <option value="success">Success</option>
                    <option value="partial">Partial</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="scan_platform" className="text-xs font-medium">
                    Platform
                  </Label>
                  <select
                    id="scan_platform"
                    name="scan_platform"
                    defaultValue={data.scanPlatform}
                    className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">All</option>
                    <option value="twitch">Twitch</option>
                    <option value="youtube">YouTube</option>
                    <option value="kick">Kick</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex items-end gap-2">
              <Button type="submit" className="min-h-[44px] flex-1">
                Apply
              </Button>
              {(data.query || data.campaignStatus || data.channelPlatform || data.channelStatus || data.scanStatus || data.scanPlatform) && (
                <Link
                  href={buildSectionHref(section) as never}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Count */}
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          {hasError ? (
            "Unable to load sentinel data right now."
          ) : data.query || data.campaignStatus || data.channelPlatform || data.channelStatus || data.scanStatus || data.scanPlatform ? (
            <>
              {data.total !== null ? `${new Intl.NumberFormat("en-IN").format(data.total)} result${data.total === 1 ? "" : "s"}` : `${section === "campaigns" ? data.campaigns.length : section === "channels" ? data.channels.length : data.scans.length} results`}
              {data.query ? ` for “${data.query}”` : ""}
            </>
          ) : data.total !== null ? (
            <>{new Intl.NumberFormat("en-IN").format(data.total)} {section} total</>
          ) : (
            `${section === "campaigns" ? data.campaigns.length : section === "channels" ? data.channels.length : data.scans.length} ${section}`
          )}
        </p>
        {totalPages && <span className="hidden sm:inline">Page {data.page} of {totalPages}</span>}
      </div>

      {/* Tables */}
      {hasError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-destructive">Unable to load sentinel data</p>
            <p className="mt-1 text-xs text-muted-foreground">Please try again.</p>
          </CardContent>
        </Card>
      ) : section === "campaigns" ? (
        data.campaigns.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Trophy className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">{data.query || data.campaignStatus ? "No campaigns match the selected filters." : "No campaigns found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Campaigns</CardTitle>
              <CardDescription>Status is authoritative — draft, active, completed, archived.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Campaigns</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Organization
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Campaign
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Status
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                        Start
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                        End
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.campaigns.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium">{c.organizationName}</p>
                          <p className="text-xs text-muted-foreground">{c.organizationSlug}</p>
                        </td>
                        <td className="px-4 py-3 font-medium">{c.name}</td>
                        <td className="px-4 py-3">
                          <Badge variant={c.status === "active" ? "success" : c.status === "failed" ? "destructive" : "secondary"}>{c.status}</Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(c.startsAt)}</td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(c.endsAt)}</td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{formatDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : section === "channels" ? (
        data.channels.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Tv className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">{data.query || data.channelPlatform || data.channelStatus ? "No channels match the selected filters." : "No channels found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Connected Channels</CardTitle>
              <CardDescription>Handle and status — tokens not selected, never exposed.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Connected channels</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Organization
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Platform
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Handle
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Status
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                        Connected
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.channels.map((ch) => (
                      <tr key={ch.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium">{ch.organizationName}</p>
                          <p className="text-xs text-muted-foreground">{ch.organizationSlug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="capitalize">
                            {ch.platform}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{ch.externalHandle}</td>
                        <td className="px-4 py-3">
                          <Badge variant={ch.connectionStatus === "connected" ? "success" : ch.connectionStatus === "revoked" ? "destructive" : "secondary"}>{ch.connectionStatus}</Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(ch.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : data.scans.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <History className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">{data.query || data.scanStatus || data.scanPlatform ? "No scans match the selected filters." : "No scans found."}</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Scan History</CardTitle>
            <CardDescription>Status success, partial, failed — cronRunId not persisted, omitted.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Scans</caption>
                <thead>
                  <tr className="border-y border-border bg-surface-muted/40 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Campaign
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Organization
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Platform
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Status
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                      Started
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                      Error
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.scans.map((s) => (
                    <tr key={s.id} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3 font-medium">{s.campaignName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <p className="font-medium">{s.organizationName}</p>
                        <p className="text-xs text-muted-foreground">{s.organizationSlug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="capitalize">
                          {s.platform}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {s.status === "success" ? (
                          <Badge variant="success">success</Badge>
                        ) : s.status === "failed" ? (
                          <Badge variant="destructive">failed</Badge>
                        ) : s.status === "partial" ? (
                          <Badge variant="secondary">partial</Badge>
                        ) : (
                          <Badge variant="secondary">{s.status}</Badge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(s.startedAt)}</td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell max-w-[200px] truncate" title={s.errorMessage ?? ""}>
                        {s.errorCode ? `${s.errorCode}` : ""}
                        {s.errorMessage ? ` ${s.errorMessage.slice(0, 80)}` : s.errorCode ? "" : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {showPagination && !hasError && (section === "campaigns" ? data.campaigns.length > 0 : section === "channels" ? data.channels.length > 0 : data.scans.length > 0) && (
        <div className="flex items-center justify-between gap-2">
          {data.page > 1 ? (
            <Link href={buildPageHref(data.page - 1) as never} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Previous
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Previous</span>
          )}
          <span className="text-sm text-muted-foreground">
            Page {data.page}
            {totalPages ? ` of ${totalPages}` : ""}
          </span>
          {data.hasMore || (totalPages !== null && data.page < totalPages) ? (
            <Link href={buildPageHref(data.page + 1) as never} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Next
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Next</span>
          )}
        </div>
      )}
    </div>
  );
}
