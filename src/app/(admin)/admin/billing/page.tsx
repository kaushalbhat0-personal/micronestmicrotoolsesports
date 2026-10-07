import Link from "next/link";
import type { Route } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminBilling } from "@/server/admin/billing";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Receipt, CreditCard, Webhook, Package } from "lucide-react";

export const dynamic = "force-dynamic";

function formatMinor(amountMinor: number, currency: string): string {
  const amount = amountMinor / 100;
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(amount);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function AdminBillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const data = await getAdminBilling(params);

  const section = data.section;
  const buildSectionHref = (s: string) => {
    const p = new URLSearchParams();
    p.set("section", s);
    const qs = p.toString();
    return `/admin/billing?${qs}` as Route;
  };

  const buildPageHref = (page: number) => {
    const p = new URLSearchParams();
    p.set("section", section);
    if (data.query) p.set("q", data.query);
    if (data.status) p.set("status", data.status);
    if (data.billingPeriod) p.set("billing_period", data.billingPeriod);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/admin/billing?${qs}` as Route;
  };

  const totalPages = data.total !== null ? Math.max(1, Math.ceil(data.total / data.pageSize)) : null;
  const showPagination = data.total !== null ? data.total > data.pageSize : data.hasMore || data.page > 1;
  const hasError = !!data.totalError && (section === "orders" ? data.orders.length === 0 : section === "payments" ? data.payments.length === 0 : section === "webhooks" ? data.webhooks.length === 0 : data.plans.length === 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Billing</h1>
        <p className="mt-1 text-sm text-muted-foreground">Read-only visibility into orders, payments, webhook events, and plans.</p>
      </div>

      {/* Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Orders</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.orders.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.orders.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.orders.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Paid Orders</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.paidOrders.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.paidOrders.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.paidOrders.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Payments</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.payments.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.payments.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.payments.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Webhook Events</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.webhooks.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.webhooks.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.webhooks.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="text-xs uppercase tracking-widest">Plans</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {data.overview.plans.error ? <span className="text-sm text-destructive">Unavailable</span> : data.overview.plans.count !== null ? new Intl.NumberFormat("en-IN").format(data.overview.plans.count) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Section tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Billing sections">
        {(["orders", "payments", "webhooks", "plans"] as const).map((s) => {
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

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid gap-3 sm:grid-cols-4" role="search" aria-label="Billing filters">
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
                  placeholder={
                    section === "orders"
                      ? "Razorpay order or org"
                      : section === "payments"
                        ? "Razorpay payment or org"
                        : section === "webhooks"
                          ? "Provider event ID"
                          : "Plan slug or name"
                  }
                  maxLength={100}
                  className="pl-9"
                  aria-label="Search billing records"
                />
              </div>
            </div>

            {section === "orders" && (
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-medium">
                  Status
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={data.status}
                  className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="created">Created</option>
                  <option value="paid">Paid</option>
                  <option value="failed">Failed</option>
                  <option value="expired">Expired</option>
                </select>
              </div>
            )}
            {section === "payments" && (
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-medium">
                  Status
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={data.status}
                  className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="created">Created</option>
                  <option value="authorized">Authorized</option>
                  <option value="captured">Captured</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            )}
            {section === "webhooks" && (
              <div className="space-y-1.5">
                <Label htmlFor="status" className="text-xs font-medium">
                  Status
                </Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={data.status}
                  className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">All</option>
                  <option value="pending">Pending</option>
                  <option value="processing">Processing</option>
                  <option value="succeeded">Succeeded</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            )}
            {section === "plans" && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="billing_period" className="text-xs font-medium">
                    Period
                  </Label>
                  <select
                    id="billing_period"
                    name="billing_period"
                    defaultValue={data.billingPeriod}
                    className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">All</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="status" className="text-xs font-medium">
                    Active
                  </Label>
                  <select
                    id="status"
                    name="status"
                    defaultValue={data.status}
                    className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">All</option>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </>
            )}

            <div className="flex items-end gap-2">
              <Button type="submit" className="min-h-[44px] flex-1">
                Apply
              </Button>
              {(data.query || data.status || data.billingPeriod) && (
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
            "Unable to load billing data right now."
          ) : data.query || data.status || data.billingPeriod ? (
            <>
              {data.total !== null ? `${new Intl.NumberFormat("en-IN").format(data.total)} result${data.total === 1 ? "" : "s"}` : `${section === "orders" ? data.orders.length : section === "payments" ? data.payments.length : section === "webhooks" ? data.webhooks.length : data.plans.length} results`}
              {data.query ? ` for “${data.query}”` : ""}
            </>
          ) : data.total !== null ? (
            <>{new Intl.NumberFormat("en-IN").format(data.total)} {section} total</>
          ) : (
            `${section === "orders" ? data.orders.length : section === "payments" ? data.payments.length : section === "webhooks" ? data.webhooks.length : data.plans.length} ${section}`
          )}
        </p>
        {totalPages && <span className="hidden sm:inline">Page {data.page} of {totalPages}</span>}
      </div>

      {/* Tables */}
      {hasError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-destructive">Unable to load billing data</p>
            <p className="mt-1 text-xs text-muted-foreground">Please try again.</p>
          </CardContent>
        </Card>
      ) : section === "orders" ? (
        data.orders.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Receipt className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">{data.query || data.status ? "No orders match the selected filters." : "No orders found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Orders</CardTitle>
              <CardDescription>Historical amounts are preserved — plan changes do not affect past orders.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Orders</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Organization
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Plan
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Access
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Status
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                        Razorpay Order
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.orders.map((o) => (
                      <tr key={o.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium">{o.organizationName}</p>
                          <p className="text-xs text-muted-foreground">{o.organizationSlug}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{o.planName ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {o.planSlug ?? "—"} {o.billingPeriod ? `· ${o.billingPeriod}` : ""}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          {o.isAllAccess ? <Badge variant="success">All Access</Badge> : <Badge variant="secondary">{o.toolName ?? "—"}</Badge>}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{formatMinor(o.amountMinor, o.currency)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={o.status === "paid" ? "success" : o.status === "failed" ? "destructive" : "secondary"}>{o.status}</Badge>
                        </td>
                        <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell truncate max-w-[160px]" title={o.razorpayOrderId ?? ""}>
                          {o.razorpayOrderId ?? "—"}
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(o.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : section === "payments" ? (
        data.payments.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CreditCard className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">{data.query || data.status ? "No payments match the selected filters." : "No payments found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Payments</CardTitle>
              <CardDescription>Verified via Razorpay HMAC and authoritative fetch — status is from database, not provider.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Payments</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Razorpay Payment
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Organization
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Status
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                        Verified
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.payments.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3 font-mono text-xs truncate max-w-[180px]" title={p.razorpayPaymentId ?? ""}>
                          {p.razorpayPaymentId ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium">{p.organizationName}</p>
                          <p className="text-xs text-muted-foreground">{p.organizationSlug}</p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{formatMinor(p.amountMinor, p.currency)}</td>
                        <td className="px-4 py-3">
                          <Badge variant={p.status === "captured" ? "success" : p.status === "failed" ? "destructive" : "secondary"}>{p.status}</Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{p.verifiedAt ? formatDate(p.verifiedAt) : "—"}</td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{formatDate(p.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : section === "webhooks" ? (
        data.webhooks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Webhook className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">{data.query || data.status ? "No webhook events match the selected filters." : "No webhook events found."}</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Webhook Events</CardTitle>
              <CardDescription>Provider event ID and status — payload not exposed.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Webhook events</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Provider Event ID
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Event Type
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Status
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                        Provider
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                        Created
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.webhooks.map((w) => (
                      <tr key={w.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3 font-mono text-xs truncate max-w-[200px]" title={w.providerEventId}>
                          {w.providerEventId}
                        </td>
                        <td className="px-4 py-3 text-xs">{w.eventType ?? "—"}</td>
                        <td className="px-4 py-3">
                          <Badge variant={w.status === "succeeded" ? "success" : w.status === "failed" ? "destructive" : "secondary"}>{w.status ?? (w.processed ? "processed" : "pending")}</Badge>
                        </td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{w.provider}</td>
                        <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{formatDate(w.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : section === "plans" ? (
        data.plans.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
              <p className="mt-3 text-sm font-medium">No plans found.</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Plans</CardTitle>
              <CardDescription>Current pricing configuration — orders preserve historical amounts.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <caption className="sr-only">Plans</caption>
                  <thead>
                    <tr className="border-y border-border bg-surface-muted/40 text-left">
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Plan
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:table-cell">
                        Slug
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Period
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Amount
                      </th>
                      <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                        Access
                      </th>
                      <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                        Active
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.plans.map((p) => (
                      <tr key={p.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3 font-medium">{p.name}</td>
                        <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell">{p.slug}</td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className="capitalize">
                            {p.billingPeriod}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">{formatMinor(p.amountMinor, p.currency)}</td>
                        <td className="px-4 py-3">
                          {p.isAllAccess ? <Badge variant="success">All Access</Badge> : <span className="text-xs">{p.toolName ?? "—"}</span>}
                        </td>
                        <td className="hidden px-4 py-3 lg:table-cell">
                          <Badge variant={p.isActive ? "success" : "secondary"}>{p.isActive ? "Active" : "Inactive"}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )
      ) : null}

      {/* Pagination */}
      {showPagination && !hasError && (section === "orders" ? data.orders.length > 0 : section === "payments" ? data.payments.length > 0 : section === "webhooks" ? data.webhooks.length > 0 : data.plans.length > 0) && (
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
