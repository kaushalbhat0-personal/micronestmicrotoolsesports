import Link from "next/link";
import type { Route } from "next";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireOrganizationContext } from "@/lib/auth/organization-context";
import { requireEntitlement } from "@/lib/auth/require-entitlement";
import { isEntitlementDenied } from "@/lib/errors";
import { AccessDenied } from "@/components/shared/access-denied";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { SectionHeader } from "@/components/ui/section-header";
import { getCompetition } from "@/features/tie-breaker/services/competition";
import { listTeams } from "@/features/tie-breaker/services/teams";
import { listResults } from "@/features/tie-breaker/services/results";
import { getStandings } from "@/features/tie-breaker/services/standings";
import { LockDialog } from "@/features/tie-breaker/components/lock-dialog";
import { ReviewChecklist } from "@/features/tie-breaker/components/review-checklist";
import { StandingsView } from "@/features/tie-breaker/components/standings-view";
import type { RuleId, StandingsResult } from "@/features/tie-breaker/types";

export const metadata = {
  title: "Review — Tie-Breaker",
  description: "Review standings and lock the official result.",
};

export default async function TieBreakerReviewPage({
  params,
}: {
  params: Promise<{ orgSlug: string; competitionId: string }>;
}) {
  const { orgSlug, competitionId } = await params;
  const ctx = await requireOrganizationContext(orgSlug);
  try {
    await requireEntitlement(ctx.organization.id, "tie-breaker");
  } catch (e) {
    if (isEntitlementDenied(e)) return <AccessDenied orgSlug={orgSlug} />;
    throw e;
  }
  const supabase = await createClient();
  const competition = await getCompetition(supabase, ctx.organization.id, competitionId).catch(() => null);
  if (!competition) notFound();
  if (competition.status === "locked") {
    redirect(`/dashboard/${orgSlug}/tie-breaker/${competition.id}` as Route);
  }

  const [teams, listed] = await Promise.all([
    listTeams(supabase, ctx.organization.id, competition.id).catch(() => []),
    listResults(supabase, ctx.organization.id, competition.id).catch(() => ({ results: [], duplicatePairIds: [] })),
  ]);
  const teamNames: Record<string, string> = {};
  for (const t of teams) teamNames[t.id] = t.name;

  let standings: StandingsResult | null = null;
  if (teams.length >= 2) {
    try {
      ({ standings } = await getStandings(supabase, ctx.organization.id, competition.id));
    } catch {
      standings = null;
    }
  }

  const completeCount = listed.results.filter((r) => r.is_complete).length;
  const incompleteCount = listed.results.length - completeCount;
  const unresolvedCount = standings?.tieGroups.length ?? 0;

  const blockers: string[] = [];
  if (teams.length < 2) blockers.push("Add at least 2 teams before finishing.");
  if (completeCount < 1) blockers.push("Enter at least one completed result before finishing.");
  if (competition.rule_order.length < 2) blockers.push("Choose at least 2 ranking rules before finishing.");
  const canLock = blockers.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader title={`Review — ${competition.name}`} description="Check everything below, then finish and lock the official record." />
      <Link
        href={`/dashboard/${orgSlug}/tie-breaker/${competition.id}` as Route}
        className="inline-flex min-h-[44px] items-center gap-2 text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to competition
      </Link>

      <section className="space-y-4" aria-label="Review">
        <SectionHeader title="Readiness" description="Live values from your competition — nothing here is estimated." />
        <ReviewChecklist
          summary={{
            teamCount: teams.length,
            completeCount,
            incompleteCount,
            ruleOrder: competition.rule_order as RuleId[],
            scoringLine: `Win ${competition.scoring_win} · Draw ${competition.scoring_draw} · Loss ${competition.scoring_loss}`,
            standings: standings ?? { entries: [], tieGroups: [], evaluations: [], explanations: [], rulesApplied: [], engineVersion: "" },
            teamNames,
          }}
        />
      </section>

      {standings && (
        <section className="space-y-4" aria-label="Final standings preview">
          <StandingsView standings={standings} teamNames={teamNames} />
        </section>
      )}

      <section className="space-y-4" aria-label="Finish and lock">
        <SectionHeader title="Finish and lock" description="Locking creates the official record with its own record number." />
        <LockDialog
          orgSlug={orgSlug}
          competitionId={competition.id}
          incompleteCount={incompleteCount}
          unresolvedCount={unresolvedCount}
          canLock={canLock}
          blockers={blockers}
        />
      </section>
    </div>
  );
}
