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
  type CircleIqCrossing,
  type CircleIqLandmark,
  type CircleIqOption,
  type CircleIqReveal,
  type CircleIqRoutePoint,
} from "../data/circle-iq-logic";
import { ShareRow } from "./share-row";
import { SharedResultBanner, useSharedLabResult } from "./shared-result-banner";
import { getBgmiLabTool } from "@/config/public/bgmi-lab";
import { labAbsoluteUrl } from "@/lib/marketing/public-tool-content";

/**
 * Circle IQ — super-interactive replayable gameplay (V5 Hybrid).
 *
 * INVESTIGATE → SELECT CORRIDOR → SELECT CROSSING → PREVIEW → COMMIT →
 * CONSEQUENCE → DEBRIEF. Eight authored synthetic rounds in a seeded
 * per-run order with seeded per-round option display order. Each round
 * grants 2 scouts to inspect authored map targets (facts only, never a
 * verdict). Tapping a corridor previews NEUTRAL geometry; the map then
 * reveals that corridor's authored crossing pins (A/B…) and the matching
 * native crossing list. Selecting a crossing draws YOU → crossing →
 * authored arrival neutrally. "Commit to this call" locks corridor +
 * crossing + scouting, plays a crossing-aware SVG/CSS consequence
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

function routePathD(points: readonly CircleIqRoutePoint[]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

/** Cut a polyline at `fraction` of its length — the caught-open stop point. */
function partialPoints(points: readonly CircleIqRoutePoint[], fraction: number): CircleIqRoutePoint[] {
  if (points.length < 2) return [...points];
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const lengths: number[] = [];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i]!.x - points[i - 1]!.x;
    const dy = points[i]!.y - points[i - 1]!.y;
    const len = Math.hypot(dx, dy);
    lengths.push(len);
    total += len;
  }
  if (total === 0) return [points[0]!];
  const target = total * clamped;
  const out: CircleIqRoutePoint[] = [points[0]!];
  let walked = 0;
  for (let i = 1; i < points.length; i++) {
    const seg = lengths[i - 1]!;
    if (walked + seg >= target) {
      const t = seg === 0 ? 0 : (target - walked) / seg;
      out.push({
        x: points[i - 1]!.x + (points[i]!.x - points[i - 1]!.x) * t,
        y: points[i - 1]!.y + (points[i]!.y - points[i - 1]!.y) * t,
      });
      return out;
    }
    walked += seg;
    out.push(points[i]!);
  }
  return out;
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
            stroke="var(--color-border-strong)"
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

function ScoutTarget({
  reveal,
  inspected,
  disabled,
  scoutsLeft,
  onInspect,
}: {
  reveal: CircleIqReveal;
  inspected: boolean;
  disabled: boolean;
  scoutsLeft: number;
  onInspect: (revealId: string) => void;
}) {
  const actionable = !inspected && !disabled;
  return (
    <g
      transform={`translate(${reveal.x} ${reveal.y})`}
      tabIndex={actionable || inspected ? 0 : -1}
      role="button"
      data-map-target="pin"
      aria-label={
        inspected
          ? `Inspected: ${reveal.title}. ${reveal.intel}`
          : `Inspect ${reveal.title}. ${scoutsLeft} ${scoutsLeft === 1 ? "scout" : "scouts"} left.`
      }
      aria-pressed={inspected}
      aria-disabled={!actionable && !inspected}
      className="ciq-scout"
      style={{ cursor: actionable ? "pointer" : "default", outline: "none" }}
      onClick={() => onInspect(reveal.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onInspect(reveal.id);
        }
      }}
    >
      <title>{inspected ? `${reveal.title} (inspected)` : `Inspect ${reveal.title}`}</title>
      {/* >=44px interaction area */}
      <circle cx="0" cy="0" r="22" fill="transparent" pointerEvents="all" />
      {/* Visible focus ring (keyboard) */}
      <circle
        cx="0"
        cy="0"
        r="17"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeDasharray="3 3"
        className="ciq-scout-focus"
        opacity="0"
        pointerEvents="none"
      />
      {/* State ring: solid + check when inspected, dashed + ? otherwise. Never color alone. */}
      <circle
        cx="0"
        cy="0"
        r="13"
        fill="var(--color-card)"
        stroke={inspected ? "var(--color-primary)" : "var(--color-border-strong)"}
        strokeWidth={inspected ? 2.5 : 2}
        strokeDasharray={inspected ? undefined : "4 3"}
        opacity={disabled && !inspected ? 0.45 : 1}
        pointerEvents="none"
      />
      <text
        x="0"
        y="4.5"
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        fill={inspected ? "var(--color-primary-ink)" : "var(--color-foreground-muted)"}
        pointerEvents="none"
        aria-hidden="true"
      >
        {inspected ? "✓" : "?"}
      </text>
    </g>
  );
}

