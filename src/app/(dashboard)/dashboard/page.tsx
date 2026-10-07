import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TOOLS } from "@/config/app/tools";
import { getUserOrganizations } from "@/lib/auth/require-membership";
import { getCurrentUser } from "@/lib/auth/get-user";
import { createClient } from "@/lib/supabase/server";
import { getPlanContext } from "@/server/billing/plan-context";
import { formatPlanPrice, getPurchaseGuide, periodLabel } from "@/lib/purchase/plan-guidance";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2, ArrowRight } from "lucide-react";

// Route page orchestrates — obtains context via lib/auth, delegates to services, renders UI.
export default async function DashboardPage({ searchParams }: { searchParams?: Promise<{ plan?: string }> }) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  const sp = searchParams ? await searchParams : undefined;
  const plan = await getPlanContext(supabase, sp?.plan);
  const guide = getPurchaseGuide(plan?.slug);

  let orgs: Awaited<ReturnType<typeof getUserOrganizations>> = [];
  try {
    orgs = await getUserOrganizations();
  } catch {
    orgs = [];
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome${user?.email ? `, ${user.email}` : ""}`}
        description="Your esports command center. Select a tool or manage your workspaces."
        action={
          <Link href={plan ? `/dashboard/organizations/new?plan=${plan.slug}` : "/dashboard/organizations/new"} className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Create workspace
          </Link>
        }
      />

      {plan && guide ? (
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="text-base">Continue getting {guide.toolName}</CardTitle>
            <CardDescription>
              {plan.name} · {formatPlanPrice(plan.amountMinor, plan.currency)} / {periodLabel(plan.billingPeriod)} · Manual renewal, no automatic charge. Create a
              workspace to continue — you&apos;ll pay in Billing.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/organizations/new?plan=${plan.slug}`}
              className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Create workspace and continue <ArrowRight className="ml-2 h-4 w-4" aria-hidden />
            </Link>
          </CardContent>
        </Card>
      ) : null}

      {orgs.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No workspace yet"
          description="Create a workspace to unlock tools and subscriptions. You can join multiple workspaces from one account."
          action={
            <Link href={plan ? `/dashboard/organizations/new?plan=${plan.slug}` : "/dashboard/organizations/new"} className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)]">
              Create workspace
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your workspaces</CardTitle>
            <CardDescription>{orgs.length} workspace(s) — switch context to access tools per workspace.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {orgs.map((m) => {
                // Supabase join may return object or array depending on typegen; handle both
                const raw = m.organization as unknown as { id: string; name: string; slug: string } | { id: string; name: string; slug: string }[] | null;
                const org = Array.isArray(raw) ? raw[0] : raw;
                if (!org) return null;
                return (
                          <li key={org.id} className="flex items-center justify-between rounded-[12px] border border-border bg-surface-muted/40 px-4 py-3">
                    <span className="text-sm font-medium">{org.name}</span>
                    <Badge variant="secondary">{m.role}</Badge>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="font-display text-xl font-normal tracking-tight">Tools</h2>
        <p className="mt-1 text-sm text-muted-foreground">Available now, plus what&apos;s coming soon — upcoming tools stay disabled until release.</p>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t, idx) => (
            <Card
              key={t.slug}
              className={`nest-reveal nest-reveal-delay-${Math.min(idx, 4)} ${!t.comingSoon ? "transition-transform duration-[180ms] hover:scale-[1.01] hover:border-border-strong hover:shadow-sm" : ""}`}
              style={{ animationDelay: `${idx * 60}ms` } as React.CSSProperties}
            >
              <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                  {t.name}
                  {t.comingSoon ? <Badge variant="secondary">Soon</Badge> : <Badge variant="success">Available</Badge>}
                </CardTitle>
                <CardDescription>{t.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {t.comingSoon ? (
                  <Button size="sm" variant="secondary" disabled>
                    Coming soon
                  </Button>
                ) : (
                  <Link href="/dashboard/organizations" className="inline-flex h-8 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors duration-[180ms]">
                    Select organization
                  </Link>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
