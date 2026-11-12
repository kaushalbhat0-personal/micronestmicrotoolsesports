import Link from "next/link";
import type { Route } from "next";
import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminUsers } from "@/server/admin/users";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Users } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

function initials(name: string | null, email: string | null): string {
  const base = (name ?? email ?? "?").trim();
  if (!base) return "?";
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase().slice(0, 2);
  return base.slice(0, 2).toUpperCase();
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireSuperAdmin();
  const params = await searchParams;
  const result = await getAdminUsers(params);

  const hasError = !!result.totalError && result.items.length === 0;
  const totalPages = result.total !== null ? Math.max(1, Math.ceil(result.total / result.pageSize)) : null;
  const showPagination = result.total !== null ? result.total > result.pageSize : result.hasMore || result.page > 1;

  const buildHref = (page: number, q: string) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (page > 1) p.set("page", String(page));
    const qs = p.toString();
    return `/admin/users${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Users</h1>
        <p className="mt-1 text-sm text-muted-foreground">View platform users and their organization memberships.</p>
      </div>

      <Card>
        <CardContent className="p-4">
          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-end" role="search" aria-label="Users search">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="q" className="text-xs font-medium">
                Search users
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input
                  id="q"
                  name="q"
                  defaultValue={result.query}
                  placeholder="Search by email or name"
                  maxLength={100}
                  className="pl-9"
                  aria-label="Search users by email or name"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="min-h-[44px]">
                Search
              </Button>
              {result.query && (
                <Link
                  href={"/admin/users" as Route}
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-border bg-card px-4 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
          {hasError ? (
            "Unable to load users right now."
          ) : result.query ? (
            <>
              {result.total !== null ? `${new Intl.NumberFormat("en-IN").format(result.total)} result${result.total === 1 ? "" : "s"}` : `${result.items.length} results`} for “{result.query}”
            </>
          ) : result.total !== null ? (
            <>
              {new Intl.NumberFormat("en-IN").format(result.total)} user{result.total === 1 ? "" : "s"} total
            </>
          ) : (
            `${result.items.length} users`
          )}
        </p>
        {totalPages && <span className="hidden sm:inline">Page {result.page} of {totalPages}</span>}
      </div>

      {hasError ? (
        <Card>
          <CardContent className="p-8 text-center">
            <p className="text-sm font-medium text-destructive">Unable to load users</p>
            <p className="mt-1 text-xs text-muted-foreground">Please try again.</p>
          </CardContent>
        </Card>
      ) : result.items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Users className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden />
            <p className="mt-3 text-sm font-medium">{result.query ? `No users match “${result.query}”.` : "No users found."}</p>
            {result.query && (
              <Link href={"/admin/users" as Route} className="mt-3 inline-flex text-sm text-primary hover:underline">
                Clear search
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Users</CardTitle>
            <CardDescription>
              {result.total !== null ? `Showing ${result.items.length} of ${new Intl.NumberFormat("en-IN").format(result.total)}` : `Showing ${result.items.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Users list</caption>
                <thead>
                  <tr className="border-y border-border bg-surface-muted/40 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      User
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Email
                    </th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      Organizations
                    </th>
                    <th scope="col" className="hidden px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground md:table-cell">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.items.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={u.avatar_url} alt="" className="h-8 w-8 rounded-full border border-border object-cover" />
                          ) : (
                            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-muted text-xs font-medium" aria-hidden>
                              {initials(u.display_name, u.email)}
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate font-medium text-foreground max-w-[160px]">{u.display_name ?? u.email ?? "—"}</p>
                            <p className="text-xs text-muted-foreground sm:hidden truncate max-w-[160px]">{u.email ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground max-w-[200px] truncate" title={u.email ?? ""}>
                        {u.email ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {u.organizations.length === 0 ? (
                          <span className="text-xs text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {u.organizations.slice(0, 3).map((org) => (
                              <Badge key={org.id} variant="secondary" className="font-mono text-xs">
                                {org.name}
                              </Badge>
                            ))}
                            {u.organizations.length > 3 && (
                              <Badge variant="secondary" className="text-xs">
                                +{u.organizations.length - 3}
                              </Badge>
                            )}
                          </div>
                        )}
                        <span className="sr-only">{u.organizationCount} organizations</span>
                      </td>
                      <td className="hidden px-4 py-3 text-xs text-muted-foreground md:table-cell">{formatDate(u.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

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
          <span className="text-sm text-muted-foreground">
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
