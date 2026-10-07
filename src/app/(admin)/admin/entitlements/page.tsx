import Link from "next/link";
import type { Route } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminEntitlements } from "@/server/admin/entitlements";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, KeyRound, ShieldCheck, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(value: string | null): string {
  if (!value) return "Permanent";
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function AdminEntitlementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const result = await getAdminEntitlements(params);

  const hasError = !!result.totalError && result.items.length === 0;
  const totalPages = result.total !== null ? Math.max(1, Math.ceil(result.total / result.pageSize)) : null;
  const showPagination = result.total !== null ? result.total > result.pageSize : result.hasMore || result.page > 1;

  const buildPageHref = (page: number) => {
    const p = new URLSearchParams();
    if (result.query) p.set("q", result.query);
    if (result.tool) p.set("tool", result.tool);
    if (result.status !== "all") p.set("status", result.status);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/admin/entitlements${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Entitlements</h1>
        <p className="mt-1 text-sm text-muted-foreground">View platform entitlements — organization, tool, access, and expiry.</p>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="grid gap-3 sm:grid-cols-4" role="search" aria-label="Entitlements filters">
            <div className="space-y-1.5 sm:col-span-1">
              <Label htmlFor="q" className="text-xs font-medium">
                Organization
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="q" name="q" defaultValue={result.query} placeholder="Search name or slug" maxLength={100} className="pl-9" aria-label="Search entitlements by organization" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tool" className="text-xs font-medium">
                Tool
              </Label>
              <select
                id="tool"
                name="tool"
                defaultValue={result.tool}
                className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Filter by tool"
              >
                <option value="">All tools</option>
                <option value="all-access">All Access</option>
                {result.tools.map((t) => (
                  <option key={t.slug} value={t.slug}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="status" className="text-xs font-medium">
                Status
              </Label>
              <select
                id="status"
                name="status"
                defaultValue={result.status}
                className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Filter by status"
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <Button type="submit" className="min-h-[44px] flex-1">
                Apply
              </Button>
              {(result.query || result.tool || result.status !== "all") && (
                <Link
                  href={"/admin/entitlements" as Route}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          {hasError ? (
            "Unable to load entitlements right now."
          ) : result.query || result.tool || result.status !== "all" ? (
            <>
              {result.total !== null ? `${new Intl.NumberFormat("en-IN").format(result.total)} result${result.total === 1 ? "" : "s"}` : `${result.items.length} results`}
              {result.query ? ` for “${result.query}”` : ""}
              {result.tool ? ` · ${result.tool}` : ""}
              {result.status !== "all" ? ` · ${result.status}` : ""}
            </>
          ) : result.total !== null ? (
            <>{new Intl.NumberFormat("en-IN").format(result.total)} entitlement{result.total === 1 ? "" : "s"} total</>
          ) : (
            `${result.items.length} entitlements`
          )}
        </p>
        {totalPages && <span className="hidden sm:inline">Page {result.page} of {totalPages}</span>}
      </div>

      {/* Table / states */}
      {hasError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-destructive">Unable to load entitlements</p>
            <p className="mt-1 text-xs text-muted-foreground">Please try again. If the problem persists, contact engineering.</p>
          </CardContent>
        </Card>
      ) : result.tools.length === 0 && !hasError ? null : result.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <KeyRound className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">
              {result.query || result.tool || result.status !== "all" ? "No entitlements match the selected filters." : "No entitlements found."}
            </p>
            {(result.query || result.tool || result.status !== "all") && (
              <Link href={"/admin/entitlements" as Route} className="mt-3 inline-flex text-sm text-primary hover:underline">
                Clear filters
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Entitlements</CardTitle>
            <CardDescription>
              {result.total !== null ? `Showing ${result.items.length} of ${new Intl.NumberFormat("en-IN").format(result.total)}` : `Showing ${result.items.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Entitlements list</caption>
                <thead>
                  <tr className="border-y border-border bg-surface-muted/40 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Organization
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Tool
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Access
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Status
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                      Expires
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                      Source
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.items.map((e) => (
                    <tr key={e.id} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{e.organizationName}</p>
                        <p className="text-xs text-muted-foreground">{e.organizationSlug}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {e.isAllAccess ? <ShieldCheck className="h-3.5 w-3.5 text-teal-600" aria-hidden /> : <KeyRound className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
                          <span className="font-medium">{e.toolName ?? "—"}</span>
                        </span>
                        <span className="block text-xs text-muted-foreground">{e.toolSlug ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        {e.isAllAccess ? (
                          <Badge variant="success">All Access</Badge>
                        ) : (
                          <Badge variant="secondary">Individual</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {e.status === "Permanent" ? (
                          <Badge variant="secondary" className="gap-1">
                            <Clock className="h-3 w-3" aria-hidden /> Permanent
                          </Badge>
                        ) : e.status === "Active" ? (
                          <Badge variant="success">Active</Badge>
                        ) : (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </td>
                      <td className="hidden px-4 py-3 text-xs tabular-nums text-muted-foreground md:table-cell">{e.expiresAt ? formatDate(e.expiresAt) : "Permanent"}</td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">
                        <Badge variant="secondary" className="capitalize">
                          {e.source}
                        </Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground lg:table-cell">{formatDate(e.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {showPagination && !hasError && result.items.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          {result.page > 1 ? (
            <Link
              href={buildPageHref(result.page - 1) as never}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Previous
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Previous</span>
          )}
          <span className="text-sm text-muted-foreground">
            Page {result.page}
            {totalPages ? ` of ${totalPages}` : ""}
          </span>
          {result.hasMore || (totalPages !== null && result.page < totalPages) ? (
            <Link
              href={buildPageHref(result.page + 1) as never}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
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
