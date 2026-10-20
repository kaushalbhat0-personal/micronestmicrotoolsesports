"use client";

import * as React from "react";
import { ArrowRight, Crosshair, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CIRCLE_IQ_ROUNDS,
  createRunSeed,
  isComplete,
  orderOptionsForRound,
  orderRoundsForRun,
  scorePick,
  summarizeScore,
  tendencyForMisses,
  tendencyLine,
  type CircleIqLandmark,
  type CircleIqOption,
  type CircleIqRoutePoint,
} from "../data/circle-iq-logic";
import { ShareRow } from "./share-row";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { labAbsoluteUrl } from "@/lib/marketing/public-tool-content";

/**
 * Circle IQ — super-interactive replayable gameplay (V3).
 *
 * STUDY → PREVIEW → COMMIT → CONSEQUENCE → VERDICT → NEXT.
 * Eight authored synthetic rounds in a seeded per-run order with seeded
 * per-round option display order. Tapping a route or an answer button only
 * previews (no scoring); "Commit to this call" locks the round, plays a
 * lightweight SVG/CSS consequence, then reveals verdict + principle.
 * Ephemeral state only (no account, no persistence, no analytics). Lives
 * inside AdSafeGameLayout; renders no ads and nothing resembling one.
 *
 * Scoring is always by authored option ID — A/B/C letters are display-only.
 */

const LETTERS = ["A", "B", "C"] as const;

/** Consequence beat length. Verdict reveal is timer-gated; reduced motion uses 0ms. */
const CONSEQUENCE_MS = 750;

const LANDMARK_KIND: Record<CircleIqLandmark["type"], string> = {
  ridge: "high ground",
  compound: "buildings",
  open: "exposed ground",
  road: "road",
  cover: "natural cover",
  water: "water",
};

