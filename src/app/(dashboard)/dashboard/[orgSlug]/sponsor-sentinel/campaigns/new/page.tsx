import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CampaignCreateForm } from "@/features/sponsor-sentinel/components/campaign-create-form";

export default async function NewCampaignPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");

  return (
    <div className="space-y-6">
      <PageHeader title="Create campaign" description={`Create a sponsor campaign for ${ctx.organization.name}`} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign details</CardTitle>
          <CardDescription>Name, description and active window.</CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignCreateForm orgSlug={orgSlug} />
        </CardContent>
      </Card>
    </div>
  );
}
