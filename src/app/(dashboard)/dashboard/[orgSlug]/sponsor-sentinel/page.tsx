import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import type { Route } from "next";

export default async function SponsorSentinelPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sponsorship Tracking"
        description={`Proof-of-performance for sponsors — ${ctx.organization.name}`}
      />
      <Card className="border-l-2 border-l-primary">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Sponsorship Proof Tracking <Badge variant="success">Available</Badge>
          </CardTitle>
          <CardDescription>Track what creators need to deliver and review proof when checks are completed.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Create campaigns, connect creator channels, and review proof of delivery for your sponsors.
          </p>
          <div className="flex gap-2">
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/campaigns` as Route}>
              <Button size="sm" aria-label="View campaigns">
                View campaigns
              </Button>
            </Link>
            <Link href={`/dashboard/${orgSlug}/sponsor-sentinel/scans` as Route}>
              <Button variant="outline" size="sm" aria-label="View check history">
                View check history
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
