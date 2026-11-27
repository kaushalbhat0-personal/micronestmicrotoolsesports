"use client";

import * as React from "react";
import { ArrowRight, Crosshair, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CIRCLE_IQ_ROUNDS,
  CIRCLE_IQ_TOTAL,
  SCOUTS_PER_ROUND,
  consequenceCopyFor,
  consequenceForCrossing,
  consequenceKindFor,
  createRunSeed,
  createScoutState,
  crossingForOption,
  inspectReveal,
  isComplete,
  orderOptionsForRound,
  orderRoundsForRun,
  resolveMapTap,
  revealIdsFor,
  scorePick,
  scoutNote,
  selectCrossing,
  summarizeScore,
  tendencyForMisses,
  tendencyLine,
  type CircleIqLandmark,
  type CircleIqRoutePoint,
} from "../data/circle-iq-logic";
import { ShareRow } from "./share-row";
import {
  CircleIqBoardCanvas,
  partialBoardPoints,
  type CircleIqBoardTap,
} from "./circle-iq-board-canvas";
import { SharedResultBanner, useSharedLabResult } from "./shared-result-banner";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { labAbsoluteUrl } from "@/lib/marketing/public-tool-content";

/**
 * Circle IQ — super-interactive replayable gameplay (V5 Hybrid + Canvas board).
 *
 * INVESTIGATE → SELECT CORRIDOR → SELECT CROSSING → PREVIEW → COMMIT →
 * CONSEQUENCE → DEBRIEF. Eight authored synthetic rounds in a seeded
 * per-run order with seeded per-round option display order. Each round
 * grants 2 scouts to inspect authored map targets (facts only, never a
 * verdict). Tapping a corridor previews NEUTRAL geometry; the map then
 * reveals that corridor's authored crossing pins (A/B…) and the matching
 * native crossing list. Selecting a crossing draws YOU → crossing →
 * authored arrival neutrally. "Commit to this call" locks corridor +
 * crossing + scouting, plays a crossing-aware Canvas consequence traversal
 * (arrived / caught-open / left-behind, with a SPOTTED beat on high
 * exposure), then reveals verdict + crossing note + principle + scout
 * note. Hold options carry no crossings and skip straight to Preview.
 * Ephemeral state only (no account, no persistence, no analytics). Lives
 * inside AdSafeGameLayout; renders no ads and nothing resembling one.
 *
 * Scoring is always by authored option ID — A/B/C letters are display-only.
 * Exposure is authored per crossing and never displayed before commit.
 */

const LETTERS = ["A", "B", "C"] as const;

/** Consequence beat length. Verdict reveal is timer-gated; reduced motion uses 0ms. */
const CONSEQUENCE_MS = 750;

const LANDMARK_KIND: Record<CircleIqLandmark["type"], string> = {
  ridge: "high ground",
  compound: "buildings",
  open: "low ground",
  road: "road",
  cover: "natural cover",
  water: "water",
};

