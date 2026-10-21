"use client";

import * as React from "react";
import Link from "next/link";
import type { Route } from "next";
import { ArrowRight, ClipboardList, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS,
  TOURNAMENT_SCENARIO_GENERATOR_TOTAL,
  isGeneratorComplete,
  scoreGeneratorPick,
  summarizeGenerator,
  type TournamentGeneratorOption,
} from "../data/tournament-scenario-generator-logic";
import { ShareRow } from "./share-row";
import { SharedResultBanner, useSharedLabResult } from "./shared-result-banner";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { labAbsoluteUrl } from "@/lib/marketing/public-tool-content";

const LETTERS = ["A", "B", "C"] as const;

function toneLabel(option: TournamentGeneratorOption): string {
  if (option.alignsWithOutcome) return "Stronger practice read";
  return option.tone === "higher-risk" ? "Higher-risk read" : "More conservative read";
}

/**
 * Tournament Scenario Generator — practice scenarios over recorded Finals
 * context (V1).
 *
 * Real published match facts (BMSD 2026 Grand Finals) meet Lab-authored
 * decision framing: context → scenario → call → reveal → recorded outcome →
 * takeaway. The island never claims the historical path was correct,
 * optimal, or intended — the count tracks calls that line up with the
 * recorded outcome profile (see tournament-scenario-generator-logic.ts).
 * Ephemeral state only: no account, no persistence, no analytics. Lives
 * inside AdSafeGameLayout; renders no ads and nothing resembling one.
 */
