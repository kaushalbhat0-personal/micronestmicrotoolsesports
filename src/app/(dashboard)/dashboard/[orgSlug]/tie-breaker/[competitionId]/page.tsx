import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
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
import { CompetitionSetupForm } from "@/features/tie-breaker/components/competition-setup-form";
import { CompetitionStatusBadge } from "@/features/tie-breaker/components/competition-status-badge";
import { CopyCompetitionButton } from "@/features/tie-breaker/components/copy-competition-button";
import { ShareLinkButton } from "@/features/tie-breaker/components/share-link-button";
import { DeleteCompetitionButton } from "@/features/tie-breaker/components/delete-competition-button";
import { OfficialRecord } from "@/features/tie-breaker/components/official-record";
import { ResultEntryForm } from "@/features/tie-breaker/components/result-entry-form";
import { ResultList } from "@/features/tie-breaker/components/result-list";
import { StandingsView } from "@/features/tie-breaker/components/standings-view";
import { TeamManager } from "@/features/tie-breaker/components/team-manager";
import type { LockSnapshot, RuleId, StandingsResult } from "@/features/tie-breaker/types";

export const metadata = {
  title: "Competition — Tie-Breaker",
  description: "Manage teams, results, and standings for one competition.",
};

function isLockSnapshot(value: unknown): value is LockSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Record<string, unknown>;
  return Array.isArray(snapshot.standings) && Array.isArray(snapshot.explanations);
}

export default async function TieBreakerWorkspacePage({
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

  const [teams, listed] = await Promise.all([
    listTeams(supabase, ctx.organization.id, competition.id).catch(() => []),
    listResults(supabase, ctx.organization.id, competition.id).catch(() => ({ results: [], duplicatePairIds: [] })),
  ]);
  const teamNames: Record<string, string> = {};
  for (const t of teams) teamNames[t.id] = t.name;

  if (competition.status === "locked") {
    const snapshot = competition.locked_snapshot;
    if (!isLockSnapshot(snapshot)) notFound();
    return (
      <div className="space-y-6">
        <PageHeader
          title={competition.name}
          description="This official record is locked and cannot be changed."
          action={<CompetitionStatusBadge status="locked" />}
        />
        <OfficialRecord
          recordNumber={competition.record_number}
          lockedAt={competition.locked_at}
          snapshot={snapshot}
          teamNames={teamNames}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <ShareLinkButton shareToken={competition.share_token} />
          <CopyCompetitionButton orgSlug={orgSlug} competitionId={competition.id} />
        </div>
      </div>
    );
  }

  let standings: StandingsResult | null = null;
  if (teams.length >= 2) {
    try {
      ({ standings } = await getStandings(supabase, ctx.organization.id, competition.id));
    } catch {
      standings = null;
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={competition.name}
        description={competition.status === "draft" ? "Set up your competition — add teams and enter results." : "Results are being recorded — standings update after every result."}
        action={<CompetitionStatusBadge status={competition.status} />}
      />

      <section className="space-y-4" aria-label="Setup">
        <SectionHeader title="Setup" description="Rules, scoring, and details. Everything stays editable until you lock." />
        <CompetitionSetupForm
          orgSlug={orgSlug}
          mode="edit"
          competitionId={competition.id}
          initial={{
            name: competition.name,
            description: competition.description ?? "",
            preset: (competition.preset_ref ?? "round_robin") as "round_robin" | "group_stage" | "swiss_lite",
            win: competition.scoring_win,
            draw: competition.scoring_draw,
            loss: competition.scoring_loss,
            allowDraws: competition.draws_enabled,
            roundLabel: competition.round_label,
            ruleOrder: competition.rule_order as RuleId[],
          }}
        />
      </section>

      <section className="space-y-4" aria-label="Teams and results">
        <SectionHeader title="Teams and results" description="Add teams first, then record each finished match." />
        <TeamManager orgSlug={orgSlug} competitionId={competition.id} teams={teams} />
        <ResultEntryForm
          orgSlug={orgSlug}
          competitionId={competition.id}
          teams={teams}
          drawsEnabled={competition.draws_enabled}
          roundLabel={competition.round_label}
        />
        <ResultList
          orgSlug={orgSlug}
          competitionId={competition.id}
          teams={teams}
          results={listed.results}
          duplicatePairIds={listed.duplicatePairIds}
          roundLabel={competition.round_label}
          drawsEnabled={competition.draws_enabled}
        />
      </section>

      {standings && (
        <section className="space-y-4" aria-label="Standings">
          <SectionHeader title="Live standings" description="Calculated from completed results using your rule order." />
          <StandingsView standings={standings} teamNames={teamNames} />
          <Link
            href={`/dashboard/${orgSlug}/tie-breaker/${competition.id}/review` as Route}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-full bg-primary px-6 text-[14px] font-medium text-primary-foreground shadow-sm transition-colors hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Review before locking <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </section>
      )}

      <section aria-label="Danger zone">
        <DeleteCompetitionButton orgSlug={orgSlug} competitionId={competition.id} />
      </section>
    </div>
  );
}