export function CircleIqShell() {
  // Seed starts null so the server and the first client render agree
  // (seed 0, authored order) — hydration-safe. A real ephemeral seed is
  // installed in an effect after mount, so every interactive run shuffles.
  const [runSeed, setRunSeed] = React.useState<number | null>(null);
  const seed = runSeed ?? 0;
  const roundQueue = React.useMemo(() => orderRoundsForRun(CIRCLE_IQ_ROUNDS, seed), [seed]);
  const [index, setIndex] = React.useState(0);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [crossingId, setCrossingId] = React.useState<string | null>(null);
  const [committedId, setCommittedId] = React.useState<string | null>(null);
  const [committedCrossingId, setCommittedCrossingId] = React.useState<string | null>(null);
  const [consequence, setConsequence] = React.useState(false);
  const [verdict, setVerdict] = React.useState(false);
  const [strongReads, setStrongReads] = React.useState(0);
  const [answeredCount, setAnsweredCount] = React.useState(0);
  const [misses, setMisses] = React.useState<readonly { optionId: string; roundId: string }[]>([]);
  const [finished, setFinished] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const [scout, setScout] = React.useState(createScoutState);
  const [scoutsUsedAtCommit, setScoutsUsedAtCommit] = React.useState(0);
  const [lastIntel, setLastIntel] = React.useState<string | null>(null);
  const [statusNote, setStatusNote] = React.useState<string | null>(null);
  const verdictRef = React.useRef<HTMLDivElement>(null);
  const consequenceRef = React.useRef<HTMLDivElement>(null);
  const boardWrapRef = React.useRef<HTMLElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const round = roundQueue[index % roundQueue.length]!;
  const displayOptions = React.useMemo(() => orderOptionsForRound(round, seed, index), [round, seed, index]);
  const previewOption = displayOptions.find((o) => o.id === previewId) ?? null;
  const selectedCrossing =
    previewOption !== null && crossingId !== null
      ? (previewOption.crossings?.find((c) => c.id === crossingId) ?? null)
      : null;
  const previewIsHold = previewOption !== null && previewOption.route.style === "hold";
  const committedOption = displayOptions.find((o) => o.id === committedId) ?? null;
  const committedCrossing =
    committedOption !== null && committedCrossingId !== null
      ? (committedOption.crossings?.find((c) => c.id === committedCrossingId) ?? null)
      : null;
  const lastRound = index === roundQueue.length - 1;
  const summary = summarizeScore(strongReads);
  const locked = committedId !== null;
  const revealIds = React.useMemo(() => revealIdsFor(round), [round]);
  // Recipient-only challenge hint from `?result=S-T`. Display-only:
  // never touches scoring, completion, or run order below.
  const { shared, dismiss } = useSharedLabResult(CIRCLE_IQ_TOTAL);

  React.useEffect(() => {
    setRunSeed(createRunSeed());
  }, []);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  React.useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (verdict && verdictRef.current) verdictRef.current.focus();
  }, [verdict]);

  function inspect(revealId: string) {
    if (locked || finished) return;
    const result = inspectReveal(scout, revealId, revealIds, locked);
    if (!result.consumed) return;
    setScout(result.state);
    const reveal = round.reveals.find((r) => r.id === revealId);
    if (reveal) setLastIntel(`${reveal.title}: ${reveal.intel}`);
  }

  function preview(optionId: string) {
    if (locked || finished) return;
    // Corridor switches always clear the crossing — a crossing belongs
    // to exactly one corridor.
    if (optionId !== previewId) setCrossingId(null);
    setPreviewId(optionId);
    const option = displayOptions.find((o) => o.id === optionId);
    if (option) {
      const letter = LETTERS[displayOptions.findIndex((o) => o.id === optionId)] ?? "";
      setStatusNote(
        option.route.style === "hold"
          ? `Corridor ${letter} selected: ${option.label}. Holding needs no crossing — preview and commit.`
          : `Corridor ${letter} selected: ${option.label}. Now pick where along it to cross.`,
      );
    }
  }

  /**
   * Single shared crossing transition — map pins and the native
   * crossing list invoke exactly this. Fail-closed via selectCrossing:
   * unknown ids, missing corridors, hold corridors, and locked rounds
   * all no-op without touching state.
   */
  function chooseCrossing(id: string) {
    if (locked || finished) return;
    const result = selectCrossing(round, previewId, id, locked);
    if (!result.ok || result.crossingId === null) return;
    setCrossingId(result.crossingId);
    const crossing = crossingForOption(round, previewId!, result.crossingId);
    if (crossing) {
      const letter = LETTERS[displayOptions.findIndex((o) => o.id === previewId)] ?? "";
      setStatusNote(
        `Crossing selected on route ${letter}: ${crossing.label}. ${crossing.intel} Arrival marked on the map.`,
      );
    }
  }

  /**
   * Board-level tap dispatch (responsive hardening). The Canvas reports
   * taps in logical 360×240 coordinates; every tap resolves to the nearest
   * actionable target via the shared `resolveMapTap` transition, so
   * fat-finger taps near (but not exactly on) a 44px-intended target still
   * land deterministically. Threshold misses are no-ops. The native DOM
   * lists (inspect / corridors / crossings) invoke the same transitions,
   * so board taps and list taps are parity-equivalent by construction.
   * Keyboard/SR paths are untouched.
   */
  function handleBoardTap(tap: CircleIqBoardTap) {
    if (locked || finished) return;
    if (!Number.isFinite(tap.x) || !Number.isFinite(tap.y)) return;
    const pins = round.reveals
      .filter((r) => !scout.inspectedIds.includes(r.id) && scout.scoutsLeft > 0)
      .map((r) => ({ id: r.id, x: r.x, y: r.y, target: "scout" as const }));
    const crossingPins =
      previewOption !== null && previewOption.crossings
        ? previewOption.crossings.map((c) => ({ id: c.id, x: c.x, y: c.y, target: "crossing" as const }))
        : [];
    const corridors = displayOptions.map((o) => ({ optionId: o.id, points: o.route.points }));
    const hit = resolveMapTap([...pins, ...crossingPins], corridors, tap.x, tap.y);
    if (hit === null) return;
    if (hit.kind === "pin") inspect(hit.id);
    else if (hit.kind === "crossing") chooseCrossing(hit.id);
    else preview(hit.optionId);
  }

  function commit() {
    if (previewId === null || locked || finished) return;
    const option = displayOptions.find((o) => o.id === previewId);
    if (!option) return;
    // Move corridors need a crossing; Hold commits corridor-only.
    if (option.route.style !== "hold") {
      if (crossingId === null || !option.crossings?.some((c) => c.id === crossingId)) return;
    }
    const result = scorePick(round, previewId, false);
    setScoutsUsedAtCommit(SCOUTS_PER_ROUND - scout.scoutsLeft);
    setCommittedId(previewId);
    setCommittedCrossingId(option.route.style === "hold" ? null : crossingId);
    if (boardWrapRef.current && typeof boardWrapRef.current.scrollIntoView === "function") {
      boardWrapRef.current.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest" });
    }
    setStatusNote(
      option.route.style === "hold"
        ? `Committed to hold: ${option.label}.`
        : `Committed to route with crossing ${crossingForOption(round, previewId, crossingId ?? "")?.label ?? ""}.`,
    );
    setScoutsUsedAtCommit(SCOUTS_PER_ROUND - scout.scoutsLeft);
    setCommittedId(previewId);
    setConsequence(true);
    setAnsweredCount((c) => c + 1);
    if (result.isStrong) {
      setStrongReads((s) => s + 1);
    } else {
      setMisses((m) => [...m, { optionId: previewId, roundId: round.id }]);
    }
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVerdict(true), reducedMotion ? 0 : CONSEQUENCE_MS);
  }

  function clearRoundState() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setPreviewId(null);
    setCrossingId(null);
    setCommittedId(null);
    setCommittedCrossingId(null);
    setConsequence(false);
    setVerdict(false);
    setScout(createScoutState());
    setScoutsUsedAtCommit(0);
    setLastIntel(null);
    setStatusNote(null);
  }

  function next() {
    if (lastRound) {
      setFinished(true);
      return;
    }
    clearRoundState();
    setIndex((i) => i + 1);
  }

  function restart() {
    clearRoundState();
    setIndex(0);
    setStrongReads(0);
    setAnsweredCount(0);
    setMisses([]);
    setFinished(false);
  }

  function playAgain() {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setRunSeed(createRunSeed());
    setIndex(0);
    setPreviewId(null);
    setCrossingId(null);
    setCommittedId(null);
    setCommittedCrossingId(null);
    setConsequence(false);
    setVerdict(false);
    setStrongReads(0);
    setAnsweredCount(0);
    setMisses([]);
    setFinished(false);
    setScout(createScoutState());
    setScoutsUsedAtCommit(0);
    setLastIntel(null);
    setStatusNote(null);
  }

  if (finished && isComplete(answeredCount)) {
    const tendency = tendencyForMisses(misses.map((m) => m.optionId));
    const firstMissRound = tendency === null ? null : CIRCLE_IQ_ROUNDS.find((r) => r.id === misses[0]?.roundId) ?? null;
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Crosshair className="h-4 w-4 text-primary" aria-hidden /> Circle IQ complete
          </CardTitle>
          <CardDescription>
            {summary.score} of {summary.total} good reads — nothing saved, replay freely.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-4 sm:px-6">
          <div aria-live="polite" className="rounded-[12px] border border-primary/25 bg-primary/[0.06] p-5 text-center">
            <p className="font-mono text-[11px] tracking-widest text-primary-ink">FINAL READ</p>
            <p className="font-display mt-1 text-3xl font-normal tracking-tight">
              {summary.score} / {summary.total}
            </p>
            <p className="mt-1 text-sm font-semibold">{summary.heading}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{summary.body}</p>
          </div>
          <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed">
            <p className="font-mono text-[11px] tracking-widest text-primary-ink">YOUR TENDENCY</p>
            <p className="mt-1 font-medium">{tendencyLine(tendency)}</p>
            <p className="mt-2 rounded-[8px] border border-primary/20 bg-primary/[0.05] px-3 py-2">
              <span className="font-mono text-[11px] tracking-widest text-primary-ink">CARRY THIS FORWARD · </span>
              <span className="text-foreground">{firstMissRound?.principle ?? summary.body}</span>
            </p>
          </div>
          <ShareRow
            gameName="Circle IQ"
            score={summary.score}
            total={summary.total}
            shareText={
              getBgmiLabTool("circle-iq")?.shareText ?? "A free BGMI rotation drill — can you make the call?"
            }
            canonicalUrl={labAbsoluteUrl("/bgmi-lab/circle-iq")}
          />
          <button
            type="button"
            onClick={playAgain}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full sm:w-auto bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Play again
          </button>
          <p className="text-xs text-muted-foreground">New order, same 8 calls — nothing is predicted or saved.</p>
        </CardContent>
      </Card>
    );
  }

  const pulsedLandmark = (() => {
    if (!committedOption || consequenceKindFor(committedOption) !== "arrived") return null;
    if (committedOption.route.points.length === 0) return null;
    const end = committedOption.route.points[committedOption.route.points.length - 1]!;
    let best: CircleIqLandmark | null = null;
    let bestDist = Number.POSITIVE_INFINITY;
    for (const landmark of round.landmarks) {
      const dist = Math.hypot(landmark.x - end.x, landmark.y - end.y);
      if (dist < bestDist) {
        bestDist = dist;
        best = landmark;
      }
    }
    return best;
  })();

  const committedEnd =
    committedOption && committedOption.route.points.length > 0
      ? committedOption.route.points[committedOption.route.points.length - 1]!
      : null;
  const consequenceKind = committedOption ? consequenceKindFor(committedOption) : null;
  // V5 Hybrid: the crossing resolves the authored arrival. Hold (and any
  // legacy corridor without a crossing) reuses the legacy final frame.
  const crossingCons = committedOption ? consequenceForCrossing(committedOption, committedCrossing) : null;
  const crossingArrival = crossingCons?.arrival ?? null;
  const crossingPoint =
    committedCrossing !== null
      ? { x: committedCrossing.x, y: committedCrossing.y }
      : null;
  // Caught-open stops partway: the final frame must show WHERE the move died.
  const stopPoints =
    committedOption && consequenceKind === "caught-open" && committedOption.route.style !== "hold" && crossingArrival === null
      ? partialBoardPoints(committedOption.route.points, 0.55)
      : null;
  const stopEnd = stopPoints !== null && stopPoints.length > 0 ? stopPoints[stopPoints.length - 1]! : null;
  const legacyFinal =
    consequenceKind === "caught-open" ? stopEnd : consequenceKind === "arrived" ? committedEnd : null;
  const youFinal = crossingArrival ?? legacyFinal;
  const consequenceCopy = committedOption ? consequenceCopyFor(committedOption) : null;
  // Traversal polyline for the consequence beat: YOU → crossing → arrival.
  const traversalPoints: readonly CircleIqRoutePoint[] | null =
    consequence && committedOption && crossingPoint !== null && crossingArrival !== null
      ? [{ x: round.player.x, y: round.player.y }, crossingPoint, { x: crossingArrival.x, y: crossingArrival.y }]
      : null;

  const previewLetter =
    previewOption !== null ? (LETTERS[displayOptions.findIndex((o) => o.id === previewOption.id)] ?? "") : "";
  const crossingLetter =
    previewOption?.crossings && selectedCrossing
      ? (String.fromCharCode(65 + Math.max(0, previewOption.crossings.findIndex((c) => c.id === selectedCrossing.id))) ?? "")
      : "";

  return (
    <>
      {shared ? (
        <div className="mb-4">
          <SharedResultBanner gameName="Circle IQ" shared={shared} onDismiss={dismiss} />
        </div>
      ) : null}
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] tracking-widest text-primary-ink">
            ROUND {String(index + 1).padStart(2, "0")} / {String(roundQueue.length).padStart(2, "0")}
          </p>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground" aria-live="polite">
            {strongReads} GOOD {strongReads === 1 ? "READ" : "READS"}
          </p>
        </div>
        <div className="flex gap-1.5 pt-1" aria-hidden="true">
          {roundQueue.map((r, i) => (
            <span
              key={r.id}
              className={`h-1.5 flex-1 rounded-full ${i < index || (i === index && locked) ? "bg-primary" : "bg-border"}`}
            />
          ))}
        </div>
        <CardTitle className="pt-1 text-xl font-normal">{round.title}</CardTitle>
        <CardDescription className="leading-relaxed">{round.situation}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <div
          className="flex flex-wrap items-center gap-2 text-sm"
          role="status"
          aria-live="polite"
          aria-label={`${scout.scoutsLeft} of ${SCOUTS_PER_ROUND} scouts left`}
        >
          <span className="font-mono text-[11px] tracking-widest text-primary-ink">SCOUTS: {scout.scoutsLeft}</span>
          <span className="flex gap-1" aria-hidden="true">
            {Array.from({ length: SCOUTS_PER_ROUND }, (_, i) => (
              <span
                key={i}
                className={`inline-block size-3 rounded-full border ${
                  i < scout.scoutsLeft ? "border-primary bg-primary" : "border-border bg-border"
                }`}
              />
            ))}
          </span>
          <span className="text-xs text-muted-foreground">
            {locked ? "Locked after commit." : scout.scoutsLeft === 0 ? "No scouts left." : "Inspect up to two targets."}
          </span>
        </div>

        <figure ref={boardWrapRef} className="relative -mx-1 overflow-hidden rounded-[12px] border border-border bg-surface-muted/40 sm:mx-0">
          <CircleIqBoardCanvas
            round={round}
            routes={displayOptions.map((option) => {
              const active = previewId === option.id || committedId === option.id;
              const anyActive = previewId !== null || committedId !== null;
              return {
                option,
                dimmed: locked ? committedId !== option.id : anyActive && !active,
                highlighted: previewId === option.id && committedId === null,
                committed: committedId === option.id,
                committedStrong: committedId === option.id ? option.quality === "strong" : null,
              };
            })}
            scouts={round.reveals.map((reveal) => {
              const inspected = scout.inspectedIds.includes(reveal.id);
              return {
                id: reveal.id,
                x: reveal.x,
                y: reveal.y,
                inspected,
                disabled: locked || finished || (scout.scoutsLeft === 0 && !inspected),
              };
            })}
            crossings={
              previewOption?.crossings?.map((crossing, crossingIndex) => ({
                crossing,
                letter: String.fromCharCode(65 + crossingIndex),
                selected: (locked ? committedCrossingId : crossingId) === crossing.id,
                disabled: locked || finished,
              })) ?? []
            }
            previewPath={
              previewOption !== null && selectedCrossing !== null && !locked
                ? [
                    { x: round.player.x, y: round.player.y },
                    { x: selectedCrossing.x, y: selectedCrossing.y },
                    { x: selectedCrossing.arrival.x, y: selectedCrossing.arrival.y },
                  ]
                : null
            }
            previewArrival={
              !locked && selectedCrossing !== null
                ? { x: selectedCrossing.arrival.x, y: selectedCrossing.arrival.y }
                : null
            }
            consequence={
              consequence && committedOption
                ? {
                    kind: consequenceKind ?? "arrived",
                    traversal: traversalPoints,
                    crossingPoint,
                    arrival: crossingArrival,
                    spotted: crossingCons?.spotted ?? false,
                    stopPoints,
                    stopEnd,
                    youFinal,
                    pulseLandmarkId: pulsedLandmark?.id ?? null,
                  }
                : null
            }
            committedRoutePoints={committedOption?.route.points ?? []}
            boardLabel={
              locked
                ? verdict
                  ? "CONSEQUENCE"
                  : "COMMITTED — WATCH"
                : previewOption
                  ? "PREVIEW"
                  : "TACTICAL BOARD"
            }
            ariaLabel={`Tactical snapshot: ${round.title}. ${round.situation}`}
            reducedMotion={reducedMotion}
            onBoardTap={handleBoardTap}
          />
          <figcaption className="sr-only">
            Dashed circle marks the current zone, solid circle marks the next zone. Your position is marked YOU.{" "}
            {round.landmarks.map((l) => `${l.label} (${LANDMARK_KIND[l.type]})`).join(". ")}.
          </figcaption>
          {statusNote && !locked ? (
            <p aria-hidden="true" className="border-t border-border bg-card/70 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              {statusNote}
            </p>
          ) : null}
          {verdict && committedOption && consequenceCopy ? (
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-2 bottom-2 rounded-[10px] border border-border bg-card/95 p-2.5 shadow-md">
              <p className="font-mono text-[10px] tracking-widest text-primary-ink-ink">
                {committedOption.quality === "strong" ? "GOOD READ" : "RISKIER READ"} · {consequenceCopy.heading.toUpperCase()}
              </p>
              <p className="mt-0.5 text-[13px] font-medium leading-snug">{consequenceCopy.line}</p>
            </div>
          ) : null}
        </figure>

        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Diagram key">
          {round.landmarks.map((landmark) => (
            <li key={landmark.id}>
              <span className="font-mono font-bold">{landmark.label}</span> · {LANDMARK_KIND[landmark.type]}
            </li>
          ))}
          <li className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="-12 -12 24 24" aria-hidden="true">
              <rect x="-8" y="-8" width="16" height="16" rx="4" transform="rotate(45)" fill="var(--color-card)" stroke="var(--color-border-strong)" strokeWidth="2" />
            </svg>
            <span><span className="font-mono font-bold">A/B</span> · crossing point</span>
          </li>
          <li className="flex items-center gap-1.5">
            <svg width="14" height="14" viewBox="-12 -12 24 24" aria-hidden="true">
              <circle cx="0" cy="0" r="6" fill="none" stroke="var(--color-foreground)" strokeWidth="2" strokeDasharray="3 3" />
            </svg>
            <span><span className="font-mono font-bold">Ring</span> · arrival mark</span>
          </li>
        </ul>

        <section aria-label="Investigate">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="font-mono text-[11px] tracking-widest text-primary-ink">INSPECT</h3>
            <p className="text-xs text-muted-foreground">
              {locked ? "Scouting locked after commit." : "Two facts you can uncover before committing."}
            </p>
          </div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {round.reveals.map((reveal) => {
              const inspected = scout.inspectedIds.includes(reveal.id);
              const disabled = locked || finished || (!inspected && scout.scoutsLeft === 0);
              return (
                <div key={reveal.id} className={`rounded-[12px] border px-3 py-2 ${inspected ? "border-primary/40 bg-primary/[0.05]" : "border-border bg-card"}`}>
                  <button
                    type="button"
                    onClick={() => inspect(reveal.id)}
                    disabled={disabled}
                    aria-pressed={inspected}
                    aria-label={
                      inspected
                        ? `${reveal.title}, inspected. ${reveal.intel}`
                        : `Inspect ${reveal.title}${disabled && !locked ? ", no scouts left" : ""}`
                    }
                    className="flex min-h-[44px] w-full items-center gap-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span
                      aria-hidden="true"
                      className={`flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
                        inspected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-muted-foreground"
                      }`}
                    >
                      {inspected ? "✓" : "?"}
                    </span>
                    <span className="font-medium">{reveal.title}</span>
                    <span className="ml-auto font-mono text-[10px] tracking-widest text-muted-foreground">
                      {inspected ? "FOUND" : scout.scoutsLeft === 0 ? "—" : "1 SCOUT"}
                    </span>
                  </button>
                  {inspected ? (
                    <p className="pb-1 pl-8 pr-1 text-sm leading-relaxed text-muted-foreground">{reveal.intel}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
          <p aria-live="polite" className="sr-only">
            {statusNote ?? lastIntel ?? `${scout.scoutsLeft} of ${SCOUTS_PER_ROUND} scouts left.`}
          </p>
        </section>

        <p className="text-sm font-semibold leading-relaxed">{round.question}</p>
        <div className="grid gap-2" role="group" aria-label="Rotation options">
          {displayOptions.map((option, optionIndex) => {
            const selected = previewId === option.id || committedId === option.id;
            const isStrong = option.quality === "strong";
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => preview(option.id)}
                disabled={locked}
                aria-pressed={selected}
                aria-label={`Option ${LETTERS[optionIndex] ?? optionIndex + 1}: ${option.label}`}
                className={`flex min-h-[44px] items-start gap-3 rounded-[12px] border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  locked && isStrong
                    ? "border-success/40 bg-success-soft"
                    : locked && selected
                      ? "border-destructive/40 bg-destructive-soft"
                      : selected
                        ? "border-primary/50 bg-primary/[0.06]"
                        : "border-border bg-card hover:bg-muted"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-mono text-xs font-bold ${
                    locked && isStrong
                      ? "border-success/50 bg-success text-success-foreground"
                      : "border-border-strong bg-card text-foreground"
                  }`}
                >
                  {LETTERS[optionIndex] ?? optionIndex + 1}
                </span>
                <span className="leading-relaxed">{option.label}</span>
              </button>
            );
          })}
        </div>

        {previewOption && previewOption.crossings && previewOption.crossings.length > 0 && !locked ? (
          <section aria-label="Crossings">
            <div className="flex items-baseline justify-between gap-2">
              <h3 className="font-mono text-[11px] tracking-widest text-primary-ink">CROSS WHERE?</h3>
              <p className="text-xs text-muted-foreground">
                {selectedCrossing ? `${selectedCrossing.label} — arrival marked on the map.` : "Pick where along this route to cross."}
              </p>
            </div>
            <div className="mt-2 grid gap-2" role="group" aria-label="Crossing points">
              {previewOption.crossings.map((crossing, crossingIndex) => {
                const letter = String.fromCharCode(65 + crossingIndex);
                const active = crossingId === crossing.id;
                return (
                  <div
                    key={crossing.id}
                    className={`rounded-[12px] border px-3 py-2 ${active ? "border-primary/40 bg-primary/[0.05]" : "border-border bg-card"}`}
                  >
                    <button
                      type="button"
                      onClick={() => chooseCrossing(crossing.id)}
                      aria-pressed={active}
                      aria-label={`Crossing ${letter}: ${crossing.label}. ${crossing.intel} Preview the crossing.`}
                      className="flex min-h-[44px] w-full items-center gap-2 text-left text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <span
                        aria-hidden="true"
                        className={`flex size-6 shrink-0 items-center justify-center rounded-[6px] border font-mono text-xs font-bold ${
                          active ? "border-primary bg-primary text-primary-foreground" : "border-border-strong text-muted-foreground"
                        }`}
                      >
                        {letter}
                      </span>
                      <span className="font-medium">{crossing.label}</span>
                      <span className="ml-auto font-mono text-[10px] tracking-widest text-muted-foreground">
                        {active ? "SET" : "CROSS"}
                      </span>
                    </button>
                    {active ? (
                      <p className="pb-1 pl-8 pr-1 text-sm leading-relaxed text-muted-foreground">
                        {crossing.intel} Arrival marked on the map.
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        {previewOption && !locked ? (
          <p aria-live="polite" className="rounded-[8px] border border-foreground/25 bg-card px-3 py-2 text-sm">
            <span className="font-mono text-[11px] tracking-widest text-primary-ink">
              CALL · ROUTE {previewLetter} ·{" "}
              {selectedCrossing ? (
                <>CROSSING {crossingLetter} · </>
              ) : null}
            </span>{" "}
            <span className="text-foreground">{previewOption.route.caption}</span>{" "}
            <span className="text-muted-foreground">
              {previewIsHold || selectedCrossing ? "Lock it, or pick another line." : "Pick a crossing on the board or list to finish the call."}
            </span>
          </p>
        ) : null}

        {!locked ? (
          <div className="flex">
            <button
              type="button"
              onClick={commit}
              disabled={previewOption === null || (!previewIsHold && selectedCrossing === null)}
              className="inline-flex min-h-[44px] w-auto items-center justify-center gap-1.5 rounded-[10px] bg-foreground px-5 text-sm font-semibold text-background hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
            >
              Lock the call <ArrowRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        ) : null}

        {consequence && committedOption && consequenceCopy ? (
          <div
            ref={verdict ? undefined : consequenceRef}
            tabIndex={-1}
            aria-live="polite"
            aria-label={`Consequence: ${consequenceCopy.line}`}
            className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed focus:outline-none"
          >
            <p className="font-mono text-[11px] tracking-widest text-primary-ink">CONSEQUENCE · {consequenceCopy.heading.toUpperCase()}</p>
            <p className="mt-1 text-foreground">{consequenceCopy.line}</p>
            {crossingCons?.spotted && committedCrossing ? (
              <p className="mt-1 font-semibold text-foreground">Spotted at {committedCrossing.label} — the crossing draws fire.</p>
            ) : null}
            {crossingCons?.note && committedCrossing ? (
              <p className="mt-1 text-muted-foreground">
                You crossed at {committedCrossing.label}. {crossingCons.note}
              </p>
            ) : null}
          </div>
        ) : null}

        {verdict && committedOption ? (
          <div
            ref={verdictRef}
            tabIndex={-1}
            aria-live="polite"
            className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed focus:outline-none"
          >
            <p>
              {committedOption.quality === "strong" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-deep px-2.5 py-0.5 text-xs font-semibold leading-none text-white">
                  Good read
                </span>
              ) : (
                <Badge variant="secondary">Riskier read</Badge>
              )}
            </p>
            {committedCrossing && crossingCons?.note ? (
              <p className="mt-2 text-foreground">
                You crossed at {committedCrossing.label} and {committedCrossing.exposure === "low" ? "held the move together" : "paid for the crossing"}. {crossingCons.note}
              </p>
            ) : null}
            <p className="mt-2 font-medium">Why:</p>
            <p className="mt-1 text-muted-foreground">{committedOption.explanation}</p>
            <p className="mt-3 rounded-[8px] border border-primary/20 bg-primary/[0.05] px-3 py-2">
              <span className="font-mono text-[11px] tracking-widest text-primary-ink">READ THIS · </span>
              <span className="text-foreground">{round.principle}</span>
            </p>
            <p className="mt-2 font-mono text-[11px] tracking-widest text-muted-foreground">
              SCOUT NOTE · {scoutNote(scoutsUsedAtCommit)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full sm:w-auto bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {lastRound ? "See result" : "Next round"} <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={restart}
                className="inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full sm:w-auto border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Restart
              </button>
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Synthetic practice scenario — nothing is predicted. Nothing is saved; replay freely.
        </p>
      </CardContent>
    </Card>
    </>
  );
}
