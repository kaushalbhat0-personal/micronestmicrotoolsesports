import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { listPlatformAdmins } from "@/server/admin/platform-admins";
import { searchCustomers } from "@/server/admin/customers";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { GrantAdminForm, RevokeAdminButton } from "@/components/admin/PlatformAdminForms";
import { Search, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function PlatformAdminsPage({
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

  const [{ admins, error }, search] = await Promise.all([listPlatformAdmins(), searchCustomers(q)]);
  const isLastAdmin = admins.length <= 1;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Platform Admins</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Membership management — no raw SQL. Grants and revocations require a reason and are audited.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" aria-hidden /> Current admins ({admins.length})
          </CardTitle>
          <CardDescription>User and profile information, granted_at, granted_by, reason.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {error ? (
            <p className="p-4 text-sm text-destructive">{error}</p>
          ) : admins.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No platform admins found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">Platform admins</caption>
                <thead>
                  <tr className="border-y border-border bg-surface-muted/40 text-left">
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Admin</th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Granted</th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Reason</th>
                    <th scope="col" className="px-4 py-2.5 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {admins.map((a) => (
                    <tr key={a.userId} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3">
                        <p className="font-medium">{a.email ?? "Unknown email"}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.displayName ?? ""} · <span className="font-mono">{a.userId.slice(0, 8)}…</span>
                        </p>
                        {a.grantedByEmail && <p className="text-xs text-muted-foreground">by {a.grantedByEmail}</p>}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(a.grantedAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{a.reason ?? "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {isLastAdmin ? (
                          <Badge variant="secondary" title="Another admin must exist before the final admin can be revoked">
                            Final admin — protected
                          </Badge>
                        ) : (
                          <RevokeAdminButton userId={a.userId} email={a.email} />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {isLastAdmin && admins.length > 0 && (
            <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
              Lockout protection is server-side: revocation of the final admin is rejected. Grant another admin first.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Grant platform admin</CardTitle>
          <CardDescription>Select an eligible existing user — enter their profile ID (find it via Users or Customers search). Explicit confirmation and reason required. Idempotent.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form method="GET" className="flex flex-col gap-3 sm:flex-row sm:items-end" role="search" aria-label="Find eligible user">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="q" className="text-xs font-medium">
                Find user by email
              </Label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                <Input id="q" name="q" defaultValue={search.query} placeholder="user email" maxLength={100} className="pl-9" aria-label="Find user by email" />
              </div>
            </div>
            <Button type="submit" variant="outline" className="min-h-[44px]">
              Find
            </Button>
          </form>
          {q && (
            <div>
              {search.items.filter((i) => i.kind === "user").length === 0 ? (
                <p className="text-sm text-muted-foreground">No users match “{search.query}”.</p>
              ) : (
                <ul className="divide-y divide-border rounded-[12px] border border-border">
                  {search.items
                    .filter((i) => i.kind === "user")
                    .map((i, idx) => (
                      <li key={`${i.userId}-${idx}`} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                        <div className="min-w-0">
                          <p className="font-medium">{i.userEmail ?? "Unknown"}</p>
                          <p className="font-mono text-xs text-muted-foreground">{i.userId}</p>
                        </div>
                        <Badge variant="secondary">eligible</Badge>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          )}
          <GrantAdminForm />
        </CardContent>
      </Card>
    </div>
  );
}