function routePathD(points: readonly CircleIqRoutePoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function LandmarkShape({ landmark, pulse }: { landmark: CircleIqLandmark; pulse: boolean }) {
  const { x, y, type } = landmark;
  const body = (() => {
    switch (type) {
      case "ridge":
        return (
          <g aria-hidden="true">
            <path
              d={`M ${x - 30} ${y + 12} L ${x} ${y - 14} L ${x + 30} ${y + 12} Z`}
              fill="var(--color-surface-muted)"
              stroke="var(--color-border-strong)"
              strokeWidth="1.5"
            />
            <circle cx={x} cy={y - 4} r="2.5" fill="var(--color-foreground-muted)" />
          </g>
        );
      case "compound":
        return (
          <g aria-hidden="true">
            <rect
              x={x - 12}
              y={y - 12}
              width="24"
              height="24"
              rx="3"
              fill="var(--color-surface-muted)"
              stroke="var(--color-border-strong)"
              strokeWidth="1.5"
            />
            <path d={`M ${x - 12} ${y - 2} L ${x} ${y - 12} L ${x + 12} ${y - 2}`} fill="none" stroke="var(--color-border-strong)" strokeWidth="1.5" />
          </g>
        );
      case "open":
        return (
          <ellipse
            aria-hidden="true"
            cx={x}
            cy={y}
            rx="42"
            ry="24"
            fill="none"
            stroke="var(--color-destructive)"
            strokeWidth="1.5"
            strokeDasharray="5 5"
            opacity="0.55"
          />
        );
      case "road":
        return (
          <line
            aria-hidden="true"
            x1={x - 45}
            y1={y + 18}
            x2={x + 45}
            y2={y - 18}
            stroke="var(--color-border-strong)"
            strokeWidth="3"
            strokeDasharray="8 5"
            opacity="0.7"
          />
        );
      case "cover":
        return (
          <g aria-hidden="true" fill="var(--color-primary)" opacity="0.45">
            <circle cx={x - 8} cy={y + 4} r="7" />
            <circle cx={x + 7} cy={y - 3} r="9" />
            <circle cx={x + 1} cy={y + 8} r="5" />
          </g>
        );
      case "water":
        return <ellipse aria-hidden="true" cx={x} cy={y} rx="30" ry="16" fill="var(--color-info)" opacity="0.3" />;
    }
  })();
  if (!pulse) return body;
  return <g className="ciq-landmark-pulse">{body}</g>;
}

function RouteOverlay({
  option,
  displayIndex,
  dimmed,
  highlighted,
  committed,
  onPreview,
}: {
  option: CircleIqOption;
  displayIndex: number;
  dimmed: boolean;
  highlighted: boolean;
  committed: boolean;
  onPreview: (optionId: string) => void;
}) {
  const { route } = option;
  const stroke = route.style === "covered" ? "var(--color-primary)" : route.style === "open" ? "var(--color-destructive)" : "var(--color-foreground-muted)";
  const opacity = committed ? 1 : highlighted ? 1 : dimmed ? 0.22 : 0.55;
  const letter = LETTERS[displayIndex] ?? displayIndex + 1;
  if (route.style === "hold") {
    const at = route.points[0]!;
    return (
      <g opacity={opacity}>
        <circle
          cx={at.x}
          cy={at.y}
          r="16"
          fill="none"
          stroke={stroke}
          strokeWidth={highlighted || committed ? 2.5 : 1.5}
          strokeDasharray="5 4"
        />
        <path
          d={`M ${at.x - 14} ${at.y - 14} L ${at.x + 14} ${at.y + 14} M ${at.x - 14} ${at.y - 14} L ${at.x + 14} ${at.y + 14}`}
          stroke="transparent"
          strokeWidth="24"
          pointerEvents="stroke"
          style={{ cursor: "pointer" }}
          onClick={() => onPreview(option.id)}
        >
          <title>{`Preview option ${letter}`}</title>
        </path>
      </g>
    );
  }
  const d = routePathD(route.points);
  const end = route.points[route.points.length - 1]!;
  return (
    <g opacity={opacity}>
      <path d={d} fill="none" stroke={stroke} strokeWidth={highlighted || committed ? 3 : 2} strokeLinecap="round" />
      <circle cx={end.x} cy={end.y} r="3.5" fill={stroke} />
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth="22"
        pointerEvents="stroke"
        style={{ cursor: "pointer" }}
        onClick={() => onPreview(option.id)}
      >
        <title>{`Preview option ${letter}`}</title>
      </path>
    </g>
  );
}

export function CircleIqShell() {
  // Seed starts null so the server and the first client render agree
  // (seed 0, authored order) — hydration-safe. A real ephemeral seed is
  // installed in an effect after mount, so every interactive run shuffles.
  const [runSeed, setRunSeed] = React.useState<number | null>(null);
  const seed = runSeed ?? 0;
  const roundQueue = React.useMemo(() => orderRoundsForRun(CIRCLE_IQ_ROUNDS, seed), [seed]);
  const [index, setIndex] = React.useState(0);
  const [previewId, setPreviewId] = React.useState<string | null>(null);
  const [committedId, setCommittedId] = React.useState<string | null>(null);
  const [consequence, setConsequence] = React.useState(false);
  const [verdict, setVerdict] = React.useState(false);
  const [strongReads, setStrongReads] = React.useState(0);
  const [answeredCount, setAnsweredCount] = React.useState(0);
  const [misses, setMisses] = React.useState<readonly { optionId: string; roundId: string }[]>([]);
  const [finished, setFinished] = React.useState(false);
  const [reducedMotion, setReducedMotion] = React.useState(false);
  const verdictRef = React.useRef<HTMLDivElement>(null);
  const commitRef = React.useRef<HTMLButtonElement>(null);
  const consequenceRef = React.useRef<HTMLDivElement>(null);
  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const round = roundQueue[index % roundQueue.length]!;
  const displayOptions = React.useMemo(() => orderOptionsForRound(round, seed, index), [round, seed, index]);
  const previewOption = displayOptions.find((o) => o.id === previewId) ?? null;
  const committedOption = displayOptions.find((o) => o.id === committedId) ?? null;
  const lastRound = index === roundQueue.length - 1;
  const summary = summarizeScore(strongReads);
  const locked = committedId !== null;

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

  function preview(optionId: string) {
    if (locked || finished) return;
    setPreviewId(optionId);
  }

  function commit() {
    if (previewId === null || locked || finished) return;
    const result = scorePick(round, previewId, false);
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
    setCommittedId(null);
    setConsequence(false);
    setVerdict(false);
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
    setCommittedId(null);
    setConsequence(false);
    setVerdict(false);
    setStrongReads(0);
    setAnsweredCount(0);
    setMisses([]);
    setFinished(false);
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
        <CardContent className="space-y-4">
          <div aria-live="polite" className="rounded-[12px] border border-primary/25 bg-primary/[0.06] p-5 text-center">
            <p className="font-mono text-[11px] tracking-widest text-primary">FINAL READ</p>
            <p className="font-display mt-1 text-3xl font-normal tracking-tight">
              {summary.score} / {summary.total}
            </p>
            <p className="mt-1 text-sm font-semibold">{summary.heading}</p>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{summary.body}</p>
          </div>
          <div className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed">
            <p className="font-mono text-[11px] tracking-widest text-primary">YOUR TENDENCY</p>
            <p className="mt-1 font-medium">{tendencyLine(tendency)}</p>
            <p className="mt-2 rounded-[8px] border border-primary/20 bg-primary/[0.05] px-3 py-2">
              <span className="font-mono text-[11px] tracking-widest text-primary">CARRY THIS FORWARD · </span>
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
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Play again
          </button>
          <p className="text-xs text-muted-foreground">New order, same 8 calls — nothing is predicted or saved.</p>
        </CardContent>
      </Card>
    );
  }

  const pulsedLandmark = (() => {
    const active = committedOption ?? previewOption;
    if (!active || active.route.points.length === 0) return null;
    const end = active.route.points[active.route.points.length - 1]!;
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
  const youDelta =
    committedEnd !== null ? { dx: committedEnd.x - round.player.x, dy: committedEnd.y - round.player.y } : null;

  return (
    <Card>
      <style>{`@keyframes ciq-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes ciq-pulse{0%,100%{opacity:1}50%{opacity:.15}}@keyframes ciq-you{from{transform:translate(var(--ciq-dx,0px),var(--ciq-dy,0px))}to{transform:translate(0px,0px)}}@keyframes ciq-landmark{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}.ciq-route-draw{stroke-dasharray:1;animation:ciq-draw 700ms ease forwards}.ciq-exposure{animation:ciq-pulse 750ms ease-in-out 2}.ciq-you-move{animation:ciq-you 700ms ease forwards}.ciq-landmark-pulse{transform-box:fill-box;transform-origin:center;animation:ciq-landmark 700ms ease}@media (prefers-reduced-motion:reduce){.ciq-route-draw,.ciq-exposure,.ciq-you-move,.ciq-landmark-pulse{animation:none}}`}</style>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] tracking-widest text-primary">
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
      <CardContent className="space-y-4">
        <figure className="overflow-hidden rounded-[12px] border border-border bg-surface-muted/40">
          <svg viewBox="0 0 360 240" className="h-auto w-full max-h-[240px]" role="img" aria-label={`Tactical snapshot: ${round.title}. ${round.situation}`}>
            <circle
              cx={round.zone.center.x}
              cy={round.zone.center.y}
              r={round.zone.radius}
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="1.5"
              strokeDasharray="7 6"
              opacity={locked ? 0.25 : 0.7}
              style={{ transition: "opacity 700ms ease" }}
            />
            <circle cx={round.next.center.x} cy={round.next.center.y} r={round.next.radius} fill="var(--color-primary)" opacity={locked ? 0.16 : 0.07} style={{ transition: "opacity 700ms ease" }} />
            <circle
              cx={round.next.center.x}
              cy={round.next.center.y}
              r={round.next.radius}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
            />
            {round.landmarks.map((landmark) => (
              <LandmarkShape key={landmark.id} landmark={landmark} pulse={pulsedLandmark?.id === landmark.id} />
            ))}
            {displayOptions.map((option, optionIndex) => {
              const active = previewId === option.id || committedId === option.id;
              const anyActive = previewId !== null || committedId !== null;
              return (
                <RouteOverlay
                  key={option.id}
                  option={option}
                  displayIndex={optionIndex}
                  dimmed={anyActive && !active}
                  highlighted={previewId === option.id && committedId === null}
                  committed={committedId === option.id}
                  onPreview={preview}
                />
              );
            })}
            {consequence && committedOption && committedOption.route.style !== "hold" ? (
              <g aria-hidden="true">
                <path
                  d={routePathD(committedOption.route.points)}
                  fill="none"
                  stroke={committedOption.route.style === "covered" ? "var(--color-primary)" : "var(--color-destructive)"}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDashoffset={0}
                  className={reducedMotion ? undefined : "ciq-route-draw"}
                />
                {committedOption.route.style === "open" ? (
                  <path
                    d={routePathD(committedOption.route.points)}
                    fill="none"
                    stroke="var(--color-destructive)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    opacity="0.35"
                    className={reducedMotion ? undefined : "ciq-exposure"}
                  />
                ) : null}
              </g>
            ) : null}
            <circle cx={round.player.x} cy={round.player.y} r="11" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.4" />
            {youDelta !== null && consequence ? (
              <circle
                cx={committedEnd!.x}
                cy={committedEnd!.y}
                r="6"
                fill="var(--color-primary)"
                className={reducedMotion ? undefined : "ciq-you-move"}
                style={{ ["--ciq-dx" as string]: `${round.player.x - committedEnd!.x}px`, ["--ciq-dy" as string]: `${round.player.y - committedEnd!.y}px` }}
              />
            ) : (
              <circle cx={round.player.x} cy={round.player.y} r="6" fill="var(--color-primary)" />
            )}
            {round.landmarks.map((landmark) => (
              <text
                key={`${landmark.id}-label`}
                x={Math.min(Math.max(landmark.x, 52), 308)}
                y={landmark.y + 30}
                textAnchor="middle"
                fontSize="9"
                fill="var(--color-foreground-muted)"
                fontFamily="monospace"
                letterSpacing="1"
              >
                {landmark.label.toUpperCase().slice(0, 20)}
              </text>
            ))}
            <text x={round.player.x} y={round.player.y - 18} textAnchor="middle" fontSize="10" fill="var(--color-foreground-muted)" fontFamily="monospace" letterSpacing="2">
              YOU
            </text>
            <text x={round.next.center.x} y={round.next.center.y + 3} textAnchor="middle" fontSize="10" fill="var(--color-primary)" fontFamily="monospace" letterSpacing="2">
              NEXT
            </text>
          </svg>
          <figcaption className="sr-only">
            Dashed circle marks the current zone, solid circle marks the next zone. Your position is marked YOU.{" "}
            {round.landmarks.map((l) => `${l.label} (${LANDMARK_KIND[l.type]})`).join(". ")}.
          </figcaption>
        </figure>

        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Diagram key">
          {round.landmarks.map((landmark) => (
            <li key={landmark.id}>
              <span className="font-mono font-bold">{landmark.label}</span> · {LANDMARK_KIND[landmark.type]}
            </li>
          ))}
        </ul>

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

        {previewOption && !locked ? (
          <p aria-live="polite" className="rounded-[8px] border border-primary/20 bg-primary/[0.05] px-3 py-2 text-sm">
            <span className="font-mono text-[11px] tracking-widest text-primary">PREVIEW · </span>
            <span className="text-foreground">{previewOption.route.caption}</span>
            <span className="text-muted-foreground"> Commit to lock this call, or pick another line.</span>
          </p>
        ) : null}

        {!locked ? (
          <button
            ref={commitRef}
            type="button"
            onClick={commit}
            disabled={previewOption === null}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            Commit to this call <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        ) : null}

        {consequence && committedOption ? (
          <div
            ref={verdict ? undefined : consequenceRef}
            tabIndex={-1}
            aria-live="polite"
            className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed focus:outline-none"
          >
            <p className="font-mono text-[11px] tracking-widest text-primary">CONSEQUENCE</p>
            <p className="mt-1 text-muted-foreground">
              {committedOption.route.caption} The zone tightens toward NEXT.
            </p>
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
              <Badge variant={committedOption.quality === "strong" ? "success" : "secondary"}>
                {committedOption.quality === "strong" ? "Good read" : "Riskier read"}
              </Badge>
            </p>
            <p className="mt-2 font-medium">Why:</p>
            <p className="mt-1 text-muted-foreground">{committedOption.explanation}</p>
            <p className="mt-3 rounded-[8px] border border-primary/20 bg-primary/[0.05] px-3 py-2">
              <span className="font-mono text-[11px] tracking-widest text-primary">READ THIS · </span>
              <span className="text-foreground">{round.principle}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {lastRound ? "See result" : "Next round"} <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button
                type="button"
                onClick={restart}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  );
}