export function TournamentScenarioGeneratorShell() {
  const [index, setIndex] = React.useState(0);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [stronger, setStronger] = React.useState(0);
  const [answeredCount, setAnsweredCount] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  const revealRef = React.useRef<HTMLDivElement>(null);

  const scenario = TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS[index % TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.length]!;
  const pickedOption = scenario.options.find((o) => o.id === picked) ?? null;
  const lastScenario = index === TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.length - 1;
  const summary = summarizeGenerator(stronger);
  // Recipient-only challenge hint from `?result=S-T`. Display-only:
  // never touches picks, counts, or completion state below.
  const { shared, dismiss } = useSharedLabResult(TOURNAMENT_SCENARIO_GENERATOR_TOTAL);

  function pick(optionId: string) {
    if (picked !== null || finished) return;
    const result = scoreGeneratorPick(scenario, optionId, picked !== null);
    setPicked(optionId);
    setAnsweredCount((c) => c + 1);
    if (result.stronger) setStronger((s) => s + 1);
  }

  function next() {
    if (lastScenario) {
      setFinished(true);
      return;
    }
    setPicked(null);
    setIndex((i) => i + 1);
  }

  function reset() {
    setIndex(0);
    setPicked(null);
    setStronger(0);
    setAnsweredCount(0);
    setFinished(false);
  }

  React.useEffect(() => {
    if (picked !== null && revealRef.current) revealRef.current.focus();
  }, [picked]);

  if (finished && isGeneratorComplete(answeredCount)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ClipboardList className="h-4 w-4 text-primary" aria-hidden /> Scenario Generator complete
          </CardTitle>
          <CardDescription>
            {summary.stronger} of {summary.total} stronger practice reads — nothing saved, replay freely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div aria-live="polite" className="rounded-[12px] border border-primary/25 bg-primary/[0.06] p-5 text-center">
            <p className="font-mono text-[11px] tracking-widest text-primary">SCENARIOS REVIEWED</p>
            <p className="font-display mt-1 text-3xl font-normal tracking-tight">
              {summary.stronger} / {summary.total}
            </p>
            <p className="mt-1 text-sm font-semibold">{summary.heading}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{summary.body}</p>
          </div>
          <ShareRow
            gameName="Tournament Scenario Generator"
            score={summary.stronger}
            total={summary.total}
            resultNoun="stronger practice reads"
            shareText={
              getBgmiLabTool("tournament-scenario-generator")?.shareText ??
              "A free BGMI practice generator built on real Finals context — can you make the call?"
            }
            canonicalUrl={labAbsoluteUrl("/bgmi-lab/tournament-scenario-generator")}
          />
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Generate again
          </button>
          <p className="text-xs text-muted-foreground">
            Built from recorded tournament context. Facts come from the published record; framing is Lab analysis. Nothing is predicted or saved.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {shared ? (
        <div className="mb-4">
          <SharedResultBanner
            gameName="Tournament Scenario Generator"
            shared={shared}
            resultNoun="stronger practice reads"
            onDismiss={dismiss}
          />
        </div>
      ) : null}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] tracking-widest text-primary">
            SCENARIO {String(index + 1).padStart(2, "0")} / {String(TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.length).padStart(2, "0")}
          </p>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground" aria-live="polite">
            {stronger} STRONGER {stronger === 1 ? "READ" : "READS"}
          </p>
        </div>
        <div className="flex gap-1.5 pt-1" aria-hidden="true">
          {TOURNAMENT_SCENARIO_GENERATOR_SCENARIOS.map((s, i) => (
            <span key={s.id} className={`h-1.5 flex-1 rounded-full ${i < index || (i === index && picked !== null) ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>
        <p className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary">Tournament scenario</Badge>
          <span className="font-mono text-[11px] tracking-widest text-muted-foreground">
            BMSD 2026 · Grand Finals · Match {scenario.source.matchNumber} of 18 · {scenario.source.mapName} ·{" "}
            {scenario.source.dayLabel}
          </span>
        </p>
        <CardTitle className="pt-1 text-xl font-normal">{scenario.theme}</CardTitle>
        <CardDescription className="leading-relaxed">{scenario.situation}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <figure className="overflow-hidden rounded-[12px] border border-border bg-surface-muted/40">
          <svg viewBox="0 0 360 96" className="h-auto w-full" role="img" aria-label={`Lab scenario frame: match ${scenario.source.matchNumber} of 18 on ${scenario.source.mapName}, ${scenario.source.dayLabel}. Abstract strip, not a map.`}>
            {Array.from({ length: 18 }, (_, i) => (
              <rect
                key={i}
                x={10 + i * 19}
                y={i + 1 === scenario.source.matchNumber ? 30 : 38}
                width="12"
                height={i + 1 === scenario.source.matchNumber ? 28 : 12}
                rx="3"
                fill={i + 1 === scenario.source.matchNumber ? "var(--color-primary)" : "var(--color-border-strong)"}
                opacity={i + 1 === scenario.source.matchNumber ? 1 : 0.45}
              />
            ))}
            <text x="180" y="82" textAnchor="middle" fontSize="10" fill="var(--color-foreground-muted)" fontFamily="monospace" letterSpacing="2">
              PRACTICE SCENARIO · MATCH {scenario.source.matchNumber} OF 18
            </text>
          </svg>
          <figcaption className="border-t border-border px-4 py-2 text-[11px] leading-relaxed text-muted-foreground">
            Built from recorded tournament context — an abstract match strip, not a map of {scenario.source.mapName}.{" "}
            Spotlight: {scenario.spotlight.displayName} finished #{scenario.spotlight.placement} ({scenario.spotlight.finishes}{" "}
            finishes, {scenario.spotlight.totalPoints} pts).
          </figcaption>
        </figure>

        <p className="text-sm font-semibold leading-relaxed">{scenario.question}</p>
        <div className="grid gap-2" role="group" aria-label="Make the call">
          {scenario.options.map((option, optionIndex) => {
            const selected = picked === option.id;
            const revealed = picked !== null;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => pick(option.id)}
                disabled={revealed}
                aria-pressed={selected}
                aria-label={`Option ${LETTERS[optionIndex] ?? optionIndex + 1}: ${option.label}`}
                className={`flex min-h-[44px] items-start gap-3 rounded-[12px] border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  revealed && selected
                    ? "border-primary/40 bg-primary/[0.06]"
                    : "border-border bg-card hover:bg-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-border-strong bg-card font-mono text-xs font-bold text-foreground"
                >
                  {LETTERS[optionIndex] ?? optionIndex + 1}
                </span>
                <span className="leading-relaxed">{option.label}</span>
              </button>
            );
          })}
        </div>

        {pickedOption ? (
          <div
            ref={revealRef}
            tabIndex={-1}
            aria-live="polite"
            className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed focus:outline-none"
          >
            <p>
              <Badge variant={pickedOption.alignsWithOutcome ? "success" : "secondary"}>
                {toneLabel(pickedOption)}
              </Badge>
            </p>
            <p className="mt-2 font-medium">What actually happened:</p>
            <p className="mt-1 text-muted-foreground">{scenario.reveal.recordedOutcome}</p>
            <p className="mt-2 font-medium">Your call vs the record:</p>
            <p className="mt-1 text-muted-foreground">{scenario.reveal.comparison}</p>
            <p className="mt-2 font-medium">Why this scenario matters:</p>
            <p className="mt-1 text-muted-foreground">{pickedOption.rationale}</p>
            <p className="mt-3 rounded-[8px] border border-primary/20 bg-primary/[0.05] px-3 py-2">
              <span className="font-mono text-[11px] tracking-widest text-primary">LAB TAKEAWAY · </span>
              <span className="text-foreground">{scenario.reveal.labTakeaway}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {lastScenario ? "See result" : "Next scenario"} <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={reset}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restart
              </button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Source: BMSD 2026 Grand Finals, match {scenario.source.matchNumber} (rev {scenario.source.sourceRevision}).{" "}
              <Link
                href={"/bgmi-tournaments/bmsd-2026/grand-finals" as Route}
                className="underline decoration-primary/30 underline-offset-2 hover:decoration-primary"
              >
                View the published stage
              </Link>
            </p>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Recorded facts from the published record; scenario framing is Lab analysis. Your call is not scored for correctness — nothing is predicted.
        </p>
      </CardContent>
    </Card>
    </>
  );
}