function CrossingPin({
  crossing,
  letter,
  selected,
  disabled,
  onSelect,
}: {
  crossing: CircleIqCrossing;
  letter: string;
  selected: boolean;
  disabled: boolean;
  onSelect: (crossingId: string) => void;
}) {
  const actionable = !disabled;
  const activate = () => onSelect(crossing.id);
  return (
    <g
      transform={`translate(${crossing.x} ${crossing.y})`}
      tabIndex={actionable || selected ? 0 : -1}
      role="button"
      data-map-target="crossing"
      aria-label={`Crossing ${letter}: ${crossing.label}. ${crossing.intel} Preview the crossing.`}
      aria-pressed={selected}
      aria-disabled={disabled}
      className="ciq-crossing"
      style={{ cursor: actionable ? "pointer" : "default", outline: "none" }}
      onClick={activate}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activate();
        }
      }}
    >
      <title>{`Crossing ${letter}: ${crossing.label}`}</title>
      {/* >=44px interaction area — taps resolve via viewBox dispatch */}
      <circle cx="0" cy="0" r="22" fill="transparent" pointerEvents="all" />
      <circle
        cx="0"
        cy="0"
        r="17"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2"
        strokeDasharray="3 3"
        className="ciq-crossing-focus"
        opacity="0"
        pointerEvents="none"
      />
      {/* Diamond pin with letter glyph — distinct from round scout pins. */}
      <rect
        x="-12"
        y="-12"
        width="24"
        height="24"
        rx="6"
        transform="rotate(45)"
        fill={selected ? "var(--color-foreground)" : "var(--color-card)"}
        stroke={selected ? "var(--color-foreground)" : "var(--color-border-strong)"}
        strokeWidth={selected ? 2.5 : 2}
        opacity={disabled && !selected ? 0.45 : 1}
        pointerEvents="none"
      />
      <text
        x="0"
        y="4.5"
        textAnchor="middle"
        fontSize="11"
        fontWeight="bold"
        fill={selected ? "var(--color-card)" : "var(--color-foreground-muted)"}
        pointerEvents="none"
        aria-hidden="true"
      >
        {letter}
      </text>
    </g>
  );
}

