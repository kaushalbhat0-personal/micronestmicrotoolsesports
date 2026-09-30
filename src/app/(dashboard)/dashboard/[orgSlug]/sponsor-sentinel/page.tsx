import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Canonical flow verified: URL slug <code>{orgSlug}</code> → membership <code>{ctx.membership.role}</code> → entitlement for <code>sponsor-sentinel</code> → render.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
