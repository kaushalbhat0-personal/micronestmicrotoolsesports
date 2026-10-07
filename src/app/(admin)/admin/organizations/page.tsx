import Link from "next/link";
import type { Route } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminOrganizations } from "@/server/admin/organizations";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Search, Building2 } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function AdminOrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const result = await getAdminOrganizations(params);

  const hasError = !!result.totalError && result.items.length === 0;
  const totalPages = result.total !== null ? Math.max(1, Math.ceil(result.total / result.pageSize)) : null;
  const showPagination = result.total !== null ? result.total > result.pageSize : result.hasMore || result.page > 1;

  const buildHref = (page: number, q: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/admin/organizations${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Organizations</h1>
        <p className="mt-1 text-sm text-muted-foreground">View organizations across the platform.</p>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-end" role="search" aria-label="Organizations search">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="q" className="text-xs font-medium">
                Search organizations
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="q"
                  name="q"
                  defaultValue={result.query}
                  placeholder="Search by name or slug"
                  maxLength={100}
                  className="pl-9"
                  aria-label="Search organizations by name or slug"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="min-h-[44px]">
                Search
              </Button>
              {result.query && (
                <Link
                  href={"/admin/organizations" as Route}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  Clear
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Result context */}
      <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
        <p aria-live="polite">
          {hasError ? (
            "Unable to load organizations right now."
          ) : result.query ? (
            <>
              {result.total !== null ? `${new Intl.NumberFormat("en-IN").format(result.total)} result${result.total === 1 ? "" : "s"}` : `${result.items.length} results`} for “{result.query}”
            </>
          ) : result.total !== null ? (
            <>
              {new Intl.NumberFormat("en-IN").format(result.total)} organization{result.total === 1 ? "" : "s"} total
            </>
          ) : (
            `${result.items.length} organizations`
          )}
        </p>
        {totalPages && <span className="hidden sm:inline">Page {result.page} of {totalPages}</span>}
      </div>

      {/* Error vs Empty vs Table */}
      {hasError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-destructive">Unable to load organizations</p>
            <p className="mt-1 text-xs text-muted-foreground">Please try again. If the problem persists, contact engineering.</p>
          </CardContent>
        </Card>
      ) : result.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Building2 className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">{result.query ? `No organizations match “${result.query}”.` : "No organizations found."}</p>
            {result.query && (
              <Link href={"/admin/organizations" as Route} className="mt-3 inline-flex text-sm text-primary hover:underline">
                Clear search
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Organizations</CardTitle>
            <CardDescription>
              {result.total !== null ? `Showing ${result.items.length} of ${new Intl.NumberFormat("en-IN").format(result.total)}` : `Showing ${result.items.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Organizations list</caption>
                <thead>
                  <tr className="border-y border-border bg-surface-muted/40 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Organization
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground sm:table-cell">
                      Slug
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Members
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                      Created
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground lg:table-cell">
                      ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.items.map((org) => (
                    <tr key={org.id} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{org.name}</p>
                        <p className="mt-1 text-xs text-muted-foreground sm:hidden">{org.slug}</p>
                      </td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground sm:table-cell" title={org.slug}>
                        <span className="truncate block max-w-[160px]">{org.slug}</span>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{new Intl.NumberFormat("en-IN").format(org.memberCount)}</td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(org.created_at)}</td>
                      <td className="hidden px-4 py-3 font-mono text-xs text-muted-foreground lg:table-cell" title={org.id}>
                        <span className="block max-w-[120px] truncate">{org.id.slice(0, 8)}…</span>
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
      {showPagination && !hasError && result.items.length > 0 && (
        <div className="flex items-center justify-between gap-2">
          {result.page > 1 ? (
            <Link
              href={buildHref(result.page - 1, result.query) as never}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Previous
            </Link>
          ) : (
            <span className="inline-flex min-h-[44px] items-center rounded-full border border-transparent px-4 text-sm text-muted-foreground">Previous</span>
          )}
          <span className="text-sm text-muted-foreground" aria-current="page">
            Page {result.page}
            {totalPages ? ` of ${totalPages}` : ""}
          </span>
          {result.hasMore || (totalPages !== null && result.page < totalPages) ? (
            <Link
              href={buildHref(result.page + 1, result.query) as never}
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
