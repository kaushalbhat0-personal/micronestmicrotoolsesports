import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { PrizeSplitterCalculator } from "@/features/prize-splitter/components/prize-splitter-calculator";

export const metadata = {
  title: "Prize Pool Splitter — MicroNest",
  description: "Split a tournament prize pool in seconds. Choose percentage, equal, ranked or custom distribution and get exact reconciled payouts.",
};

export default async function PrizeSplitterPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "prize-splitter");
  } catch (e) {
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prize Pool Splitter"
        description={`Split a tournament prize pool in seconds — ${ctx.organization.name}. Deterministic payouts, reconciled to the last cent.`}
      />
      <PrizeSplitterCalculator />
    </div>
  );
}
