import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { RosterBuilderWorkspace } from "@/features/roster-builder/components/roster-builder-workspace";
import { ClaimFreeRosterBuilderCard } from "@/features/roster-builder/components/claim-free-card";

export const metadata = {
  title: "Tournament Roster & Slot Builder — MicroNest",
  description: "Paste messy tournament registrations, catch duplicate players and multi-team conflicts, assign slots, and copy a clean roster in seconds.",
};

export default async function RosterBuilderPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "roster-builder");
  } catch (e) {
    if (isEntitlementDenied(e)) {
      return (
        <div className="space-y-6">
          <AccessDenied orgSlug={orgSlug} />
          <ClaimFreeRosterBuilderCard orgSlug={orgSlug} />
        </div>
      );
    }
    throw e;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tournament Roster & Slot Builder"
        description={`Paste messy registrations → clean duplicates → assign slots → copy the final list. ${ctx.organization.name}. Nothing is saved — copy, print, or export when done.`}
      />
      <RosterBuilderWorkspace />
    </div>
  );
}
