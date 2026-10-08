import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { createClient } from "@/lib/supabase/server";
import { getBillingOverview, getBillingToolSections } from "@/server/services/billing-service";
import { PageHeader } from "@/components/ui/page-header";
import { BillingClient } from "@/features/billing/components/billing-client";
import { TOOLS } from "@/config/app/tools";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return {
    title: "Billing — MicroNest",
    description: "Manage billing, access and renewal for your workspace.",
    robots: { index: false, follow: false },
  };
}

export default async function BillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams?: Promise<{ plan?: string }>;
}) {
  const { orgSlug } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const hintedPlanSlug = sp?.plan ?? null;
  const ctx = await requireOrganizationContext(orgSlug);
  const supabase = await createClient();
  const overview = await getBillingOverview(supabase, ctx.organization.id);
  const sections = await getBillingToolSections(supabase, ctx.organization.id);

  // Enrich entitlements with tool metadata for display
  const toolMap = new Map(TOOLS.map((t) => [t.slug, t]));
  const enriched = overview.entitlements.map((e) => {
    if (e.isAllAccess) return { ...e, displayName: "All Access", description: "All currently available tools" };
    const cfg = e.toolSlug ? toolMap.get(e.toolSlug) : undefined;
    return { ...e, displayName: cfg?.name ?? e.toolName, description: cfg?.description ?? "" };
  });

  return (
    <div className="space-y-8">
      <PageHeader
        title="Billing"
        description={`Subscription software billing and workspace access for ${ctx.organization.name} — digital service, billed per workspace.`}
      />
      <BillingClient
        organizationId={ctx.organization.id}
        organizationSlug={orgSlug}
        organizationName={ctx.organization.name}
        entitlements={enriched}
        yourTools={sections.yourTools}
        availableToAdd={sections.availableToAdd}
        plans={overview.plans}
        history={overview.history}
        currentPlan={overview.currentPlan}
        hintedPlanSlug={hintedPlanSlug}
      />
    </div>
  );
}
