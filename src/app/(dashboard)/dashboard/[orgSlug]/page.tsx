import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { getAccessibleToolSlugs } from "@/lib/auth/require-entitlement";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Route } from "next";
import { TOOLS } from "@/config/app/tools";

// Orchestration-only: resolve context → render.
export default async function OrgDashboardPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  const accessibleSlugs = await getAccessibleToolSlugs(ctx.organization.id).catch(() => [] as string[]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={ctx.organization.name}
        description={`Organization dashboard — role: ${ctx.membership.role} • slug: ${ctx.organization.slug}`}
        action={
          <Link href={`/dashboard/${orgSlug}/sponsor-sentinel` as Route} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground">
            Open Sponsor Sentinel
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Organization</CardTitle>
          <CardDescription>ID {ctx.organization.id}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Role:</span>
            <Badge variant="secondary">{ctx.membership.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold">Tools for this organization</h2>
        <p className="text-sm text-muted-foreground">Entitlement is checked per-tool; all-access grants everything.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {TOOLS.map((t) => {
            const href = `/dashboard/${orgSlug}/${t.slug}` as Route;
            const hasAccess = accessibleSlugs.includes(t.slug);
            const badge = t.comingSoon ? (
              <Badge variant="secondary">Soon</Badge>
            ) : hasAccess ? (
              <Badge variant="success">Available</Badge>
            ) : (
              <Badge variant="secondary">Requires access</Badge>
            );
            return (
              <Card key={t.slug}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center justify-between">
                    {t.name}
                    {badge}
                  </CardTitle>
                  <CardDescription>{t.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {t.comingSoon ? (
                    <Button size="sm" variant="secondary" disabled>
                      Coming soon
                    </Button>
                  ) : hasAccess ? (
                    <Link href={href} className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
                      Open
                    </Link>
                  ) : (
                    <Button size="sm" variant="secondary" disabled>
                      Requires access
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
