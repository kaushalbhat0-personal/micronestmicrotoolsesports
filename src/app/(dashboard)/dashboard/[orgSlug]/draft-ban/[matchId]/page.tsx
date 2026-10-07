import { notFound } from "next/navigation";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { DraftWorkspace } from "@/features/draft-ban/components/draft-workspace";
import { ResultCard } from "@/features/draft-ban/components/result-card";
import { findOrganizationById } from "@/server/repositories/organizations";
import { getMatch } from "@/features/draft-ban/services/match-service";

export const metadata = {
  title: "Draft — Draft & Ban",
  description: "Run and record a match draft.",
};

export default async function DraftBanMatchPage({ params }: { params: Promise<{ orgSlug: string; matchId: string }> }) {
  const { orgSlug, matchId } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "draft-ban");
  } catch (e) {
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }
  const supabase = await createClient();
  const match = await getMatch(supabase, ctx.organization.id, matchId).catch(() => null);
  if (!match) notFound();
  const org = await findOrganizationById(supabase, ctx.organization.id).catch(() => null);

  const title = match.match_name ?? `${match.team_a} vs ${match.team_b}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={`${match.ref_code}${match.event_name ? ` · ${match.event_name}` : ""}${match.format_label ? ` · ${match.format_label}` : ""}`}
        action={<Badge variant={match.status === "completed" ? "success" : match.status === "abandoned" ? "secondary" : "warning"}>{match.status === "completed" ? "Completed" : match.status === "abandoned" ? "Abandoned" : "In progress"}</Badge>}
      />
      {match.status === "completed" ? (
        <ResultCard
          match={match}
          organizationName={ctx.organization.name}
          organizationLogoUrl={(org as { logo_url?: string | null } | null)?.logo_url ?? null}
          shareUrl={`/share/draft-ban/${match.share_token}`}
          showNotes
        />
      ) : (
        <DraftWorkspace orgSlug={orgSlug} match={match} />
      )}
    </div>
  );
}
