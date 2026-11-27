import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { ClaimFreePayoutTrackerCard } from "@/features/payout-tracker/components/claim-free-card";
import { TrackerForm } from "@/features/payout-tracker/components/tracker-form";
import { createClient } from "@/lib/supabase/server";
import { recipientsMaxForLevel, resolvePayoutTrackerAccessLevel } from "@/server/services/payout-tracker-policy";
import { PAYOUT_TRACKER_TOOL_SLUG } from "@/features/payout-tracker/tool-slug";

export const metadata = {
  title: "New payout tracker — MicroNest",
  description: "Create a payout tracker with recipients and amounts.",
  robots: { index: false, follow: false },
};

export default async function NewPayoutTrackerPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, PAYOUT_TRACKER_TOOL_SLUG);
  } catch (e) {
    if (isEntitlementDenied(e)) {
      return (
        <div className="space-y-6">
          <AccessDenied orgSlug={orgSlug} />
          <ClaimFreePayoutTrackerCard orgSlug={orgSlug} />
        </div>
      );
    }
    throw e;
  }

  const supabase = await createClient();
  const level = await resolvePayoutTrackerAccessLevel(supabase, { organizationId: ctx.organization.id });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New payout tracker"
        description="Enter the event, the recipients, and what each should receive. You can publish the public page when ready."
      />
      <TrackerForm orgSlug={orgSlug} recipientCap={recipientsMaxForLevel(level)} />
    </div>
  );
}
