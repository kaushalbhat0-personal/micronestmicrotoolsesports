import { notFound } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { ClaimFreePayoutTrackerCard } from "@/features/payout-tracker/components/claim-free-card";
import { TrackerDetail } from "@/features/payout-tracker/components/tracker-detail";
import { getTrackerDetail } from "@/features/payout-tracker/services/tracker-service";
import { createClient } from "@/lib/supabase/server";
import { recipientsMaxForLevel, resolvePayoutTrackerAccessLevel } from "@/server/services/payout-tracker-policy";
import { PAYOUT_TRACKER_TOOL_SLUG } from "@/features/payout-tracker/tool-slug";

export const metadata = {
  title: "Payout tracker — MicroNest",
  description: "Manage recipients, mark payouts, and share the public payout page.",
  robots: { index: false, follow: false },
};

export default async function PayoutTrackerDetailPage({
  params,
}: {
  params: Promise<{ orgSlug: string; trackerId: string }>;
}) {
  const { orgSlug, trackerId } = await params;
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
  let detail;
  try {
    detail = await getTrackerDetail(supabase, ctx.organization.id, trackerId);
  } catch {
    notFound();
  }
  const level = await resolvePayoutTrackerAccessLevel(supabase, { organizationId: ctx.organization.id });

  return (
    <div className="space-y-6">
      <PageHeader
        title={detail.tracker.event_name}
        description={`${detail.tracker.currency} · ${detail.tracker.status} · ${ctx.organization.name}`}
      />
      <TrackerDetail orgSlug={orgSlug} detail={detail} recipientCap={recipientsMaxForLevel(level)} />
    </div>
  );
}
