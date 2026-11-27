import Link from "next/link";
import type { Route } from "next";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { ClaimFreePayoutTrackerCard } from "@/features/payout-tracker/components/claim-free-card";
import { TrackerList } from "@/features/payout-tracker/components/tracker-list";
import { listTrackers } from "@/features/payout-tracker/services/tracker-service";
import { createClient } from "@/lib/supabase/server";
import { PAYOUT_TRACKER_TOOL_SLUG } from "@/features/payout-tracker/tool-slug";

export const metadata = {
  title: "Prize Payout Tracker — MicroNest",
  description: "Publish a public, organizer-reported record of tournament prize payouts.",
  robots: { index: false, follow: false },
};

export default async function PayoutTrackerPage({ params }: { params: Promise<{ orgSlug: string }> }) {
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
  const { summaries } = await listTrackers(supabase, ctx.organization.id);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prize Payout Tracker"
        description={`Publish a public payout list for ${ctx.organization.name} — who's paid, what's pending, and the deadline.`}
        action={
          <Link
            href={`/dashboard/${orgSlug}/payout-tracker/new` as Route}
            className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)]"
          >
            New tracker
          </Link>
        }
      />
      <TrackerList orgSlug={orgSlug} summaries={summaries} />
    </div>
  );
}
