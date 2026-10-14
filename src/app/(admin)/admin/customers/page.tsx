import Link from "next/link";
import type { Route } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { searchCustomers, getCustomerByUser, getCustomerByOrg } from "@/server/admin/customers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, User, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

function formatMinor(amountMinor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency, minimumFractionDigits: 2 }).format(amountMinor / 100);
  } catch {
    return `${currency} ${(amountMinor / 100).toFixed(2)}`;
  }
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const get = (k: string) => {
    const v = params[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
  };
  const q = get("q");
  const userId = get("user_id");
  const orgId = get("org_id");

  const search = await searchCustomers(q);
  const userDetail = userId ? await getCustomerByUser(userId) : null;
  const orgDetail = orgId ? await getCustomerByOrg(orgId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Customers</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only Customer 360 — search by user email, organization name, or organization slug.
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-end" role="search" aria-label="Customer search">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="q" className="text-xs font-medium">
                Search
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="q" name="q" defaultValue={search.query} placeholder="user email, org name, or org slug" maxLength={100} className="pl-9" aria-label="Search customers" />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="min-h-[44px] flex-1 sm:flex-none">
                Search
              </Button>
              {(q || userId || orgId) && (
                <Link
                  href={"/admin/customers" as Route}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {q && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Results {search.items.length > 0 ? `(${search.items.length})` : ""}</CardTitle>
            <CardDescription>Bounded to 20 — select a customer to open the 360 view.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {search.items.length === 0 ? (
              <p className="p-6 text-center text-sm text-muted-foreground">No customers match “{search.query}”.</p>
            ) : (
              <ul className="divide-y divide-border">
                {search.items.map((item, i) => (
                  <li key={`${item.kind}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {item.kind === "user" ? (
                        <User className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      ) : (
                        <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{item.kind === "user" ? (item.userEmail ?? "Unknown email") : (item.organizationName ?? "Unknown")}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {item.kind === "user" ? (item.userDisplayName ?? "") : (item.organizationSlug ?? "")}
                        </p>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {item.kind}
                      </Badge>
                    </div>
                    <Link
                      href={
                        (item.kind === "user"
                          ? `/admin/customers?q=${encodeURIComponent(search.query)}&user_id=${item.userId}`
                          : `/admin/customers?q=${encodeURIComponent(search.query)}&org_id=${item.organizationId}`) as Route
                      }
                      className="inline-flex min-h-[44px] shrink-0 items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Open
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {userDetail && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Identity</CardTitle>
              <CardDescription>User profile — safe source, never auth.users.</CardDescription>
            </CardHeader>
            <CardContent>
              {userDetail.user ? (
                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="font-medium">{userDetail.user.email ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Profile ID</dt>
                    <dd className="font-mono text-xs">{userDetail.user.id.slice(0, 8)}…</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Created</dt>
                    <dd>{formatDate(userDetail.user.createdAt)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">User not found.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Organizations ({userDetail.memberships.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {userDetail.memberships.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No memberships.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Memberships</caption>
                    <thead>
                      <tr className="border-y border-border bg-surface-muted/40 text-left">
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Organization</th>
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Role</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {userDetail.memberships.map((m) => (
                        <tr key={m.organizationId} className="hover:bg-surface-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium">{m.organizationName}</p>
                            <p className="text-xs text-muted-foreground">{m.organizationSlug}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{m.role}</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Entitlements ({userDetail.entitlements.length})</CardTitle>
              <CardDescription>All six released tools, org + user scope, active/expired state.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {userDetail.entitlements.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No entitlements.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Entitlements</caption>
                    <thead>
                      <tr className="border-y border-border bg-surface-muted/40 text-left">
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tool</th>
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Source</th>
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Scope</th>
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">State</th>
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {userDetail.entitlements.map((e) => (
                        <tr key={`${e.scope}-${e.id}`} className="hover:bg-surface-muted/30">
                          <td className="px-4 py-3">
                            <p className="font-medium">{e.toolName ?? e.toolSlug ?? "—"}</p>
                            <p className="font-mono text-xs text-muted-foreground">{e.toolSlug ?? "—"}</p>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{e.source}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {e.scope}
                            {e.organizationName ? ` · ${e.organizationName}` : ""}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={e.isActive ? "success" : "destructive"}>{e.isPermanent ? "Permanent" : e.isActive ? "Active" : "Expired"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{e.isPermanent ? "Lifetime" : formatDate(e.expiresAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Orders ({userDetail.orders.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {userDetail.orders.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No orders.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {userDetail.orders.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">{o.planName ?? "Order"}</p>
                          <p className="font-mono text-xs text-muted-foreground">{o.razorpayOrderId ?? o.id.slice(0, 8)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xs">{formatMinor(o.amountMinor, o.currency)}</p>
                          <Badge variant={o.status === "paid" ? "success" : "secondary"}>{o.status}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Payments ({userDetail.payments.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {userDetail.payments.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">No payments.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {userDetail.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                        <div className="min-w-0">
                          <p className="font-mono text-xs">{p.razorpayPaymentId ?? p.id.slice(0, 8)}</p>
                          <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-mono text-xs">{formatMinor(p.amountMinor, p.currency)}</p>
                          <Badge variant={p.status === "captured" ? "success" : "secondary"}>{p.status}</Badge>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Webhooks ({userDetail.webhooks.length})</CardTitle>
                <CardDescription>Safe metadata only — no payloads.</CardDescription>
              </CardHeader>
              <CardContent>
                {userDetail.webhooks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No webhook attempts.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {userDetail.webhooks.map((w) => (
                      <li key={w.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="font-mono text-xs">{w.providerEventId.slice(0, 16)}…</span>
                        <Badge variant={w.status === "succeeded" ? "success" : w.status === "failed" ? "destructive" : "secondary"}>
                          {w.status ?? "pending"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Audit ({userDetail.audit.length})</CardTitle>
                <CardDescription>Safe projection — secrets omitted.</CardDescription>
              </CardHeader>
              <CardContent>
                {userDetail.audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audit entries.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {userDetail.audit.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="font-mono text-xs">{a.action}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {orgDetail && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Organization</CardTitle>
            </CardHeader>
            <CardContent>
              {orgDetail.organization ? (
                <dl className="grid gap-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">Name</dt>
                    <dd className="font-medium">{orgDetail.organization.name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Slug</dt>
                    <dd className="font-mono text-xs">{orgDetail.organization.slug}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Created</dt>
                    <dd>{formatDate(orgDetail.organization.createdAt)}</dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted-foreground">Organization not found.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Members ({orgDetail.members.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orgDetail.members.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No members.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {orgDetail.members.map((m) => (
                    <li key={m.userId} className="flex items-center justify-between gap-2 px-4 py-3 text-sm">
                      <span className="font-medium">{m.email ?? m.displayName ?? m.userId.slice(0, 8)}</span>
                      <Badge variant="secondary">{m.role}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Entitlements ({orgDetail.entitlements.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {orgDetail.entitlements.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No entitlements.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Organization entitlements</caption>
                    <thead>
                      <tr className="border-y border-border bg-surface-muted/40 text-left">
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Tool</th>
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Source</th>
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">State</th>
                        <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Expiry</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {orgDetail.entitlements.map((e) => (
                        <tr key={e.id} className="hover:bg-surface-muted/30">
                          <td className="px-4 py-3 font-medium">{e.toolName ?? e.toolSlug ?? "—"}</td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">{e.source}</Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant={e.isActive ? "success" : "destructive"}>{e.isPermanent ? "Permanent" : e.isActive ? "Active" : "Expired"}</Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{e.isPermanent ? "Lifetime" : formatDate(e.expiresAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Orders ({orgDetail.orders.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {orgDetail.orders.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No orders.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {orgDetail.orders.map((o) => (
                      <li key={o.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="font-mono text-xs">{o.razorpayOrderId ?? o.id.slice(0, 8)}</span>
                        <Badge variant={o.status === "paid" ? "success" : "secondary"}>{o.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Payments ({orgDetail.payments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {orgDetail.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No payments.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {orgDetail.payments.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="font-mono text-xs">{p.razorpayPaymentId ?? p.id.slice(0, 8)}</span>
                        <Badge variant={p.status === "captured" ? "success" : "secondary"}>{p.status}</Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Audit ({orgDetail.audit.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {orgDetail.audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No audit entries.</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {orgDetail.audit.map((a) => (
                      <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                        <span className="font-mono text-xs">{a.action}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(a.createdAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {!q && !userId && !orgId && (
        <Card>
          <CardContent className="p-8 text-center">
            <Search className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">Search for a customer to begin</p>
            <p className="mt-1 text-xs text-muted-foreground">Enter a user email, organization name, or organization slug above.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
