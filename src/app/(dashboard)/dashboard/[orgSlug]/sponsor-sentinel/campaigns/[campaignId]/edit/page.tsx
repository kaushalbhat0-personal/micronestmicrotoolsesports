import { redirect } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { createClient } from "@/lib/supabase/server";
import { getCampaign } from "@/features/sponsor-sentinel/services/campaign-service";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { CampaignEditForm } from "@/features/sponsor-sentinel/components/campaign-edit-form";
import type { Route } from "next";

export default async function EditCampaignPage({ params }: { params: Promise<{ orgSlug: string; campaignId: string }> }) {
  const { orgSlug, campaignId } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  await requireEntitlement(ctx.organization.id, "sponsor-sentinel");
  const supabase = await createClient();
  const campaign = await getCampaign(supabase, ctx.organization.id, campaignId);

  // Only drafts are editable — server enforces on save; redirect early for
  // non-drafts so the edit UI is never presented for locked campaigns.
  if (campaign.status !== "draft") {
    redirect(`/dashboard/${orgSlug}/sponsor-sentinel/campaigns/${campaignId}` as never);
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Edit campaign" description={`Edit draft campaign ${campaign.name} for ${ctx.organization.name}`} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campaign details</CardTitle>
          <CardDescription>Name, description and active window. Changes apply to this draft only.</CardDescription>
        </CardHeader>
        <CardContent>
          <CampaignEditForm
            orgSlug={orgSlug}
            campaignId={campaignId}
            initial={{ name: campaign.name, description: campaign.description, starts_at: campaign.starts_at, ends_at: campaign.ends_at }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
