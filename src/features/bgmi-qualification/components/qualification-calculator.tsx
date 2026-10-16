"use client";

import * as React from "react";
import { Calculator, Crosshair, Gauge, Target } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  BEST_CASE_ASSUMPTION,
  QUALIFICATION_PRESETS,
  WORST_CASE_ASSUMPTION,
  getPresetById,
} from "../services/presets";
import {
  MAX_MATCHES,
  MAX_POINTS,
  averageProjection,
  compareToTarget,
  isOutOfReachUnderAssumptions,
  isValidMatches,
  isValidPoints,
  planningBand,
  pointsGap,
  requiredRate,
  scenarioPoints,
} from "../services/scoring";
import { gapMessage, outOfReachMessage, rateMessage, verdictLabel } from "../services/copy";
import type { QualificationScenario, QualificationShareState } from "../types";
import { ScenarioEditor, SavedScenarioRow, type ScenarioDraft } from "./scenario-editor";
import { ShareBlock } from "./share-block";

export interface QualificationCalculatorProps {
  readonly initialState?: QualificationShareState | null;
}

function parseIntOrNull(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : null;
}

function parseRateOrNull(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/**
 * BGMI Qualification Simulator — fully client-side, ephemeral.
 * Answers "what do we need to qualify?" from four local inputs.
 * No account, no persistence, no network. Share links carry state.
 */
export function QualificationCalculator({ initialState = null }: QualificationCalculatorProps) {
  const [currentText, setCurrentText] = React.useState(initialState ? String(initialState.current) : "");
  const [targetText, setTargetText] = React.useState(initialState ? String(initialState.target) : "");
  const [matchesText, setMatchesText] = React.useState(initialState ? String(initialState.matches) : "");
  const [presetId, setPresetId] = React.useState(initialState?.preset ?? QUALIFICATION_PRESETS[0]?.id ?? "krafton-2026");
  const [draft, setDraft] = React.useState<ScenarioDraft>({ placement: 1, finishes: 8 });
  const [scenarios, setScenarios] = React.useState<readonly QualificationScenario[]>(initialState?.scenarios ?? []);
  const [averageText, setAverageText] = React.useState(
    initialState?.averageRate !== null && initialState?.averageRate !== undefined ? String(initialState.averageRate) : ""
  );

  const preset = getPresetById(presetId);
  const currentRaw = parseIntOrNull(currentText);
  const targetRaw = parseIntOrNull(targetText);
  const matchesRaw = parseIntOrNull(matchesText);
  const current = currentRaw !== null && isValidPoints(currentRaw) ? currentRaw : null;
  const target = targetRaw !== null && isValidPoints(targetRaw) ? targetRaw : null;
  const matches = matchesRaw !== null && isValidMatches(matchesRaw) ? matchesRaw : null;
  const hasInputs = current !== null && target !== null && matches !== null;

  const need = hasInputs ? pointsGap(current, target) : null;
  const rate = need !== null && matches !== null ? requiredRate(need, matches) : null;
  const band = hasInputs ? planningBand(current, matches) : null;
  const outOfReach = band !== null && target !== null ? isOutOfReachUnderAssumptions(band, target) : false;

  const avgRaw = parseRateOrNull(averageText);
  const avgProjected = hasInputs && avgRaw !== null ? averageProjection(current, avgRaw, matches) : null;
  const avgVerdict = avgProjected !== null && target !== null ? compareToTarget(avgProjected, target) : null;

  const draftPoints = scenarioPoints(preset, draft.placement, draft.finishes);

  const shareState: QualificationShareState = {
    v: 1,
    current: current ?? 0,
    target: target ?? 0,
    matches: matches ?? 0,
    preset: preset.id,
    scenarios,
    averageRate: avgRaw,
  };
  const shareScenario = scenarios[0] ?? null;
  const shareScenarioTotal = shareScenario ? (scenarioPoints(preset, shareScenario.placement, shareScenario.finishes)?.total ?? null) : null;
  const shareProjected = shareScenarioTotal !== null && current !== null ? current + shareScenarioTotal : null;

  const inputError = (text: string, valid: boolean, max: number, name: string): string | null => {
    if (text.trim() === "") return null;
    const n = Number(text);
    if (!Number.isInteger(n) || n < 0) return `${name} must be a whole number of 0 or more.`;
    if (!valid) return `${name} must be at most ${new Intl.NumberFormat("en-IN").format(max)}.`;
    return null;
  };
  const currentError = inputError(currentText, current !== null, MAX_POINTS, "Current points");
  const targetError = inputError(targetText, target !== null, MAX_POINTS, "Target points");
  const matchesError = inputError(matchesText, matches !== null, MAX_MATCHES, "Matches remaining");

  return (
    <div className="space-y-5">
      {/* Inputs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calculator className="h-4 w-4 text-primary" aria-hidden /> Your position
          </CardTitle>
          <CardDescription>Three numbers — everything updates instantly.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="qc-current">Current points</Label>
            <Input
              id="qc-current"
              inputMode="numeric"
              placeholder="42"
              value={currentText}
              onChange={(e) => setCurrentText(e.target.value)}
              aria-describedby={currentError ? "qc-current-error" : undefined}
              className="tabular-nums"
            />
            {currentError ? <p id="qc-current-error" role="alert" className="text-xs text-destructive">{currentError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-target">Qualification target</Label>
            <Input
              id="qc-target"
              inputMode="numeric"
              placeholder="58"
              value={targetText}
              onChange={(e) => setTargetText(e.target.value)}
              aria-describedby={targetError ? "qc-target-error" : undefined}
              className="tabular-nums"
            />
            {targetError ? <p id="qc-target-error" role="alert" className="text-xs text-destructive">{targetError}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="qc-matches">Matches remaining</Label>
            <Input
              id="qc-matches"
              inputMode="numeric"
              placeholder="4"
              value={matchesText}
              onChange={(e) => setMatchesText(e.target.value)}
              aria-describedby={matchesError ? "qc-matches-error" : undefined}
              className="tabular-nums"
            />
            {matchesError ? <p id="qc-matches-error" role="alert" className="text-xs text-destructive">{matchesError}</p> : null}
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="qc-preset">Scoring</Label>
            <select
              id="qc-preset"
              value={preset.id}
              onChange={(e) => setPresetId(e.target.value)}
              className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {QUALIFICATION_PRESETS.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">{preset.sourceLabel}. 1st–8th earn {preset.placementPoints.slice(0, 8).join(" / ")} pts · every finish 1 pt. Tiebreaks: most WWCDs, then placement, then finishes, then the last match.</p>
          </div>
        </CardContent>
      </Card>

      {/* Verdict */}
      <Card aria-live="polite" aria-atomic="true">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-primary" aria-hidden /> What you need
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!hasInputs ? (
            <p className="text-sm text-muted-foreground">Enter your current points, the qualification target, and matches remaining to see exactly what is needed.</p>
          ) : (
            <>
              <p className="text-lg font-semibold tracking-tight">{gapMessage(need ?? 0, matches)}</p>
              {rate !== null && need !== null && need > 0 ? (
                <p className="text-sm text-muted-foreground tabular-nums">{rateMessage(rate)}</p>
              ) : null}
              {band !== null ? (
                <details className="rounded-[12px] border border-border bg-surface-muted/40 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  <summary className="cursor-pointer font-medium text-foreground">
                    Best / worst range: {new Intl.NumberFormat("en-IN").format(band.worst)} – {new Intl.NumberFormat("en-IN").format(band.best)} pts
                  </summary>
                  <p className="mt-2">
                    Best assumes {BEST_CASE_ASSUMPTION}; worst assumes {WORST_CASE_ASSUMPTION}. A range for planning —
                    not a prediction, not a guarantee.
                  </p>
                </details>
              ) : null}
              {outOfReach ? (
                <p className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Badge variant="destructive">Out of reach</Badge>
                  <span>{outOfReachMessage()}</span>
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      {/* What-if */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Crosshair className="h-4 w-4 text-primary" aria-hidden /> What if?
          </CardTitle>
          <CardDescription>Pick a placement and finishes — see the projected total against your target.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ScenarioEditor
            draft={draft}
            onChange={setDraft}
            presetId={preset.id}
            current={current}
            target={target}
            onSave={scenarios.length < 3 && draftPoints !== null ? () => setScenarios([...scenarios, { ...draft }]) : null}
            savedCount={scenarios.length}
          />
          {scenarios.length > 0 ? (
            <ul aria-label="Saved scenarios" className="space-y-2">
              {scenarios.map((s, i) => (
                <SavedScenarioRow
                  key={`${s.placement}-${s.finishes}-${i}`}
                  scenario={s}
                  index={i}
                  presetId={preset.id}
                  current={current ?? 0}
                  target={target ?? 0}
                  onRemove={() => setScenarios(scenarios.filter((_, j) => j !== i))}
                />
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      {/* Average rate / target mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Gauge className="h-4 w-4 text-primary" aria-hidden /> Average rate
          </CardTitle>
          <CardDescription>What if you average a fixed number of points per remaining match?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="qc-average">Average points per match</Label>
            <Input
              id="qc-average"
              inputMode="decimal"
              placeholder="6"
              value={averageText}
              onChange={(e) => setAverageText(e.target.value)}
              className="tabular-nums"
            />
          </div>
          <div aria-live="polite">
            {avgProjected !== null && target !== null && avgVerdict !== null ? (
              <p className="text-sm leading-relaxed">
                <span className="font-semibold tabular-nums">{avgProjected} projected</span>{" "}
                <Badge variant={avgVerdict === "above" ? "success" : avgVerdict === "exact" ? "warning" : "secondary"}>
                  {verdictLabel(avgVerdict)}
                </Badge>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {avgVerdict === "above"
                    ? `Averaging ${averageText} pts lands at ${avgProjected} — above your ${target}-pt target on current standings.`
                    : avgVerdict === "exact"
                      ? "That average lands exactly on target — final position may depend on tiebreaks."
                      : `That average lands at ${avgProjected} — ${target - avgProjected} short of target.`}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">Enter your position above and an average to project the finish.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Smash notice */}
      <details className="rounded-[12px] border border-border bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
        <summary className="cursor-pointer font-medium text-foreground">Playing finals with a Smash Rule / match-point ending?</summary>
        <p className="mt-2">
          Finals use a Smash Rule / match-point format. This calculator covers the points race, not the match-point ending.
        </p>
      </details>

      {/* Share */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Share this check</CardTitle>
          <CardDescription>Send the numbers to your squad — the link reopens this exact scenario.</CardDescription>
        </CardHeader>
        <CardContent>
          <ShareBlock
            state={shareState}
            check={{
              current: current ?? 0,
              target: target ?? 0,
              matches: matches ?? 0,
              pointsNeeded: need ?? 0,
              scenario: shareScenario,
              scenarioTotal: shareScenarioTotal,
              projected: shareProjected,
              verdictLine:
                shareProjected !== null && target !== null
                  ? shareProjected > target
                    ? "Above target."
                    : shareProjected === target
                      ? "Target matched — tiebreaks may decide it."
                      : `${target - shareProjected} short of target.`
                  : "Check your scenario.",
            }}
          />
        </CardContent>
      </Card>

      <p className="text-xs leading-relaxed text-muted-foreground">
        Targets move as rivals score — re-check after each match. Tiebreak order: most wins, then placement points, then
        finishes, then the most recent match. This tool plans against a target you enter; it never predicts results.
      </p>
    </div>
  );
}
