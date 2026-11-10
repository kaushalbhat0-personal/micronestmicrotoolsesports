"use client";

import * as React from "react";
import { ArrowRight, Crosshair, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  IGL_DECISION_SCENARIOS,
  IGL_DECISION_TOTAL,
  isIglComplete,
  scoreIglPick,
  summarizeIgl,
  tendencyForIglMisses,
  tendencyLine,
  type IglFamily,
} from "../data/igl-decision-logic";
import { ShareRow } from "./share-row";
import { SharedResultBanner, useSharedLabResult } from "./shared-result-banner";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { labAbsoluteUrl } from "@/lib/marketing/public-tool-content";

/**
 * IGL Decision Drill — synthetic tactical decision practice (V1).
 *
 * Six authored pressure scenarios: brief → inspect → decide → commit →
 * consequence → debrief. The brief is the signature surface (a semantic
 * definition list, never a map); up to two intel facts are free to read
 * (no economy, no locking, no timer). The island never claims one call is
 * universally right — the count tracks calls that match the authored
 * rationale for each situation (see igl-decision-logic.ts). Ephemeral
 * state only: no account, no persistence, no analytics. Lives inside
 * AdSafeGameLayout; renders no ads and nothing resembling one.
 */
export function IglDecisionShell() {
  const [index, setIndex] = React.useState(0);
  const [inspected, setInspected] = React.useState<readonly string[]>([]);
  const [selected, setSelected] = React.useState<string | null>(null);
  const [committed, setCommitted] = React.useState(false);
  const [strongCalls, setStrongCalls] = React.useState(0);
  const [missedFamilies, setMissedFamilies] = React.useState<readonly IglFamily[]>([]);
  const [answeredCount, setAnsweredCount] = React.useState(0);
  const [finished, setFinished] = React.useState(false);
  const debriefRef = React.useRef<HTMLDivElement>(null);

  const scenario = IGL_DECISION_SCENARIOS[index % IGL_DECISION_SCENARIOS.length]!;
  const selectedOption = scenario.options.find((o) => o.id === selected) ?? null;
  const lastScenario = index === IGL_DECISION_SCENARIOS.length - 1;
  const summary = summarizeIgl(strongCalls);
  // Recipient-only challenge hint from `?result=S-T`. Display-only:
  // never touches picks, counts, or completion state below.
  const { shared, dismiss } = useSharedLabResult(IGL_DECISION_TOTAL);

  function inspect(intelId: string) {
    if (committed || finished) return;
    if (scenario.intel.length === 0) return;
    if (inspected.includes(intelId)) return;
    if (inspected.length >= scenario.intel.length) return;
    if (!scenario.intel.some((i) => i.id === intelId)) return;
    setInspected((prev) => [...prev, intelId]);
  }

  function select(optionId: string) {
    if (committed || finished) return;
    if (!scenario.options.some((o) => o.id === optionId)) return;
    setSelected(optionId);
  }

  function commit() {
    if (selected === null || committed || finished) return;
    const option = scenario.options.find((o) => o.id === selected);
    if (!option) return;
    const result = scoreIglPick(scenario, selected, committed);
    setCommitted(true);
    setAnsweredCount((c) => c + 1);
    if (result.isStrong) {
      setStrongCalls((s) => s + 1);
    } else {
      setMissedFamilies((m) => [...m, option.family]);
    }
  }

  function next() {
    if (lastScenario) {
      setFinished(true);
      return;
    }
    setInspected([]);
    setSelected(null);
    setCommitted(false);
    setIndex((i) => i + 1);
  }

  function reset() {
    setIndex(0);
    setInspected([]);
    setSelected(null);
    setCommitted(false);
    setStrongCalls(0);
    setMissedFamilies([]);
    setAnsweredCount(0);
    setFinished(false);
  }

  React.useEffect(() => {
    if (committed && debriefRef.current) debriefRef.current.focus();
  }, [committed]);

  if (finished && isIglComplete(answeredCount)) {
    const tendency = tendencyForIglMisses(missedFamilies);
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Crosshair className="h-4 w-4 text-primary" aria-hidden /> IGL Decision Drill complete
          </CardTitle>
          <CardDescription>
            {summary.strong} of {summary.total} stronger calls — nothing saved, drill freely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div aria-live="polite" className="rounded-[12px] border border-primary/25 bg-primary/[0.06] p-5 text-center">
            <p className="font-mono text-[11px] tracking-widest text-primary">FINAL CALL</p>
            <p className="font-display mt-1 text-3xl font-normal tracking-tight">
              {summary.strong} / {summary.total}
            </p>
            <p className="mt-1 text-sm font-semibold">{summary.heading}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{summary.body}</p>
          </div>
          <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed">
            <p className="font-mono text-[11px] tracking-widest text-primary">YOUR TENDENCY</p>
            <p className="mt-1 font-medium">{tendencyLine(tendency)}</p>
          </div>
          <ShareRow
            gameName="IGL Decision Drill"
            score={summary.strong}
            total={summary.total}
            resultNoun="stronger calls"
            shareText={
              getBgmiLabTool("igl-decision-drill")?.shareText ??
              "A free BGMI decision drill built on synthetic pressure scenarios — can you make the call?"
            }
            canonicalUrl={labAbsoluteUrl("/bgmi-lab/igl-decision-drill")}
          />
          <button
            type="button"
            onClick={reset}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Drill again
          </button>
          <p className="text-xs text-muted-foreground">
            Synthetic practice scenarios. Calls are judged against the scenario rationale, never against real matches. Nothing is saved.
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
            gameName="IGL Decision Drill"
            shared={shared}
            resultNoun="stronger calls"
            onDismiss={dismiss}
          />
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-[11px] tracking-widest text-primary">
              CALL {String(index + 1).padStart(2, "0")} / {String(IGL_DECISION_SCENARIOS.length).padStart(2, "0")}
            </p>
            <p className="font-mono text-[11px] tracking-widest text-muted-foreground" aria-live="polite">
              {strongCalls} STRONGER
            </p>
          </div>
          <div className="flex gap-1.5 pt-1" aria-hidden="true">
            {IGL_DECISION_SCENARIOS.map((s, i) => (
              <span
                key={s.id}
                className={`h-1.5 flex-1 rounded-full ${i < index || (i === index && committed) ? "bg-primary" : "bg-border"}`}
              />
            ))}
          </div>
          <p className="flex flex-wrap items-center gap-2 pt-1">
            <Badge variant="secondary">IGL drill</Badge>
            <span className="font-mono text-[11px] tracking-widest text-muted-foreground">SYNTHETIC SCENARIO</span>
          </p>
          <CardTitle className="pt-1 text-xl font-normal">{scenario.title}</CardTitle>
          <CardDescription className="leading-relaxed">{scenario.situation}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <section aria-label="Situation brief">
            <h3 className="font-mono text-[11px] tracking-widest text-primary">BRIEF</h3>
            <dl className="mt-2 divide-y divide-border/60 rounded-[12px] border border-border bg-card px-4 py-1 text-sm leading-relaxed">
              <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-medium sm:w-32">Remaining</dt>
                <dd className="text-muted-foreground">{scenario.brief.remainingTeams}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-medium sm:w-32">Position</dt>
                <dd className="text-muted-foreground">{scenario.brief.position}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-medium sm:w-32">Terrain</dt>
                <dd className="text-muted-foreground">{scenario.brief.terrain}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-medium sm:w-32">Zone</dt>
                <dd className="text-muted-foreground">{scenario.brief.zone}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-medium sm:w-32">Resources</dt>
                <dd className="text-muted-foreground">{scenario.brief.resources}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-medium sm:w-32">Threats</dt>
                <dd className="text-muted-foreground">{scenario.brief.threats}</dd>
              </div>
              <div className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-3">
                <dt className="shrink-0 font-medium sm:w-32">Timing</dt>
                <dd className="text-muted-foreground">{scenario.brief.timing}</dd>
              </div>
            </dl>
          </section>

          <section aria-label="Intel">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-mono text-[11px] tracking-widest text-primary">INSPECT</h3>
              <p className="text-xs text-muted-foreground">
                {committed ? "Reading locked after commit." : "Two facts you can uncover before committing."}
              </p>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {scenario.intel.map((fact) => {
                const revealed = inspected.includes(fact.id);
                const disabled = committed || finished || (!revealed && inspected.length >= scenario.intel.length);
                return (
                  <div
                    key={fact.id}
                    className={`rounded-[12px] border px-3 py-2 ${revealed ? "border-primary/40 bg-primary/[0.05]" : "border-border bg-card"}`}
                  >
                    <button
                      type="button"
                      onClick={() => inspect(fact.id)}
                      disabled={disabled}
                      aria-pressed={revealed}
                      aria-label={revealed ? `${fact.title}, revealed. ${fact.body}` : `Reveal ${fact.title}`}
                      className="flex min-h-[44px] w-full items-center gap-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
                          revealed ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-muted-foreground"
                        }`}
                      >
                        {revealed ? "✓" : "?"}
                      </span>
                      <span className="font-medium">{fact.title}</span>
                      <span className="ml-auto font-mono text-[10px] tracking-widest text-muted-foreground">
                        {revealed ? "FOUND" : "1 READ"}
                      </span>
                    </button>
                    {revealed ? (
                      <p className="pb-1 pl-8 pr-1 text-sm leading-relaxed text-muted-foreground">{fact.body}</p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>

          <p className="text-sm font-semibold leading-relaxed">{scenario.question}</p>
          <div className="grid gap-2" role="group" aria-label="Your call">
            {scenario.options.map((option) => {
              const isSelected = selected === option.id;
              const revealed = committed;
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => select(option.id)}
                  disabled={revealed}
                  aria-pressed={isSelected}
                  aria-label={option.label}
                  className={`flex min-h-[44px] flex-col items-start gap-1 rounded-[12px] border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    revealed && option.quality === "strong"
                      ? "border-primary/40 bg-primary/[0.06]"
                      : revealed && isSelected
                        ? "border-border bg-surface-muted/40"
                        : isSelected
                          ? "border-primary/50 bg-primary/[0.06]"
                          : "border-border bg-card hover:bg-muted"
                  }`}
                >
                  <span className="leading-relaxed">{option.label}</span>
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground">
                    {option.family.toUpperCase()} CALL
                  </span>
                </button>
              );
            })}
          </div>

          {!committed ? (
            <button
              type="button"
              onClick={commit}
              disabled={selectedOption === null}
              className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              Commit to this call <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          ) : null}

          {committed && selectedOption ? (
            <div
              ref={debriefRef}
              tabIndex={-1}
              aria-live="polite"
              className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed focus:outline-none"
            >
              <p>
                <Badge variant={selectedOption.quality === "strong" ? "success" : "secondary"}>
                  {selectedOption.quality === "strong" ? "Stronger call" : "Riskier call"}
                </Badge>
              </p>
              <p className="mt-2 font-medium">Your call:</p>
              <p className="mt-1 text-muted-foreground">{selectedOption.label}</p>
              <p className="mt-2 font-medium">What followed:</p>
              <p className="mt-1 text-muted-foreground">{selectedOption.consequence}</p>
              {selectedOption.quality === "strong" && selectedOption.rationale ? (
                <>
                  <p className="mt-2 font-medium">Why this holds here:</p>
                  <p className="mt-1 text-muted-foreground">{selectedOption.rationale}</p>
                </>
              ) : null}
              {selectedOption.quality === "weak" && selectedOption.weakerBecause ? (
                <>
                  <p className="mt-2 font-medium">Why this falls short here:</p>
                  <p className="mt-1 text-muted-foreground">{selectedOption.weakerBecause}</p>
                </>
              ) : null}
              <p className="mt-2 font-medium">Why the other calls fall short:</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
                {scenario.options
                  .filter((o) => o.id !== selectedOption.id && o.quality === "weak" && o.weakerBecause)
                  .map((o) => (
                    <li key={o.id}>
                      <span className="font-medium text-foreground">{o.label} — </span>
                      {o.weakerBecause}
                    </li>
                  ))}
              </ul>
              {selectedOption.quality === "weak" ? (
                <>
                  <p className="mt-2 font-medium">What held up better:</p>
                  {scenario.options
                    .filter((o) => o.quality === "strong")
                    .map((o) => (
                      <p key={o.id} className="mt-1 text-muted-foreground">
                        <span className="font-medium text-foreground">{o.label} — </span>
                        {o.rationale}
                      </p>
                    ))}
                </>
              ) : null}
              <p className="mt-3 rounded-[8px] border border-primary/20 bg-primary/[0.05] px-3 py-2">
                <span className="font-mono text-[11px] tracking-widest text-primary">PRINCIPLE · </span>
                <span className="text-foreground">{scenario.principle}</span>
              </p>
              <p className="mt-3 rounded-[8px] border border-primary/20 bg-primary/[0.05] px-3 py-2">
                <span className="font-mono text-[11px] tracking-widest text-primary">IGL NOTE · </span>
                <span className="text-foreground">{scenario.uncertainty}</span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {lastScenario ? "See result" : "Next call"} <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={reset}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restart
                </button>
              </div>
            </div>
          ) : null}
          <p className="text-xs text-muted-foreground">
            Synthetic practice scenarios. Calls are judged against the scenario rationale, never against real matches. Nothing is saved.
          </p>
        </CardContent>
      </Card>
    </>
  );
}
