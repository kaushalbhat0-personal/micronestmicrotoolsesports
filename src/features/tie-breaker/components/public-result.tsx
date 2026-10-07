import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { TieBreakerShareRecord } from "../services/share";
import { formatDateTimeKolkata } from "@/lib/utils/format";
import { OfficialRecord } from "./official-record";
import { OrgBadge } from "./org-branding";
import { CopyResultButton, PrintResultButton } from "./public-actions";
import { buildTieBreakerCopyText } from "../services/share-text";
import type { ExplanationFact, LockSnapshot, StandingsEntry } from "../types";

/**
 * Adapts the allowlisted share projection to the snapshot view model.
 * Field renaming only — no ranking, no recalculation.
 */
export function toPublicSnapshot(record: TieBreakerShareRecord): LockSnapshot {
  const standings: StandingsEntry[] = record.snapshot.standings.map((e) => ({
    teamId: e.teamId,
    position: e.position,
    points: e.points,
    wins: e.wins,
    draws: e.draws,
    losses: e.losses,
    mapDiff: e.mapDiff,
    roundDiff: e.roundDiff,
    ...(e.decisiveRule ? { decisiveRule: e.decisiveRule } : {}),
    tied: e.tied,
    tiedWith: [...e.tiedWith],
  }));
  const explanations: ExplanationFact[] = record.snapshot.explanations.map((e) => ({
    scope: e.scope,
    teamIds: [...e.teamIds],
    checkedRules: [],
    ...(e.decisiveRule ? { decisiveRule: e.decisiveRule } : {}),
    summary: e.summary,
  }));
  return {
    competitionName: record.competition_name,
    ...(record.description ? { description: record.description } : {}),
    recordNumber: record.record_number,
    lockedAt: record.locked_at,
    ruleOrder: [...record.rule_order],
    scoring: {
      win: record.scoring.win,
      draw: record.scoring.draw,
      loss: record.scoring.loss,
      drawsEnabled: record.scoring.draws_enabled,
      roundLabel: record.scoring.round_label,
    },
    standings,
    explanations,
    teamNames: { ...record.snapshot.teamNames },
    organizationName: record.organization_name,
    ...(record.organization_logo_url ? { organizationLogoUrl: record.organization_logo_url } : {}),
  };
}

/**
 * Tie-Breaker Resolver — Public official result document.
 * Renders the allowlisted locked projection only. No dashboard controls,
 * no edit affordances, no private data. Standings come from the frozen
 * snapshot — nothing is recalculated here.
 */
export function PublicResult({ record, publicUrl }: { record: TieBreakerShareRecord; publicUrl: string }) {
  const teamNames = record.snapshot.teamNames;
  const tiedEntries = record.snapshot.standings.filter((e) => e.tied);
  const unresolvedFacts = record.snapshot.explanations.filter((e) => e.scope === "unresolved");
  const copyText = buildTieBreakerCopyText(record, publicUrl);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <OrgBadge name={record.organization_name} logoUrl={record.organization_logo_url} size="lg" />
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold">{record.organization_name}</p>
          <p className="text-xs text-muted-foreground">Published official result</p>
        </div>
      </div>

      <OfficialRecord
        recordNumber={record.record_number}
        lockedAt={record.locked_at}
        snapshot={toPublicSnapshot(record)}
        teamNames={teamNames}
      />

      {(tiedEntries.length > 0 || unresolvedFacts.length > 0) && (
        <Card className="border-warning/40" aria-label="Unresolved ties">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-warning" aria-hidden /> Tie remains unresolved
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm leading-relaxed">
            <p>
              These teams could not be separated by the selected ranking rules. The organizer finished and locked
              this official result with the tie remaining unresolved.
            </p>
            {unresolvedFacts.map((fact, i) => (
              <p key={i} className="text-muted-foreground">
                {fact.summary}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card aria-label="Official record information">
        <CardHeader>
          <CardTitle className="text-sm">Official record</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <p className="font-mono font-semibold">{record.record_number}</p>
          <p className="text-muted-foreground">Locked {formatDateTimeKolkata(record.locked_at)}</p>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 print:hidden sm:flex-row">
        <CopyResultButton text={copyText} />
        <PrintResultButton />
      </div>
    </div>
  );
}
