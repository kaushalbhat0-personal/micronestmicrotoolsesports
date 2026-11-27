import { notFound } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { MatchSetupForm } from "@/features/draft-ban/components/match-setup-form";
import { listTemplates } from "@/features/draft-ban/services/template-service";
import { standardVetoTemplate, STANDARD_VETO_NAME, STANDARD_VETO_DESCRIPTION } from "@/features/draft-ban/services/presets";

export const metadata = {
  title: "New draft — Draft & Ban",
  description: "Create a match draft from a template.",
};

export default async function NewDraftBanPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgSlug: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const { orgSlug } = await params;
  const { template } = await searchParams;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "draft-ban");
  } catch (e) {
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }
  const supabase = await createClient();
  const templates = await listTemplates(supabase, ctx.organization.id).catch(() => []);
  const selected = template ? templates.find((t) => t.id === template) : undefined;
  if (template && !selected) notFound();

  const fallback = standardVetoTemplate();
  const config = selected?.config ?? { sequence: [...fallback.sequence], pool: [], teamA: null, teamB: null };
  const templateName = selected?.name ?? STANDARD_VETO_NAME;

  return (
    <div className="space-y-6">
      <PageHeader title="New draft" description={selected ? `From draft setup “${templateName}”.` : `${STANDARD_VETO_NAME} — ${STANDARD_VETO_DESCRIPTION}`} />
      <MatchSetupForm
        orgSlug={orgSlug}
        templateId={selected?.id ?? null}
        templateName={templateName}
        sequence={config.sequence}
        defaultTeamA={config.teamA ?? ""}
        defaultTeamB={config.teamB ?? ""}
        defaultPool={config.pool}
      />
    </div>
  );
}
