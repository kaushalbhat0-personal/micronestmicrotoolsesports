import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { PageHeader } from "@/components/ui/page-header";
import { CompetitionSetupForm } from "@/features/tie-breaker/components/competition-setup-form";
import { ROUND_ROBIN_ORDER } from "@/features/tie-breaker/presets";

export const metadata = {
  title: "New competition — Tie-Breaker",
  description: "Start a new tied-standings competition.",
};

export default async function TieBreakerNewPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "tie-breaker");
  } catch (e) {
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="New competition"
        description="Set your rules first — you can still adjust everything until you lock the result."
      />
      <CompetitionSetupForm
        orgSlug={orgSlug}
        mode="create"
        initial={{
          name: "",
          description: "",
          preset: "round_robin",
          win: 3,
          draw: 1,
          loss: 0,
          allowDraws: false,
          roundLabel: "rounds",
          ruleOrder: [...ROUND_ROBIN_ORDER],
        }}
      />
    </div>
  );
}
