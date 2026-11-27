import Link from "next/link";
import type { Route } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminAuditLog } from "@/server/admin/audit-log";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, ScrollText, Clock, Building2, Shield, Filter } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatIp(ip: string | null): string {
  if (!ip) return "—";
  return ip;
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const data = await getAdminAuditLog(params);

  const buildHref = (overrides: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    const q = overrides.q !== undefined ? String(overrides.q) : data.query;
    const action = overrides.action !== undefined ? String(overrides.action) : data.action;
    const targetType = overrides.target_type !== undefined ? String(overrides.target_type) : data.targetType;
    const orgQ = overrides.org_q !== undefined ? String(overrides.org_q) : data.organizationQuery;
    const date = overrides.date !== undefined ? String(overrides.date) : data.dateFilter;
    const page = overrides.page !== undefined ? Number(overrides.page) : data.page;
    if (q) p.set("q", q);
    if (action) p.set("action", action);
    if (targetType) p.set("target_type", targetType);
    if (orgQ) p.set("org_q", orgQ);
    if (date && date !== "all") p.set("date", date);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/admin/audit-log${qs ? `?${qs}` : ""}` as Route;
  };

  const buildPageHref = (page: number) => buildHref({ page: String(page) });

  const hasError = !!data.totalError && data.items.length === 0;
  const isEmpty = !hasError && data.items.length === 0;
  const showPagination = !hasError && !isEmpty && (data.total !== null ? data.total > data.pageSize : data.hasMore || data.page > 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Audit Log</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only platform audit trail — actor, action, target, organization, reason, and safe change summaries.
        </p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid gap-3 lg:grid-cols-12" role="search" aria-label="Audit log filters">
            <div className="space-y-1.5 lg:col-span-3">
              <Label htmlFor="q" className="text-xs font-medium">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="q"
                  name="q"
                  defaultValue={data.query}
                  placeholder="Action, target, or reason"
                  maxLength={100}
                  className="pl-9"
                  aria-label="Search audit logs"
                />
              </div>
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="action" className="text-xs font-medium">
                Action
              </Label>
              <select
                id="action"
                name="action"
                defaultValue={data.action}
                className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All actions</option>
                {data.availableActions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="target_type" className="text-xs font-medium">
                Target
              </Label>
              <select
                id="target_type"
                name="target_type"
                defaultValue={data.targetType}
                className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">All targets</option>
                <option value="organization">organization</option>
                <option value="user">user</option>
                <option value="tool">tool</option>
                <option value="entitlement">entitlement</option>
                <option value="platform_admin">platform_admin</option>
                <option value="plan">plan</option>
                <option value="order">order</option>
                <option value="payment">payment</option>
              </select>
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <Label htmlFor="org_q" className="text-xs font-medium">
                Organization
              </Label>
              <div className="relative">
                <Building2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="org_q"
                  name="org_q"
                  defaultValue={data.organizationQuery}
                  placeholder="Org name or slug"
                  maxLength={100}
                  className="pl-9"
                  aria-label="Filter by organization"
                />
              </div>
            </div>

            <div className="space-y-1.5 lg:col-span-1">
              <Label htmlFor="date" className="text-xs font-medium">
                Date
              </Label>
              <select
                id="date"
                name="date"
                defaultValue={data.dateFilter}
                className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="all">All time</option>
                <option value="today">Today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
            </div>

            <div className="flex items-end gap-2 lg:col-span-2">
              <Button type="submit" className="min-h-[44px] flex-1">
                <Filter className="mr-1.5 h-4 w-4" aria-hidden /> Apply
              </Button>
              {(data.query || data.action || data.targetType || data.organizationQuery || data.dateFilter !== "all") && (
                <Link
                  href={"/admin/audit-log" as Route}
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
            "Unable to load audit logs right now."
          ) : data.query || data.action || data.targetType || data.organizationQuery || data.dateFilter !== "all" ? (
            <>
              {data.total !== null ? `${new Intl.NumberFormat("en-IN").format(data.total)} result${data.total === 1 ? "" : "s"}` : `${data.items.length} results`}
              {data.query ? ` for “${data.query}”` : ""}
            </>
          ) : data.total !== null ? (
            <>{new Intl.NumberFormat("en-IN").format(data.total)} audit events total</>
          ) : (
            `${data.items.length} audit events`
          )}
        </p>
        {data.totalPages && <span className="hidden sm:inline">Page {data.page} of {data.totalPages}</span>}
      </div>

      {/* Content */}
      {hasError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-destructive">Unable to load audit logs</p>
            <p className="mt-1 text-xs text-muted-foreground">Please try again.</p>
          </CardContent>
        </Card>
      ) : isEmpty ? (
        <Card>
          <CardContent className="p-8 text-center">
            <ScrollText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">
              {data.query || data.action || data.targetType || data.organizationQuery || data.dateFilter !== "all"
                ? "No audit events match these filters."
                : "No audit records found."}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">Audit events appear here after Super Admin actions.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4 text-muted-foreground" aria-hidden /> Audit Trail
            </CardTitle>
            <CardDescription>
              Timestamp, actor, action, target, organization, reason — IP and change details in expanded view. Sensitive fields are omitted.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Audit logs</caption>
                <thead>
                  <tr className="border-y border-border bg-surface-muted/40 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Timestamp
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Actor
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Action
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Target
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Organization
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                      Reason
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.items.map((item) => (
                    <>
                      <tr key={item.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3 shrink-0" aria-hidden /> {formatDate(item.createdAt)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <p className="max-w-[180px] truncate text-xs font-medium" title={item.actorEmail ?? ""}>
                            {item.actorDisplayName ?? "—"}
                          </p>
                          <p className="max-w-[180px] truncate text-xs text-muted-foreground" title={item.actorEmail ?? ""}>
                            {item.actorEmail ?? item.actorUserId.slice(0, 8) + "…"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {item.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium">{item.targetType}</p>
                          <p className="font-mono text-xs text-muted-foreground truncate max-w-[120px]" title={item.targetId ?? ""}>
                            {item.targetId ? item.targetId.slice(0, 8) + "…" : "—"}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {item.organizationId ? (
                            <>
                              <p className="text-xs font-medium">{item.organizationName ?? "Unknown"}</p>
                              <p className="text-xs text-muted-foreground">{item.organizationSlug ?? item.organizationId.slice(0, 8) + "…"}</p>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell max-w-[200px] truncate" title={item.reason ?? ""}>
                          {item.reason ? item.reason.slice(0, 80) : "—"}
                        </td>
                      </tr>
                      {/* Detail row — safe before/after summary */}
                      {(item.before.entries.length > 0 || item.after.entries.length > 0 || item.before.omitted > 0 || item.after.omitted > 0 || item.ip) && (
                        <tr key={`${item.id}-detail`} className="bg-surface-muted/20">
                          <td colSpan={6} className="px-4 py-3">
                            <details className="group">
                              <summary className="inline-flex min-h-[32px] cursor-pointer items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-1">
                                <span className="group-open:hidden">Show details</span>
                                <span className="hidden group-open:inline">Hide details</span>
                                {item.ip && <span className="ml-2 font-mono text-xs text-muted-foreground">IP: {formatIp(item.ip)}</span>}
                              </summary>
                              <div className="mt-3 grid gap-3 text-xs lg:grid-cols-2">
                                <div className="rounded-[12px] border border-border bg-card p-3">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Before</p>
                                  {item.before.empty && item.before.omitted === 0 ? (
                                    <p className="mt-2 text-muted-foreground">No prior state.</p>
                                  ) : item.before.entries.length === 0 && item.before.omitted > 0 ? (
                                    <p className="mt-2 text-muted-foreground">Sensitive fields omitted ({item.before.omitted}).</p>
                                  ) : (
                                    <>
                                      <dl className="mt-2 space-y-1">
                                        {item.before.entries.map((e) => (
                                          <div key={e.key} className="flex justify-between gap-2">
                                            <dt className="text-muted-foreground truncate">{e.key}:</dt>
                                            <dd className="font-mono truncate text-foreground max-w-[200px]" title={e.value}>
                                              {e.value}
                                            </dd>
                                          </div>
                                        ))}
                                      </dl>
                                      {item.before.omitted > 0 && (
                                        <p className="mt-2 text-xs text-muted-foreground">+ {item.before.omitted} sensitive field(s) omitted.</p>
                                      )}
                                    </>
                                  )}
                                </div>
                                <div className="rounded-[12px] border border-border bg-card p-3">
                                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">After</p>
                                  {item.after.empty && item.after.omitted === 0 ? (
                                    <p className="mt-2 text-muted-foreground">No change data.</p>
                                  ) : item.after.entries.length === 0 && item.after.omitted > 0 ? (
                                    <p className="mt-2 text-muted-foreground">Sensitive fields omitted ({item.after.omitted}).</p>
                                  ) : (
                                    <>
                                      <dl className="mt-2 space-y-1">
                                        {item.after.entries.map((e) => (
                                          <div key={e.key} className="flex justify-between gap-2">
                                            <dt className="text-muted-foreground truncate">{e.key}:</dt>
                                            <dd className="font-mono truncate text-foreground max-w-[200px]" title={e.value}>
                                              {e.value}
                                            </dd>
                                          </div>
                                        ))}
                                      </dl>
                                      {item.after.omitted > 0 && (
                                        <p className="mt-2 text-xs text-muted-foreground">+ {item.after.omitted} sensitive field(s) omitted.</p>
                                      )}
                                    </>
                                  )}
                                </div>
                              </div>
                              <p className="mt-2 text-xs text-muted-foreground">
                                Changes are summarized — raw JSON is not rendered. Full audit ID: <span className="font-mono">{item.id.slice(0, 8)}…</span>
                              </p>
                            </details>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-between gap-2">
          {data.page > 1 ? (
            <Link
              href={buildPageHref(data.page - 1) as never}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Previous
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Previous</span>
          )}
          <span className="text-sm text-muted-foreground" aria-live="polite">
            Page {data.page}
            {data.totalPages ? ` of ${data.totalPages}` : ""}
          </span>
          {data.hasMore || (data.totalPages !== null && data.page < data.totalPages) ? (
            <Link
              href={buildPageHref(data.page + 1) as never}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Next
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Next</span>
          )}
        </div>
      )}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Audit records are consumed, not generated, by viewing this page. Sensitive fields (passwords, tokens, secrets) are never rendered — omitted entries are noted
        explicitly.
      </p>
    </div>
  );
}
