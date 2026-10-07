import { requireSuperAdmin } from "@/lib/auth/require-super-admin";
import { getAdminOverview } from "@/server/admin/overview";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building2, Users, KeyRound, Receipt, CreditCard, AlertTriangle, ScrollText, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default async function AdminOverviewPage() {
  await requireSuperAdmin();

  const data = await getAdminOverview();

  const stats = [
    {
      label: "Organizations",
      value: data.organizations.count,
      description: "Total organizations on the platform.",
      icon: Building2,
      error: data.organizations.error,
    },
    {
      label: "Users",
      value: data.users.count,
      description: "Registered platform users.",
      icon: Users,
      error: data.users.error,
    },
    {
      label: "Active Entitlements",
      value: data.activeEntitlements.count,
      description: "Currently active tool / All Access entitlements.",
      icon: KeyRound,
      error: data.activeEntitlements.error,
    },
    {
      label: "Paid Orders",
      value: data.paidOrders.count,
      description: "Orders recorded as paid.",
      icon: Receipt,
      error: data.paidOrders.error,
    },
    {
      label: "Payments",
      value: data.payments.count,
      description: "Recorded payment records.",
      icon: CreditCard,
      error: data.payments.error,
    },
    {
      label: "Failed Sentinel Scans",
      value: data.failedScans.count,
      description: "Scans currently recorded with failed status.",
      icon: AlertTriangle,
      error: data.failedScans.error,
    },
  ];

  const attention: string[] = [];
  if (data.failedScans.count !== null && data.failedScans.count > 0) {
    attention.push(`${data.failedScans.count} failed Sentinel scan${data.failedScans.count === 1 ? "" : "s"} require attention.`);
  }
  if (data.recentActivity && data.recentActivity.length === 0) {
    attention.push("No admin activity yet — expected immediately after foundation deployment.");
  }
  if (data.recentActivity === null && data.recentActivityError) {
    attention.push("Recent audit activity unavailable.");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-normal tracking-tight">Platform Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">Read-only operational snapshot — platform-level administration.</p>
      </div>

      {/* Metrics */}
      <section aria-labelledby="metrics-heading">
        <h2 id="metrics-heading" className="sr-only">
          Platform metrics
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <AdminStatCard key={s.label} label={s.label} value={s.value} description={s.description} icon={s.icon} error={s.error} />
          ))}
        </div>
      </section>

      {/* Secondary */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Platform snapshot */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Platform Snapshot</CardTitle>
            <CardDescription>Counts from authoritative tables.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Organizations</dt>
                <dd className="font-medium tabular-nums">
                  {data.organizations.error ? "Unavailable" : data.organizations.count !== null ? new Intl.NumberFormat("en-IN").format(data.organizations.count) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Users</dt>
                <dd className="font-medium tabular-nums">
                  {data.users.error ? "Unavailable" : data.users.count !== null ? new Intl.NumberFormat("en-IN").format(data.users.count) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Active entitlements</dt>
                <dd className="font-medium tabular-nums">
                  {data.activeEntitlements.error ? "Unavailable" : data.activeEntitlements.count !== null ? new Intl.NumberFormat("en-IN").format(data.activeEntitlements.count) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Paid orders</dt>
                <dd className="font-medium tabular-nums">
                  {data.paidOrders.error ? "Unavailable" : data.paidOrders.count !== null ? new Intl.NumberFormat("en-IN").format(data.paidOrders.count) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Payments</dt>
                <dd className="font-medium tabular-nums">
                  {data.payments.error ? "Unavailable" : data.payments.count !== null ? new Intl.NumberFormat("en-IN").format(data.payments.count) : "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Failed scans</dt>
                <dd className={`font-medium tabular-nums ${data.failedScans.count !== null && data.failedScans.count > 0 ? "text-destructive" : ""}`}>
                  {data.failedScans.error ? "Unavailable" : data.failedScans.count !== null ? new Intl.NumberFormat("en-IN").format(data.failedScans.count) : "—"}
                </dd>
              </div>
            </dl>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">NULL `expires_at` is preserved as permanent — active count includes permanent entitlements.</p>
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <ScrollText className="h-4 w-4 text-muted-foreground" aria-hidden /> Recent Admin Activity
            </CardTitle>
            <CardDescription>Latest 10 audit entries — read-only verification that RLS + Super Admin guard work.</CardDescription>
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
                        {entry.organization_id && <span className="text-xs text-muted-foreground truncate">· {entry.organization_id.slice(0, 8)}…</span>}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" aria-hidden /> {formatDate(entry.created_at)}
                        {entry.reason && <span className="truncate">· {entry.reason.slice(0, 80)}</span>}
                      </p>
                    </div>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground" aria-label="actor">
                      {entry.actor_user_id.slice(0, 8)}…
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 text-xs text-muted-foreground">Audit log shows action, target, actor, organization, reason, timestamp only — no before/after JSON, IP, secrets.</p>
          </CardContent>
        </Card>
      </div>

      {/* Operational attention */}
      {attention.length > 0 && (
        <Card variant="muted">
          <CardHeader>
            <CardTitle className="text-sm">Operational Attention</CardTitle>
            <CardDescription>Simple signals — no complex alert engine.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {attention.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
