import Link from "next/link";
import type { Route } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminSystem } from "@/server/admin/system";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Search,
  Clock,
  Webhook,
  Settings2,
  HeartPulse,
  Wrench,
  Package,
  ScrollText,
  AlertTriangle,
  CalendarClock,
  ShieldCheck,
  Database,
} from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatCount(v: number | null, err?: string): string {
  if (err) return "Unavailable";
  if (v === null) return "—";
  return new Intl.NumberFormat("en-IN").format(v);
}

export default async function AdminSystemPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const data = await getAdminSystem(params);

  const buildWebhookHref = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const status = overrides.status !== undefined ? String(overrides.status) : data.webhookStatus;
    const provider = overrides.provider !== undefined ? String(overrides.provider) : data.webhookProvider;
    const q = overrides.webhook_q !== undefined ? String(overrides.webhook_q) : data.webhookQuery;
    const providerQ = data.providerQuery;
    const providerFilter = data.providerFilter;
    const providerPage = data.providerConfigPage;
    if (q) p.set("webhook_q", q);
    if (status) p.set("status", status);
    if (provider) p.set("provider", provider);
    if (providerFilter) p.set("provider_filter", providerFilter);
    if (providerQ) p.set("provider_q", providerQ);
    const page = overrides.page !== undefined ? Number(overrides.page) : data.webhookPage;
    if (page > 1) p.set("page", String(page));
    if (providerPage > 1) p.set("provider_page", String(providerPage));
    const qs = p.toString();
    return `/admin/system${qs ? `?${qs}` : ""}` as Route;
  };

  const buildProviderHref = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    if (data.webhookQuery) p.set("webhook_q", data.webhookQuery);
    if (data.webhookStatus) p.set("status", data.webhookStatus);
    if (data.webhookProvider) p.set("provider", data.webhookProvider);
    const providerFilter = overrides.provider_filter !== undefined ? String(overrides.provider_filter) : data.providerFilter;
    const providerQ = overrides.provider_q !== undefined ? String(overrides.provider_q) : data.providerQuery;
    if (providerFilter) p.set("provider_filter", providerFilter);
    if (providerQ) p.set("provider_q", providerQ);
    if (data.webhookPage > 1) p.set("page", String(data.webhookPage));
    const pp = overrides.provider_page !== undefined ? Number(overrides.provider_page) : data.providerConfigPage;
    if (pp > 1) p.set("provider_page", String(pp));
    const qs = p.toString();
    return `/admin/system${qs ? `?${qs}` : ""}` as Route;
  };

  const webhookTotalPages = data.webhookTotal !== null ? Math.max(1, Math.ceil(data.webhookTotal / data.webhookPageSize)) : null;
  const providerTotalPages = data.providerConfigTotal !== null ? Math.max(1, Math.ceil(data.providerConfigTotal / data.providerConfigPageSize)) : null;

  const hasWebhookError = !!data.webhookTotalError && data.webhookEvents.length === 0;
  const hasProviderError = !!data.providerConfigTotalError && data.providerConfigs.length === 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">System</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only platform observability — scheduled jobs, webhooks, integrations, health, tools, and operational activity.
        </p>
      </div>

      {/* 1. System Overview */}
      <section aria-labelledby="system-overview-heading">
        <h2 id="system-overview-heading" className="sr-only">
          System overview
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Scheduled Jobs</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{data.overview.scheduledJobs}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Configured in vercel.json — not a success signal.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Webhook Events</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCount(data.overview.webhookEvents.count, data.overview.webhookEvents.error)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Total persisted webhook events.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Failed Webhooks</CardDescription>
              <CardTitle className={`text-2xl tabular-nums ${data.overview.failedWebhooks.count !== null && data.overview.failedWebhooks.count > 0 ? "text-destructive" : ""}`}>
                {formatCount(data.overview.failedWebhooks.count, data.overview.failedWebhooks.error)}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Status = failed.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Provider Configurations</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCount(data.overview.providerConfigs.count, data.overview.providerConfigs.error)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">Organization-level Twitch/YouTube/Kick credentials.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Active Tools</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCount(data.overview.activeTools.count, data.overview.activeTools.error)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">tools.is_active = true.</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Active Plans</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCount(data.overview.activePlans.count, data.overview.activePlans.error)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">plans.is_active = true.</p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 2. Scheduled Jobs */}
      <section aria-labelledby="jobs-heading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CalendarClock className="h-4 w-4 text-muted-foreground" aria-hidden /> Scheduled Jobs
            </CardTitle>
            <CardDescription>Configured schedules vs observed execution. No run-history table exists — observed activity is derived from scans.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Scheduled jobs</caption>
                <thead>
                  <tr className="border-y border-border bg-surface-muted/40 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Job
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Schedule
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Purpose
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Observed Activity
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.cronJobs.map((job) => (
                    <tr key={job.path} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3 font-mono text-xs">{job.path}</td>
                      <td className="px-4 py-3 text-xs">{job.schedule} UTC</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[280px]">{job.purpose}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {job.observedActivityError ? (
                          "Unavailable"
                        ) : job.observedActivity ? (
                          <span title={job.observedActivity}>{formatDate(job.observedActivity)}</span>
                        ) : job.path === "/api/cron/sentinel-scan" ? (
                          "No scans observed"
                        ) : (
                          <span>Not persisted — see retention policy</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary">{job.status}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-border bg-surface-muted/20 px-4 py-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <strong>Configured ≠ Executed ≠ Healthy.</strong> Vercel cron defines the schedule; execution success is not stored. Sentinel scan
                activity is observed from the latest `scans.started_at`. Retention has no persisted run history — policy is 90d scans/evidence/evaluations,
                30d webhooks.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 3. Webhook Processing */}
      <section aria-labelledby="webhook-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h2 id="webhook-heading" className="text-sm font-semibold tracking-tight">
            Webhook Processing
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Total</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCount(data.webhookSummary.total.count, data.webhookSummary.total.error)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Pending</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCount(data.webhookSummary.pending.count, data.webhookSummary.pending.error)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Processing</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCount(data.webhookSummary.processing.count, data.webhookSummary.processing.error)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Succeeded</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{formatCount(data.webhookSummary.succeeded.count, data.webhookSummary.succeeded.error)}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Failed</CardDescription>
              <CardTitle className={`text-2xl tabular-nums ${data.webhookSummary.failed.count !== null && data.webhookSummary.failed.count > 0 ? "text-destructive" : ""}`}>
                {formatCount(data.webhookSummary.failed.count, data.webhookSummary.failed.error)}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Card>
          <CardContent className="p-4">
            <form method="GET" className="grid gap-3 sm:grid-cols-4" role="search" aria-label="Webhook filters">
              {data.providerFilter && <input type="hidden" name="provider_filter" value={data.providerFilter} />}
              {data.providerQuery && <input type="hidden" name="provider_q" value={data.providerQuery} />}
              {data.providerConfigPage > 1 && <input type="hidden" name="provider_page" value={String(data.providerConfigPage)} />}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="webhook_q" className="text-xs font-medium">
                  Search
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="webhook_q"
                    name="webhook_q"
                    defaultValue={data.webhookQuery}
                    placeholder="Event ID or type"
                    maxLength={100}
                    className="pl-9"
                    aria-label="Search webhook events"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-medium">
                  Status
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={data.webhookStatus}
                  className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provider" className="text-xs font-medium">
                  Provider
                </Label>
                <select
                  id="provider"
                  name="provider"
                  defaultValue={data.webhookProvider}
                  className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="stripe">Stripe</option>
                  <option value="razorpay">Razorpay</option>
                  <option value="twitch">Twitch</option>
                  <option value="youtube">YouTube</option>
                  <option value="kick">Kick</option>
                  <option value="discord">Discord</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="min-h-[44px] flex-1">
                  Apply
                </Button>
                {(data.webhookQuery || data.webhookStatus || data.webhookProvider) && (
                  <Link
                    href={buildWebhookHref({ status: "", provider: "", webhook_q: "", page: 1 }) as never}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Clear
                  </Link>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <p aria-live="polite">
            {hasWebhookError ? (
              "Unable to load webhook events right now."
            ) : data.webhookQuery || data.webhookStatus || data.webhookProvider ? (
              <>
                {data.webhookTotal !== null ? `${new Intl.NumberFormat("en-IN").format(data.webhookTotal)} result${data.webhookTotal === 1 ? "" : "s"}` : `${data.webhookEvents.length} results`}
                {data.webhookQuery ? ` for “${data.webhookQuery}”` : ""}
              </>
            ) : data.webhookTotal !== null ? (
              <>{new Intl.NumberFormat("en-IN").format(data.webhookTotal)} webhook events total</>
            ) : (
              `${data.webhookEvents.length} webhook events`
            )}
          </p>
          {webhookTotalPages && <span className="hidden sm:inline">Page {data.webhookPage} of {webhookTotalPages}</span>}
        </div>

        {hasWebhookError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm font-medium text-destructive">Unable to load webhook events</p>
              <p className="mt-1 text-xs text-muted-foreground">Please try again.</p>
            </CardContent>
          </Card>
        ) : data.webhookEvents.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Webhook className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">{data.webhookQuery || data.webhookStatus || data.webhookProvider ? "No webhook events match the selected filters." : "No webhook events found."}</p>
              <p className="mt-1 text-xs text-muted-foreground">Payload and signatures are never displayed.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Recent Webhook Events</CardTitle>
              <CardDescription>Provider, event type, status, timestamps — payload not exposed.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Webhook events</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Provider
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Event Type
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Status
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                        Received
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                        Processed
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.webhookEvents.map((w) => (
                      <tr key={w.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3">
                          <span className="font-medium capitalize">{w.provider}</span>
                          <span className="ml-2 font-mono text-xs text-muted-foreground truncate max-w-[120px] inline-block align-middle" title={w.providerEventId}>
                            {w.providerEventId.slice(0, 12)}…
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs">{w.eventType ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={w.status === "succeeded" ? "success" : w.status === "failed" ? "destructive" : "secondary"}>{w.status ?? (w.processed ? "processed" : "pending")}</Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(w.receivedAt ?? w.createdAt)}</td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{formatDate(w.processedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {(data.webhookTotal !== null ? data.webhookTotal > data.webhookPageSize : data.webhookHasMore || data.webhookPage > 1) && !hasWebhookError && data.webhookEvents.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            {data.webhookPage > 1 ? (
              <Link href={buildWebhookHref({ page: data.webhookPage - 1 }) as never} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Previous
              </Link>
            ) : (
              <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Previous</span>
            )}
            <span className="text-sm text-muted-foreground">
              Page {data.webhookPage}
              {webhookTotalPages ? ` of ${webhookTotalPages}` : ""}
            </span>
            {data.webhookHasMore || (webhookTotalPages !== null && data.webhookPage < webhookTotalPages) ? (
              <Link href={buildWebhookHref({ page: data.webhookPage + 1 }) as never} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Next
              </Link>
            ) : (
              <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Next</span>
            )}
          </div>
        )}
      </section>

      {/* 4. Integration Configuration */}
      <section aria-labelledby="integration-heading" className="space-y-4">
        <div className="flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-muted-foreground" aria-hidden />
          <h2 id="integration-heading" className="text-sm font-semibold tracking-tight">
            Integration Configuration
          </h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs uppercase tracking-widest">Total Configs</CardDescription>
              <CardTitle className="text-2xl tabular-nums">{data.providerConfigSummary.total !== null ? new Intl.NumberFormat("en-IN").format(data.providerConfigSummary.total) : data.providerConfigSummary.error ?? "—"}</CardTitle>
            </CardHeader>
          </Card>
          {data.providerConfigSummary.byProvider.map((p) => (
            <Card key={p.provider}>
              <CardHeader className="pb-2">
                <CardDescription className="text-xs uppercase tracking-widest">{p.provider}</CardDescription>
                <CardTitle className="text-2xl tabular-nums">{new Intl.NumberFormat("en-IN").format(p.count)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Organizations configured.</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-4">
            <form method="GET" className="grid gap-3 sm:grid-cols-4" role="search" aria-label="Integration filters">
              {data.webhookQuery && <input type="hidden" name="webhook_q" value={data.webhookQuery} />}
              {data.webhookStatus && <input type="hidden" name="status" value={data.webhookStatus} />}
              {data.webhookProvider && <input type="hidden" name="provider" value={data.webhookProvider} />}
              {data.webhookPage > 1 && <input type="hidden" name="page" value={String(data.webhookPage)} />}
              <div className="space-y-1.5 sm:col-span-1">
                <Label htmlFor="provider_q" className="text-xs font-medium">
                  Search
                </Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input
                    id="provider_q"
                    name="provider_q"
                    defaultValue={data.providerQuery}
                    placeholder="Organization"
                    maxLength={100}
                    className="pl-9"
                    aria-label="Search provider configurations"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provider_filter" className="text-xs font-medium">
                  Provider
                </Label>
                <select
                  id="provider_filter"
                  name="provider_filter"
                  defaultValue={data.providerFilter}
                  className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="twitch">Twitch</option>
                  <option value="youtube">YouTube</option>
                  <option value="kick">Kick</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <Button type="submit" className="min-h-[44px] flex-1">
                  Apply
                </Button>
                {(data.providerQuery || data.providerFilter) && (
                  <Link
                    href={buildProviderHref({ provider_q: "", provider_filter: "", provider_page: 1 }) as never}
                    className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    Clear
                  </Link>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <p aria-live="polite">
            {hasProviderError ? (
              "Unable to load provider configurations right now."
            ) : data.providerQuery || data.providerFilter ? (
              <>
                {data.providerConfigTotal !== null ? `${new Intl.NumberFormat("en-IN").format(data.providerConfigTotal)} result${data.providerConfigTotal === 1 ? "" : "s"}` : `${data.providerConfigs.length} results`}
                {data.providerQuery ? ` for “${data.providerQuery}”` : ""}
              </>
            ) : data.providerConfigTotal !== null ? (
              <>{new Intl.NumberFormat("en-IN").format(data.providerConfigTotal)} provider configurations total</>
            ) : (
              `${data.providerConfigs.length} provider configurations`
            )}
          </p>
          {providerTotalPages && <span className="hidden sm:inline">Page {data.providerConfigPage} of {providerTotalPages}</span>}
        </div>

        {hasProviderError ? (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-sm font-medium text-destructive">Unable to load provider configurations</p>
              <p className="mt-1 text-xs text-muted-foreground">Please try again.</p>
            </CardContent>
          </Card>
        ) : data.providerConfigs.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">{data.providerQuery || data.providerFilter ? "No configurations match the selected filters." : "No provider configurations found."}</p>
              <p className="mt-1 text-xs text-muted-foreground">Secrets are never selected or displayed.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Provider Configurations</CardTitle>
              <CardDescription>Safe metadata only — organization, provider, last tested, timestamps. Encrypted fields never selected.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Provider configurations</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Organization
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Provider
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Last Tested
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Status
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.providerConfigs.map((c) => (
                      <tr key={c.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium">{c.organizationName}</p>
                          <p className="text-xs text-muted-foreground">{c.organizationSlug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="capitalize">
                            {c.provider}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{c.lastTestedAt ? formatDate(c.lastTestedAt) : "Not persisted"}</td>
                        <td className="px-4 py-3">
                          {c.lastTestStatus ? (
                            <Badge variant={c.lastTestStatus === "success" ? "success" : "destructive"}>{c.lastTestStatus}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(c.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {(data.providerConfigTotal !== null ? data.providerConfigTotal > data.providerConfigPageSize : data.providerConfigHasMore || data.providerConfigPage > 1) && !hasProviderError && data.providerConfigs.length > 0 && (
          <div className="flex items-center justify-between gap-2">
            {data.providerConfigPage > 1 ? (
              <Link href={buildProviderHref({ provider_page: data.providerConfigPage - 1 }) as never} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Previous
              </Link>
            ) : (
              <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Previous</span>
            )}
            <span className="text-sm text-muted-foreground">
              Page {data.providerConfigPage}
              {providerTotalPages ? ` of ${providerTotalPages}` : ""}
            </span>
            {data.providerConfigHasMore || (providerTotalPages !== null && data.providerConfigPage < providerTotalPages) ? (
              <Link href={buildProviderHref({ provider_page: data.providerConfigPage + 1 }) as never} className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                Next
              </Link>
            ) : (
              <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Next</span>
            )}
          </div>
        )}
      </section>

      {/* 5. Application Health */}
      <section aria-labelledby="health-heading">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <HeartPulse className="h-4 w-4 text-muted-foreground" aria-hidden /> Application Health
            </CardTitle>
            <CardDescription>Safe projection from /api/health — no secrets, no env enumeration.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Service</p>
                <p className="mt-2 text-sm font-medium">micronest</p>
                <p className="mt-1 text-xs text-muted-foreground">Status: {data.health.status === "ok" ? "ok" : "Unavailable"}</p>
              </div>
              <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Endpoint</p>
                <p className="mt-2 font-mono text-xs">/api/health</p>
                <p className="mt-1 text-xs text-muted-foreground">Exists — returns &#123; status, timestamp, service &#125;.</p>
              </div>
              <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Health</p>
                <p className="mt-2 text-sm font-medium">{data.health.status === "ok" ? "Healthy" : "Unavailable"}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {data.health.status === "ok" ? "Application responded." : "Health probe not executed from server — no external fetch."}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Runtime metadata (version, deployment) is not persisted separately — no environment variables are enumerated or displayed.
            </p>
          </CardContent>
        </Card>
      </section>

      {/* 6. Tools & Plans */}
      <section aria-labelledby="tools-plans-heading" className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Wrench className="h-4 w-4 text-muted-foreground" aria-hidden /> Tools
            </CardTitle>
            <CardDescription>Platform tool catalog — read-only.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium tabular-nums">{formatCount(data.tools.total.count, data.tools.total.error)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Active</dt>
                <dd className="font-medium tabular-nums">{formatCount(data.tools.active.count, data.tools.active.error)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Inactive</dt>
                <dd className="font-medium tabular-nums">{formatCount(data.tools.inactive.count, data.tools.inactive.error)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Package className="h-4 w-4 text-muted-foreground" aria-hidden /> Plans
            </CardTitle>
            <CardDescription>Billing plans — read-only, no pricing controls here.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Total</dt>
                <dd className="font-medium tabular-nums">{formatCount(data.plans.total.count, data.plans.total.error)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Active</dt>
                <dd className="font-medium tabular-nums">{formatCount(data.plans.active.count, data.plans.active.error)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Monthly</dt>
                <dd className="font-medium tabular-nums">{formatCount(data.plans.monthly.count, data.plans.monthly.error)}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Yearly</dt>
                <dd className="font-medium tabular-nums">{formatCount(data.plans.yearly.count, data.plans.yearly.error)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </section>

      {/* 7. Recent Admin Activity + 8. Recent Failures */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScrollText className="h-4 w-4 text-muted-foreground" aria-hidden /> Recent Admin Activity
            </CardTitle>
            <CardDescription>Latest 10 audit entries — actor, action, target, timestamp.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.recentActivityError ? (
              <p className="text-sm text-destructive">{data.recentActivityError}</p>
            ) : !data.recentActivity || data.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No admin activity yet.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.recentActivity.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-sm">
                        <Badge variant="secondary" className="font-mono text-xs">
                          {entry.action}
                        </Badge>
                        <span className="text-muted-foreground">{entry.target_type}</span>
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" aria-hidden /> {formatDate(entry.created_at)}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground" aria-label="actor">
                      {entry.actor_user_id.slice(0, 8)}…
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" aria-hidden /> Recent Failures
            </CardTitle>
            <CardDescription>Failed webhooks and failed Sentinel scans — most recent 10.</CardDescription>
          </CardHeader>
          <CardContent>
            {data.failuresError ? (
              <p className="text-sm text-destructive">{data.failuresError}</p>
            ) : data.failures.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent failures — or not persisted.</p>
            ) : (
              <ul className="divide-y divide-border">
                {data.failures.map((f) => (
                  <li key={`${f.kind}-${f.id}`} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm">
                        {f.kind === "webhook" ? <Webhook className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> : <Database className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                        <span className="font-medium capitalize">{f.kind}</span>
                        <Badge variant={f.status === "failed" ? "destructive" : "secondary"}>{f.status}</Badge>
                        <span className="text-xs text-muted-foreground">{f.providerOrPlatform}</span>
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {f.errorCode ? `Error: ${f.errorCode}` : "No error code"}
                        <span className="ml-2">{formatDate(f.createdAt)}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 font-mono text-xs">
                      {f.id.slice(0, 8)}…
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">Only persisted failures are shown — no synthetic health inference.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