function RouteOverlay({
  option,
  displayIndex,
  dimmed,
  highlighted,
  committed,
  committedStrong,
  onPreview,
}: {
  option: CircleIqOption;
  displayIndex: number;
  dimmed: boolean;
  highlighted: boolean;
  committed: boolean;
  committedStrong: boolean | null;
  onPreview: (optionId: string) => void;
}) {
  const { route } = option;
  const [focused, setFocused] = React.useState(false);
  // V4 neutral preview: BEFORE commit every line uses the same neutral tone.
  // Quality colors (primary/destructive) appear only on the committed line.
  const stroke = committed
    ? committedStrong === true
      ? "var(--color-primary)"
      : "var(--color-destructive)"
    : highlighted || focused
      ? "var(--color-foreground)"
      : "var(--color-border-strong)";
  const opacity = committed ? 1 : highlighted || focused ? 1 : dimmed ? 0.22 : 0.6;
  const width = committed || highlighted || focused ? 3.5 : 2;
  const letter = LETTERS[displayIndex] ?? displayIndex + 1;
  const label = `Preview route ${letter}`;
  const activate = () => onPreview(option.id);
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
          strokeWidth={width}
          strokeDasharray="5 4"
        />
        <g
          tabIndex={committed ? -1 : 0}
          role="button"
          data-map-target="corridor"
          aria-label={label}
          className="ciq-route-target"
          style={{ cursor: committed ? "default" : "pointer", outline: "none" }}
          onClick={activate}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              activate();
            }
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        >
          <title>{label}</title>
          <circle cx={at.x} cy={at.y} r="22" fill="transparent" pointerEvents="all" />
          {focused && !committed ? (
            <circle cx={at.x} cy={at.y} r="20" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeDasharray="3 3" pointerEvents="none" />
          ) : null}
        </g>
      </g>
    );
  }
  const d = routePathD(route.points);
  const end = route.points[route.points.length - 1]!;
  const laneOpen = option.route.style === "open" && !committed;
  const laneCovered = option.route.style === "covered" && !committed;
  return (
    <g opacity={opacity}>
      {option.route.style === "open" && !committed ? (
        <path d={d} fill="none" stroke="var(--color-foreground)" strokeWidth="9" strokeLinecap="round" opacity="0.06" pointerEvents="none" />
      ) : null}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={laneOpen ? "7 4" : undefined}
      />
      {laneCovered ? (
        <path
          d={d}
          fill="none"
          stroke="url(#ciq-hatch)"
          strokeWidth="8"
          strokeLinecap="round"
          opacity={highlighted || focused ? 0.85 : 0.5}
          pointerEvents="none"
        />
      ) : null}
      <circle cx={end.x} cy={end.y} r="3.5" fill={stroke} />
      <g
        tabIndex={committed ? -1 : 0}
        role="button"
        data-map-target="corridor"
        aria-label={label}
        className="ciq-route-target"
        style={{ cursor: committed ? "default" : "pointer", outline: "none" }}
        onClick={activate}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
          }
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
      >
        <title>{label}</title>
        <path d={d} fill="none" stroke="transparent" strokeWidth="24" pointerEvents="stroke" />
      </g>
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
  const svgRef = React.useRef<SVGSVGElement | null>(null);
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
   * Map-level tap dispatch (responsive hardening). Direct hits on pins /
   * corridors are handled by their own controls (guarded via
   * data-map-target); taps landing anywhere else resolve to the nearest
   * actionable target in viewBox space, so fat-finger taps near (but not
   * exactly on) a 44px-intended target still land deterministically.
   * Threshold misses are no-ops. Keyboard/SR paths are untouched.
   */
  function handleMapTap(event: React.MouseEvent<SVGSVGElement>) {
    if (locked || finished) return;
    if (event.target instanceof Element && event.target.closest("[data-map-target]") !== null) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const x = ((event.clientX - rect.left) / rect.width) * 360;
    const y = ((event.clientY - rect.top) / rect.height) * 240;
    const pins = round.reveals
      .filter((r) => !scout.inspectedIds.includes(r.id) && scout.scoutsLeft > 0)
      .map((r) => ({ id: r.id, x: r.x, y: r.y, target: "scout" as const }));
    const crossingPins =
      previewOption !== null && previewOption.crossings
        ? previewOption.crossings.map((c) => ({ id: c.id, x: c.x, y: c.y, target: "crossing" as const }))
        : [];
    const corridors = displayOptions.map((o) => ({ optionId: o.id, points: o.route.points }));
    const hit = resolveMapTap([...pins, ...crossingPins], corridors, x, y);
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
      ? partialPoints(committedOption.route.points, 0.55)
      : null;
  const stopEnd = stopPoints !== null && stopPoints.length > 0 ? stopPoints[stopPoints.length - 1]! : null;
  const legacyFinal =
    consequenceKind === "caught-open" ? stopEnd : consequenceKind === "arrived" ? committedEnd : null;
  const youFinal = crossingArrival ?? legacyFinal;
  const youDelta =
    youFinal !== null ? { dx: youFinal.x - round.player.x, dy: youFinal.y - round.player.y } : null;
  const consequenceCopy = committedOption ? consequenceCopyFor(committedOption) : null;
  // Traversal polyline for the consequence beat: YOU → crossing → arrival.
  const traversalPoints: readonly CircleIqRoutePoint[] | null =
    consequence && committedOption && crossingPoint !== null && crossingArrival !== null
      ? [{ x: round.player.x, y: round.player.y }, crossingPoint, { x: crossingArrival.x, y: crossingArrival.y }]
      : null;

  // Terrain dressing (aria-hidden, derived from authored landmarks only):
  // faint contour bands + tree ticks around the ridge landmark, if any.
  const ridgeLandmark = round.landmarks.find((l) => l.type === "ridge") ?? null;

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
      <style>{`@keyframes ciq-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}@keyframes ciq-pulse{0%,100%{opacity:1}50%{opacity:.15}}@keyframes ciq-you{from{transform:translate(var(--ciq-dx,0px),var(--ciq-dy,0px))}to{transform:translate(0px,0px)}}@keyframes ciq-landmark{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}@keyframes ciq-tighten{from{transform:scale(1.25);opacity:.1}to{transform:scale(1);opacity:.16}}.ciq-route-draw{stroke-dasharray:1;animation:ciq-draw 700ms ease forwards}.ciq-exposure{animation:ciq-pulse 750ms ease-in-out 2}.ciq-you-move{animation:ciq-you 700ms ease forwards}.ciq-landmark-pulse{transform-box:fill-box;transform-origin:center;animation:ciq-landmark 700ms ease}.ciq-tighten{transform-box:fill-box;transform-origin:center;animation:ciq-tighten 700ms ease forwards}.ciq-scout:focus{outline:none}.ciq-scout:focus-visible .ciq-scout-focus{opacity:1}.ciq-crossing:focus{outline:none}.ciq-crossing:focus-visible .ciq-crossing-focus{opacity:1}.ciq-route-target:focus{outline:none}@media (prefers-reduced-motion:reduce){.ciq-route-draw,.ciq-exposure,.ciq-you-move,.ciq-landmark-pulse,.ciq-tighten{animation:none}}`}</style>
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
          <span aria-hidden="true" className="absolute left-3 top-2.5 z-10 rounded-full border border-border bg-card/90 px-2 py-0.5 font-mono text-[10px] tracking-widest text-muted-foreground">
            {locked ? (verdict ? "CONSEQUENCE" : "COMMITTED — WATCH") : previewOption ? "PREVIEW" : "TACTICAL BOARD"}
          </span>
          <svg ref={svgRef} onClick={handleMapTap} viewBox="0 0 360 240" className="h-auto w-full max-h-[320px] sm:max-h-[360px]" role="img" aria-label={`Tactical snapshot: ${round.title}. ${round.situation}`}>
            <defs aria-hidden="true">
              <pattern id="ciq-hatch" width="7" height="7" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="7" stroke="var(--color-foreground)" strokeWidth="1.4" opacity="0.3" />
              </pattern>
            </defs>
            {ridgeLandmark ? (
              <g aria-hidden="true">
                <ellipse cx={ridgeLandmark.x} cy={ridgeLandmark.y} rx="72" ry="40" fill="none" stroke="var(--color-foreground)" strokeWidth="1" opacity="0.1" />
                <ellipse cx={ridgeLandmark.x} cy={ridgeLandmark.y} rx="52" ry="28" fill="none" stroke="var(--color-foreground)" strokeWidth="1" opacity="0.12" />
                {[-2, -1, 0, 1, 2].map((i) => (
                  <path
                    key={i}
                    d={`M ${ridgeLandmark.x + i * 18 - 6} ${ridgeLandmark.y - 24} l 6 -10 l 6 10 z`}
                    fill="none"
                    stroke="var(--color-foreground)"
                    strokeWidth="1.4"
                    opacity="0.4"
                  />
                ))}
              </g>
            ) : null}
            <circle
              cx={consequence && consequenceKind !== "arrived" && committedOption ? round.next.center.x : round.zone.center.x}
              cy={consequence && consequenceKind !== "arrived" && committedOption ? round.next.center.y : round.zone.center.y}
              r={consequence && consequenceKind !== "arrived" && committedOption ? round.next.radius : round.zone.radius}
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="1.25"
              strokeDasharray="7 6"
              opacity={locked ? 0.25 : 0.55}
              style={{ transition: "opacity 700ms ease" }}
            />
            <circle
              cx={round.next.center.x}
              cy={round.next.center.y}
              r={round.next.radius}
              fill="var(--color-primary)"
              opacity={locked && consequenceKind === "arrived" ? 0.22 : 0.14}
              className={locked && consequenceKind === "arrived" && !reducedMotion ? "ciq-tighten" : undefined}
              style={{ transition: "opacity 700ms ease" }}
            />
            <circle
              cx={round.next.center.x}
              cy={round.next.center.y}
              r={round.next.radius}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2.5"
            />
            <circle
              cx={round.next.center.x}
              cy={round.next.center.y}
              r={round.next.radius + 8}
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="1"
              strokeDasharray="3 4"
              opacity="0.6"
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
                  dimmed={locked ? committedId !== option.id : anyActive && !active}
                  highlighted={previewId === option.id && committedId === null}
                  committed={committedId === option.id}
                  committedStrong={committedId === option.id ? option.quality === "strong" : null}
                  onPreview={preview}
                />
              );
            })}
            {round.reveals.map((reveal) => (
              <ScoutTarget
                key={reveal.id}
                reveal={reveal}
                inspected={scout.inspectedIds.includes(reveal.id)}
                disabled={locked || finished || (scout.scoutsLeft === 0 && !scout.inspectedIds.includes(reveal.id))}
                scoutsLeft={scout.scoutsLeft}
                onInspect={inspect}
              />
            ))}
            {previewOption?.crossings?.map((crossing, crossingIndex) => (
              <CrossingPin
                key={crossing.id}
                crossing={crossing}
                letter={String.fromCharCode(65 + crossingIndex)}
                selected={(locked ? committedCrossingId : crossingId) === crossing.id}
                disabled={locked || finished}
                onSelect={chooseCrossing}
              />
            ))}
            {previewOption && selectedCrossing && !locked ? (
              <g aria-hidden="true">
                <path
                  d={routePathD([
                    { x: round.player.x, y: round.player.y },
                    { x: selectedCrossing.x, y: selectedCrossing.y },
                    { x: selectedCrossing.arrival.x, y: selectedCrossing.arrival.y },
                  ])}
                  fill="none"
                  stroke="var(--color-foreground)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray="6 4"
                  opacity="0.9"
                />
                <circle
                  cx={selectedCrossing.arrival.x}
                  cy={selectedCrossing.arrival.y}
                  r="6"
                  fill="none"
                  stroke="var(--color-foreground)"
                  strokeWidth="2"
                  strokeDasharray="3 3"
                />
              </g>
            ) : null}
            {consequence && committedOption && consequenceKind === "arrived" && committedOption.route.style !== "hold" ? (
              <g aria-hidden="true">
                <path
                  d={routePathD(traversalPoints ?? committedOption.route.points)}
                  fill="none"
                  stroke="var(--color-primary)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDashoffset={0}
                  className={reducedMotion ? undefined : "ciq-route-draw"}
                />
                {traversalPoints && crossingPoint ? (
                  <g>
                    <circle
                      cx={crossingPoint.x}
                      cy={crossingPoint.y}
                      r="10"
                      fill="none"
                      stroke={crossingCons?.spotted ? "var(--color-destructive)" : "var(--color-primary)"}
                      strokeWidth="2.5"
                      className={reducedMotion ? undefined : "ciq-exposure"}
                    />
                    {crossingCons?.spotted ? (
                      <text x={crossingPoint.x} y={crossingPoint.y - 16} textAnchor="middle" fontSize="9" fill="var(--color-destructive)" fontFamily="monospace" letterSpacing="2">
                        SPOTTED
                      </text>
                    ) : null}
                    <circle
                      cx={crossingArrival!.x}
                      cy={crossingArrival!.y}
                      r="6"
                      fill="none"
                      stroke="var(--color-primary)"
                      strokeWidth="2"
                    />
                  </g>
                ) : null}
              </g>
            ) : null}
            {consequence && committedOption && consequenceKind === "caught-open" && traversalPoints !== null && crossingPoint !== null && crossingArrival !== null ? (
              <g aria-hidden="true">
                <path
                  d={routePathD(committedOption.route.style === "hold" ? [] : committedOption.route.points)}
                  fill="none"
                  stroke="var(--color-border-strong)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                <path
                  d={routePathD(traversalPoints)}
                  fill="none"
                  stroke={crossingCons?.spotted ? "var(--color-destructive)" : "var(--color-primary)"}
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDashoffset={0}
                  className={reducedMotion ? undefined : "ciq-route-draw"}
                />
                <circle
                  cx={crossingPoint.x}
                  cy={crossingPoint.y}
                  r="10"
                  fill="none"
                  stroke={crossingCons?.spotted ? "var(--color-destructive)" : "var(--color-primary)"}
                  strokeWidth="2.5"
                  className={reducedMotion ? undefined : "ciq-exposure"}
                />
                {crossingCons?.spotted ? (
                  <g>
                    <line x1={crossingPoint.x - 8} y1={crossingPoint.y - 8} x2={crossingPoint.x + 8} y2={crossingPoint.y + 8} stroke="var(--color-destructive)" strokeWidth="3" strokeLinecap="round" />
                    <line x1={crossingPoint.x + 8} y1={crossingPoint.y - 8} x2={crossingPoint.x - 8} y2={crossingPoint.y + 8} stroke="var(--color-destructive)" strokeWidth="3" strokeLinecap="round" />
                    <text x={crossingPoint.x} y={crossingPoint.y - 16} textAnchor="middle" fontSize="9" fill="var(--color-destructive)" fontFamily="monospace" letterSpacing="2">
                      SPOTTED
                    </text>
                  </g>
                ) : null}
                <circle
                  cx={crossingArrival.x}
                  cy={crossingArrival.y}
                  r="6"
                  fill="none"
                  stroke={crossingCons?.spotted ? "var(--color-destructive)" : "var(--color-primary)"}
                  strokeWidth="2"
                />
              </g>
            ) : null}
            {consequence && committedOption && consequenceKind === "caught-open" && stopPoints !== null && traversalPoints === null ? (
              <g aria-hidden="true">
                <path
                  d={routePathD(committedOption.route.points)}
                  fill="none"
                  stroke="var(--color-border-strong)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeDasharray="4 4"
                  opacity="0.6"
                />
                <path
                  d={routePathD(stopPoints)}
                  fill="none"
                  stroke="var(--color-destructive)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  pathLength={1}
                  strokeDashoffset={0}
                  className={reducedMotion ? undefined : "ciq-route-draw"}
                />
                <path
                  d={routePathD(stopPoints)}
                  fill="none"
                  stroke="var(--color-destructive)"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.3"
                  className={reducedMotion ? undefined : "ciq-exposure"}
                />
                {stopEnd ? (
                  <g>
                    <line x1={stopEnd.x - 8} y1={stopEnd.y - 8} x2={stopEnd.x + 8} y2={stopEnd.y + 8} stroke="var(--color-destructive)" strokeWidth="3" strokeLinecap="round" />
                    <line x1={stopEnd.x + 8} y1={stopEnd.y - 8} x2={stopEnd.x - 8} y2={stopEnd.y + 8} stroke="var(--color-destructive)" strokeWidth="3" strokeLinecap="round" />
                  </g>
                ) : null}
              </g>
            ) : null}
            {consequence && committedOption && consequenceKind === "left-behind" ? (
              <g aria-hidden="true">
                <circle cx={round.player.x} cy={round.player.y - 26} r="10" fill="var(--color-card)" stroke="var(--color-destructive)" strokeWidth="2" />
                <text x={round.player.x} y={round.player.y - 22} textAnchor="middle" fontSize="11" fontWeight="bold" fill="var(--color-destructive)">
                  !
                </text>
                <text x={round.player.x} y={round.player.y - 40} textAnchor="middle" fontSize="9" fill="var(--color-destructive)" fontFamily="monospace" letterSpacing="2">
                  LATE
                </text>
              </g>
            ) : null}
            <circle cx={round.player.x} cy={round.player.y} r="11" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.4" />
            {consequence && youDelta !== null && youFinal !== null ? (
              <circle
                cx={youFinal.x}
                cy={youFinal.y}
                r="7"
                fill={consequenceKind === "arrived" ? "var(--color-primary)" : "var(--color-destructive)"}
                className={reducedMotion ? undefined : "ciq-you-move"}
                style={{ ["--ciq-dx" as string]: `${round.player.x - youFinal.x}px`, ["--ciq-dy" as string]: `${round.player.y - youFinal.y}px` }}
              />
            ) : (
              <circle cx={round.player.x} cy={round.player.y} r="7" fill="var(--color-primary)" />
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
            <text x={round.next.center.x} y={round.next.center.y + 3} textAnchor="middle" fontSize="10" fill="var(--color-primary-ink)" fontFamily="monospace" letterSpacing="2">
              NEXT
            </text>
          </svg>
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
