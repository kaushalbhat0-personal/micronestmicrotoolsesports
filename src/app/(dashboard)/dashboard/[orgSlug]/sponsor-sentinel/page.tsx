import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Route } from "next";

// Stub — demonstrates canonical org context + entitlement pattern, no business logic.
export default async function SponsorSentinelPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sponsor Sentinel"
        description={`Proof-of-performance for sponsors — organization: ${ctx.organization.name} (${ctx.membership.role})`}
      />
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            Sponsor Sentinel <Badge variant="success">Authorized</Badge>
          </CardTitle>
          <CardDescription>
            This is a routing/authorization stub. Future feature code will live in <code>src/features/sponsor-sentinel/</code> and be invoked here via{" "}
            <code>requireOrganizationContext</code> → <code>requireEntitlement</code> → service → repository.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Canonical flow verified: URL slug <code>{orgSlug}</code> → membership <code>{ctx.membership.role}</code> → entitlement for <code>sponsor-sentinel</code> → render.
          </p>
          <div className="flex gap-2">
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
              <Button size="sm" aria-label="View campaigns">
                View campaigns
              </Button>
            </Link>
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route}>
              <Button variant="outline" size="sm" aria-label="View scan history">
                View scan history
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
