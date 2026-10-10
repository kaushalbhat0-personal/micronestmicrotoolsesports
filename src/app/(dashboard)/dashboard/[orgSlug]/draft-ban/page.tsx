import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { TemplatePicker } from "@/features/draft-ban/components/template-picker";
import { ClaimFreeDraftBanCard } from "@/features/draft-ban/components/claim-free-card";
import { TemplateManager } from "@/features/draft-ban/components/template-manager";
import { MatchHistoryList } from "@/features/draft-ban/components/match-history-list";
import { OrgBrandingCard } from "@/features/draft-ban/components/org-branding-card";
import { findOrganizationById } from "@/server/repositories/organizations";
import { ensureStarterTemplate, getCustomTemplateUsage } from "@/features/draft-ban/services/template-service";
import { freeDraftBanCustomTemplatesMax } from "@/server/services/draft-ban-policy";
import { TEMPLATES_PER_ORG_MAX } from "@/features/draft-ban/schemas/draft-config";
import { getHistory } from "@/features/draft-ban/services/match-service";
import { resolveDraftBanAccessLevel } from "@/server/services/draft-ban-policy";

export const metadata = {
  title: "Draft & Ban — MicroNest",
  description: "Professional match draft room. Run vetoes, lock official records, and share them.",
};

export default async function DraftBanPage({ params }: { params: Promise<{ orgSlug: string }> }) {
  const { orgSlug } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "draft-ban");
  } catch (e) {
    if (isEntitlementDenied(e)) {
      return (
        <div className="space-y-6">
          <AccessDenied orgSlug={orgSlug} />
          <ClaimFreeDraftBanCard orgSlug={orgSlug} />
        </div>
      );
    }
    throw e;
  }
  const supabase = await createClient();

  await ensureStarterTemplate(supabase, ctx.organization.id, ctx.user.id).catch(() => []);
  const accessLevel = await resolveDraftBanAccessLevel(supabase, { organizationId: ctx.organization.id }).catch(
    () => "paid" as const,
  );
  const [usage, history, org] = await Promise.all([
    getCustomTemplateUsage(supabase, ctx.organization.id).catch(() => null),
    getHistory(supabase, ctx.organization.id, {}, accessLevel === "free" ? "free" : "paid").catch(() => ({
      matches: [],
      total: 0,
      completedTotal: 0,
    })),
    findOrganizationById(supabase, ctx.organization.id).catch(() => null),
  ]);
  const templates = usage?.templates ?? [];
  const customUsed = usage?.customCount ?? 0;
  const customMax = usage?.customMax ?? (accessLevel === "free" ? freeDraftBanCustomTemplatesMax() : TEMPLATES_PER_ORG_MAX);
  const canCreate = usage?.canCreate ?? customUsed < customMax;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draft & Ban"
        description={`Professional match draft room — ${ctx.organization.name}. One screen. One sequence. Zero disputes.`}
      />
      <TemplatePicker orgSlug={orgSlug} templates={templates} />
      <section className="space-y-4">
        <SectionHeader title="Recent drafts" description="Official records first — resume incomplete drafts any time. Replaying a fixture? Use Run Again from history — teams and pool carry over." />
        <MatchHistoryList
          orgSlug={orgSlug}
          matches={history.matches}
          total={history.total}
          completedTotal={history.completedTotal}
          accessLevel={accessLevel === "free" ? "free" : "paid"}
        />
      </section>
      <TemplateManager
        orgSlug={orgSlug}
        templates={templates}
        customUsed={customUsed}
        customMax={customMax}
        accessLevel={accessLevel === "free" ? "free" : "paid"}
        canCreate={canCreate}
      />
      <OrgBrandingCard
        orgSlug={orgSlug}
        orgName={ctx.organization.name}
        logoUrl={(org as { logo_url?: string | null } | null)?.logo_url ?? null}
        canManage={ctx.membership.role === "owner" || ctx.membership.role === "admin"}
        brandingEnabled={accessLevel === "paid"}
      />
    </div>
  );
}
