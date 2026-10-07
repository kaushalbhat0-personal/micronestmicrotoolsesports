import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { TemplatePicker } from "@/features/draft-ban/components/template-picker";
import { TemplateManager } from "@/features/draft-ban/components/template-manager";
import { MatchHistoryList } from "@/features/draft-ban/components/match-history-list";
import { OrgBrandingCard } from "@/features/draft-ban/components/org-branding-card";
import { findOrganizationById } from "@/server/repositories/organizations";
import { ensureStarterTemplate, listTemplates } from "@/features/draft-ban/services/template-service";
import { listMatches } from "@/features/draft-ban/services/match-service";

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
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }
  const supabase = await createClient();

  await ensureStarterTemplate(supabase, ctx.organization.id, ctx.user.id).catch(() => []);
  const [templates, history, org] = await Promise.all([
    listTemplates(supabase, ctx.organization.id).catch(() => []),
    listMatches(supabase, ctx.organization.id, 50).catch(() => ({ matches: [], total: 0 })),
    findOrganizationById(supabase, ctx.organization.id).catch(() => null),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Draft & Ban"
        description={`Professional match draft room — ${ctx.organization.name}. One screen. One sequence. Zero disputes.`}
      />
      <TemplatePicker orgSlug={orgSlug} templates={templates} />
      <section className="space-y-4">
        <SectionHeader title="Recent drafts" description="Official records first — resume incomplete drafts any time. Replaying a fixture? Use Run Again from history — teams and pool carry over." />
        <MatchHistoryList orgSlug={orgSlug} matches={history.matches} total={history.total} />
      </section>
      <TemplateManager orgSlug={orgSlug} templates={templates} canCreate={templates.length < 20} />
      <OrgBrandingCard
        orgSlug={orgSlug}
        orgName={ctx.organization.name}
        logoUrl={(org as { logo_url?: string | null } | null)?.logo_url ?? null}
        canManage={ctx.membership.role === "owner" || ctx.membership.role === "admin"}
      />
    </div>
  );
}
