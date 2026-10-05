import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { TOOLS } from "@/config/app/tools";
import { getUserOrganizations } from "@/lib/auth/require-membership";
import { getCurrentUser } from "@/lib/auth/get-user";
import { EmptyState } from "@/components/ui/empty-state";
import { Building2 } from "lucide-react";

// Route page orchestrates — obtains context via lib/auth, delegates to services, renders UI.
export default async function DashboardPage() {
  const user = await getCurrentUser();

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
        description="Your esports command center. Select a tool or manage your organizations."
        action={
          <Link href="/dashboard/organizations/new" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            Create organization
          </Link>
        }
      />

      {orgs.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-8 w-8" />}
          title="No organization yet"
          description="Create an organization to unlock tools and subscriptions. You can join multiple orgs from one account."
          action={
            <Link href="/dashboard/organizations/new" className="inline-flex h-9 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)]">
              Create organization
            </Link>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your organizations</CardTitle>
            <CardDescription>{orgs.length} organization(s) — switch context to access tools per org.</CardDescription>
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
        <h2 className="font-display text-xl font-normal tracking-tight">Available tools</h2>
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
