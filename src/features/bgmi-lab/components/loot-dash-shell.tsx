"use client";

import * as React from "react";
import { RotateCcw, Pause, Play } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { useArcadeCanvas } from "@/lib/arcade/use-arcade-canvas";
import {
  LOOT_DASH_HEIGHT,
  LOOT_DASH_TUNING,
  LOOT_DASH_WIDTH,
  createLootDashRun,
  stepLootDash,
  summarizeLootDash,
  type LootDashInput,
  type LootDashState,
  type LootDashSummary,
} from "./loot-dash-sim";
import { LOOT_DASH_BGMI_THEME, LOOT_DASH_PALETTE, gradeLootRun } from "./loot-dash-theme";
import {
  buildLootTerrain,
  createLootVisual,
  lootSparkCountFor,
  pushBounded,
  renderLootFrame,
  stepLootVisualEffects,
  type FloatText,
  type LootTerrain,
  type LootVisual,
  type Spark,
} from "./loot-dash-render";
import { createRng, createRunSeed } from "@/lib/arcade/rng";
import type { ArcadeRng } from "@/lib/arcade/rng";

/**
 * Loot Dash — first interactive 2D game of BGMI Lab.
 *
 * INPUT → ACTION → FEEDBACK → RESULT → REPLAY: steer an abstract marker for
 * ~45 seconds, collect supply tokens, dodge hazard rings, chain combos.
 * Ephemeral practice feedback only — no rating, no leaderboard, nothing saved.
 *
 * React owns phase/result/HUD/controls. The simulation lives in a ref and the
 * Canvas owns per-frame rendering; React re-renders only when HUD values
 * (score, second, lives, combo) or the phase actually change.
 */

type LootPhase = "ready" | "playing" | "paused" | "over";

const READY_PREVIEW_SEED = 20260715;

export function LootDashShell({ durationSec = LOOT_DASH_TUNING.durationSec }: { durationSec?: number }) {
  const [phase, setPhase] = React.useState<LootPhase>("ready");
  const [hud, setHud] = React.useState({ score: 0, timeLeft: durationSec, lives: LOOT_DASH_TUNING.lives, combo: 0 });
  const [result, setResult] = React.useState<LootDashSummary | null>(null);
  const [reducedMotion, setReducedMotion] = React.useState(false);

  const simRef = React.useRef<{ state: LootDashState; rng: ArcadeRng } | null>(null);
  const keysRef = React.useRef<Set<string>>(new Set());
  const visualRef = React.useRef<LootVisual>(createLootVisual());
  const terrainRef = React.useRef<LootTerrain>(buildLootTerrain(READY_PREVIEW_SEED));
  const seedRef = React.useRef<number>(READY_PREVIEW_SEED);
  const phaseRef = React.useRef(phase);
  phaseRef.current = phase;
  const tuningRef = React.useRef({ ...LOOT_DASH_TUNING, durationSec });
  tuningRef.current = { ...LOOT_DASH_TUNING, durationSec };
  const hudRef = React.useRef(hud);
  hudRef.current = hud;
  const reducedRef = React.useRef(reducedMotion);
  reducedRef.current = reducedMotion;
  const resultRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const startRun = React.useCallback(() => {
    const tuning = tuningRef.current;
    const seed = createRunSeed();
    seedRef.current = seed;
    simRef.current = createLootDashRun(seed, tuning);
    visualRef.current = createLootVisual();
    terrainRef.current = buildLootTerrain(seed);
    setResult(null);
    setHud({ score: 0, timeLeft: tuning.durationSec, lives: tuning.lives, combo: 0 });
    setPhase("playing");
  }, []);

  const pauseRun = React.useCallback(() => {
    if (phaseRef.current === "playing") setPhase("paused");
  }, []);

  const resumeRun = React.useCallback(() => {
    if (phaseRef.current === "paused") setPhase("playing");
  }, []);

  React.useEffect(() => {
    if (phase === "over" && resultRef.current) resultRef.current.focus();
  }, [phase]);

  // Keyboard steering (WASD + arrows). Game-specific: lives in the shell,
  // written to a ref the frame loop reads — no re-renders from key input.
  React.useEffect(() => {
    const down = (e: KeyboardEvent): void => {
      if (e.key === " ") {
        e.preventDefault();
        if (phaseRef.current === "ready" || phaseRef.current === "over") startRun();
        else if (phaseRef.current === "playing") pauseRun();
        else resumeRun();
        return;
      }
      // Movement keys are captured only while a run is live, so page scroll
      // elsewhere (FAQ, methodology) is never hijacked.
      if (phaseRef.current !== "playing" && phaseRef.current !== "paused") return;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) e.preventDefault();
      keysRef.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent): void => {
      keysRef.current.delete(e.key.toLowerCase());
    };
    const clear = (): void => keysRef.current.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
    };
  }, [startRun, pauseRun, resumeRun]);

  const { canvasRef, pointerRef } = useArcadeCanvas({
    logicalWidth: LOOT_DASH_WIDTH,
    logicalHeight: LOOT_DASH_HEIGHT,
    running: phase === "playing",
    onHiddenPause: pauseRun,
    onFrame: (ctx, dt) => {
      const sim = simRef.current;
      if (!sim || phaseRef.current !== "playing") return;
      const tuning = tuningRef.current;
      const visual = visualRef.current;
      const reduced = reducedRef.current;
      const keys = keysRef.current;
      let mx = 0;
      let my = 0;
      if (keys.has("a") || keys.has("arrowleft")) mx -= 1;
      if (keys.has("d") || keys.has("arrowright")) mx += 1;
      if (keys.has("w") || keys.has("arrowup")) my -= 1;
      if (keys.has("s") || keys.has("arrowdown")) my += 1;
      const len = Math.hypot(mx, my);
      const input: LootDashInput = {
        moveX: len > 0 ? mx / len : 0,
        moveY: len > 0 ? my / len : 0,
        hasKeys: len > 0,
        pointerX: pointerRef.current.x,
        pointerY: pointerRef.current.y,
        pointerActive: pointerRef.current.active,
      };
      // Presentation-only direction memory (wedge orientation + dust).
      if (len > 0) {
        visual.lastDirX = mx / len;
        visual.lastDirY = my / len;
      } else if (input.pointerActive) {
        const dx = input.pointerX - sim.state.playerX;
        const dy = input.pointerY - sim.state.playerY;
        if (Math.hypot(dx, dy) > 4) {
          visual.lastDirX = dx / Math.hypot(dx, dy);
          visual.lastDirY = dy / Math.hypot(dx, dy);
        }
      }
      const prevScore = sim.state.score;
      const prevHits = sim.state.hitsTaken;
      const prevCombo = sim.state.combo;
      const ended = stepLootDash(sim.state, input, dt, sim.rng, tuning);

      // HUD sync — only on actual value changes, never per frame.
      const last = hudRef.current;
      const second = Math.ceil(sim.state.timeLeft);
      if (sim.state.score !== last.score || second !== last.timeLeft || sim.state.hitsTaken !== tuning.lives - last.lives || sim.state.combo !== last.combo) {
        setHud({
          score: sim.state.score,
          timeLeft: second,
          lives: tuning.lives - sim.state.hitsTaken,
          combo: sim.state.combo,
        });
      }

      // Presentation events derived from sim deltas — never gameplay.
      if (!reduced) {
        if (sim.state.score !== prevScore) {
          const gained = sim.state.score - prevScore;
          const rng = createRng((seedRef.current ^ Math.floor(sim.state.elapsed * 60) ^ 0x51ab) >>> 0);
          const n = lootSparkCountFor(sim.state.combo);
          for (let i = 0; i < n; i++) {
            const a = rng() * Math.PI * 2;
            const sp = 40 + rng() * 90;
            pushBounded<Spark>(
              visual.sparks,
              {
                x: sim.state.playerX,
                y: sim.state.playerY,
                vx: Math.cos(a) * sp,
                vy: Math.sin(a) * sp,
                ttl: 0.45,
                total: 0.45,
                color: sim.state.combo >= 3 ? LOOT_DASH_PALETTE.comboHot : LOOT_DASH_PALETTE.player,
                size: 2 + rng() * 2.5,
              },
              60,
            );
          }
          pushBounded<FloatText>(
            visual.floaters,
            {
              x: sim.state.playerX,
              y: sim.state.playerY - 14,
              ttl: 0.8,
              total: 0.8,
              text: `+${gained}`,
              color: sim.state.combo >= 2 ? LOOT_DASH_PALETTE.comboHot : LOOT_DASH_PALETTE.playerInk,
            },
            12,
          );
          if (visual.hasLastPickup && sim.state.combo > prevCombo) {
            pushBounded(
              visual.links,
              {
                x1: visual.lastPickupX,
                y1: visual.lastPickupY,
                x2: sim.state.playerX,
                y2: sim.state.playerY,
                ttl: 0.35,
                total: 0.35,
              },
              8,
            );
          }
          visual.lastPickupX = sim.state.playerX;
          visual.lastPickupY = sim.state.playerY;
          visual.hasLastPickup = true;
        }
        // Movement dust while the marker travels.
        const moving = len > 0 || (input.pointerActive && Math.hypot(input.pointerX - sim.state.playerX, input.pointerY - sim.state.playerY) > 12);
        visual.trailClock -= dt;
        if (moving && visual.trailClock <= 0) {
          visual.trailClock = 0.07;
          pushBounded(visual.trail, { x: sim.state.playerX, y: sim.state.playerY + 6, ttl: 0.4, total: 0.4 }, 20);
        }
      }
      if (sim.state.hitsTaken !== prevHits) visual.damageFlash = 0.4;
      for (const s of visual.sparks) {
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vx *= 1 - 2.4 * dt;
        s.vy *= 1 - 2.4 * dt;
      }
      stepLootVisualEffects(visual, dt);

      renderLootFrame(ctx, {
        terrain: terrainRef.current,
        visual,
        tokens: sim.state.tokens,
        hazards: sim.state.hazards,
        playerX: sim.state.playerX,
        playerY: sim.state.playerY,
        playerRadius: tuning.playerRadius,
        elapsed: sim.state.elapsed,
        combo: sim.state.combo,
        invulnTimer: sim.state.invulnTimer,
        over: ended,
        reducedMotion: reduced,
      });

      if (ended) {
        setResult(summarizeLootDash(sim.state));
        setPhase("over");
      }
    },
  });

  // Static preview behind the ready phase: same renderer, fixed seed,
  // one paint per ready entry — no loop, no gameplay.
  React.useEffect(() => {
    if (phase !== "ready") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const cssWidth = rect.width > 0 ? rect.width : LOOT_DASH_WIDTH;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(cssWidth * dpr));
    canvas.height = Math.max(1, Math.round(((cssWidth * LOOT_DASH_HEIGHT) / LOOT_DASH_WIDTH) * dpr));
    ctx.setTransform(canvas.width / LOOT_DASH_WIDTH, 0, 0, canvas.height / LOOT_DASH_HEIGHT, 0, 0);
    const tokens = [
      { id: 1, x: 70, y: 120, kind: "supply" as const, value: 10, radius: 9 },
      { id: 2, x: 250, y: 90, kind: "cache" as const, value: 25, radius: 11 },
      { id: 3, x: 160, y: 250, kind: "medkit" as const, value: 15, radius: 10 },
      { id: 4, x: 290, y: 330, kind: "supply" as const, value: 10, radius: 9 },
    ];
    renderLootFrame(ctx, {
      terrain: buildLootTerrain(READY_PREVIEW_SEED),
      visual: createLootVisual(),
      tokens,
      hazards: [
        { id: 11, x: 120, y: 330, r: 26, vx: 0, vy: 0 },
        { id: 12, x: 260, y: 210, r: 24, vx: 0, vy: 0 },
      ],
      playerX: LOOT_DASH_WIDTH / 2,
      playerY: LOOT_DASH_HEIGHT - 90,
      playerRadius: LOOT_DASH_TUNING.playerRadius,
      elapsed: 1.2,
      combo: 0,
      invulnTimer: 0,
      over: false,
      reducedMotion: true,
    });
  }, [phase, canvasRef]);

  const grade = result ? gradeLootRun(result) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-[11px] tracking-widest text-primary-ink">
            {phase === "playing" ? "LIVE RUN" : phase === "paused" ? "PAUSED" : phase === "over" ? "RUN OVER" : "READY"}
          </p>
          <p className="font-mono text-[11px] tracking-widest text-muted-foreground" aria-live="off">
            {hud.score} PTS
          </p>
        </div>
        <CardTitle className="pt-1 text-xl font-normal">Loot Dash</CardTitle>
        <CardDescription className="leading-relaxed">
          Steer through the field for {durationSec} seconds — grab supplies, dodge danger rings, chain combos.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-6">
        <div
          className="flex flex-wrap items-center gap-1.5 text-sm"
          role="status"
          aria-label={`${hud.timeLeft} seconds left, ${hud.lives} of ${LOOT_DASH_TUNING.lives} lives left, combo times ${hud.combo}, score ${hud.score}`}
        >
          <span
            className="inline-flex min-h-[28px] items-center rounded-full bg-primary px-3 font-mono text-[11px] tracking-widest text-primary-foreground"
            aria-hidden="true"
          >
            {hud.timeLeft}s
          </span>
          <span
            className="inline-flex min-h-[28px] items-center rounded-full border border-border bg-card px-3 font-mono text-[11px] tracking-widest text-primary-ink"
            aria-hidden="true"
          >
            {hud.score} PTS
          </span>
          <span
            className="inline-flex min-h-[28px] items-center rounded-full border border-border bg-card px-3 font-mono text-[11px] tracking-widest text-primary-ink"
            aria-hidden="true"
          >
            ♥ {hud.lives}
          </span>
          <span
            className={
              hud.combo >= 2
                ? "inline-flex min-h-[28px] items-center rounded-full bg-primary px-3 font-mono text-[11px] tracking-widest text-primary-foreground"
                : "inline-flex min-h-[28px] items-center rounded-full border border-border bg-card px-3 font-mono text-[11px] tracking-widest text-muted-foreground"
            }
            aria-hidden="true"
          >
            COMBO ×{hud.combo}
          </span>
        </div>

        <figure className="relative overflow-hidden rounded-[12px] border border-border bg-surface-muted/40">
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={`Loot Dash arena: steer the marker, collect supplies, avoid danger rings. ${hud.timeLeft} seconds left.`}
            data-board="loot-dash"
            className="h-auto w-full"
            style={{ aspectRatio: `${LOOT_DASH_WIDTH} / ${LOOT_DASH_HEIGHT}`, touchAction: "none" }}
          />
          <figcaption className="sr-only">
            Top-down arena. Your marker is labelled YOU. Collect supply crates, larger caches, and medkit packs.
            Avoid the dashed danger rings — three hits ends the run early.
          </figcaption>
        </figure>

        <div className="flex flex-wrap gap-2">
          {phase === "ready" || phase === "over" ? (
            <button
              type="button"
              onClick={startRun}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Play className="h-4 w-4" aria-hidden /> {phase === "over" ? "Play Again" : "Start Run"}
            </button>
          ) : null}
          {phase === "playing" ? (
            <button
              type="button"
              onClick={pauseRun}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Pause className="h-4 w-4" aria-hidden /> Pause
            </button>
          ) : null}
          {phase === "paused" ? (
            <>
              <button
                type="button"
                onClick={resumeRun}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Play className="h-4 w-4" aria-hidden /> Resume
              </button>
              <button
                type="button"
                onClick={startRun}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-border bg-card px-5 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="h-4 w-4" aria-hidden /> Restart
              </button>
            </>
          ) : null}
        </div>

        <p className="text-xs text-muted-foreground">
          Desktop: WASD or arrow keys, or drag on the arena. Mobile: drag to steer. Space starts, pauses, and resumes.
        </p>

        {phase === "ready" ? (
          <ol className="grid grid-cols-2 gap-2 text-xs leading-snug sm:grid-cols-4" aria-label="How a run works">
            <li className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-2.5 py-2">
              <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">➤</span>
              <span><strong className="font-semibold">Move</strong> the YOU marker</span>
            </li>
            <li className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-2.5 py-2">
              <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-[3px] border-2 border-[#3c5a72] bg-[#4d7a9e]" />
              <span><strong className="font-semibold">Collect</strong> crates &amp; packs</span>
            </li>
            <li className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-2.5 py-2">
              <span aria-hidden="true" className="h-4 w-4 shrink-0 rounded-full border-2 border-dashed border-[#d0442e]" />
              <span><strong className="font-semibold">Dodge</strong> danger rings</span>
            </li>
            <li className="flex items-center gap-2 rounded-[10px] border border-border bg-card px-2.5 py-2">
              <span aria-hidden="true" className="font-mono text-[11px] font-bold text-primary-ink">×2</span>
              <span><strong className="font-semibold">Chain</strong> pickups for combo</span>
            </li>
          </ol>
        ) : null}

        {phase === "over" && result && grade ? (
          <div
            ref={resultRef}
            tabIndex={-1}
            aria-live="polite"
            className="overflow-hidden rounded-[12px] border border-border bg-surface-muted/40 text-sm leading-relaxed focus:outline-none"
          >
            <div aria-hidden="true" className="h-1 w-full bg-primary" />
            <div className="p-4">
            <p className="font-mono text-[11px] tracking-widest text-primary-ink">
              {LOOT_DASH_BGMI_THEME.gradeHeading[grade]}
            </p>
            <p className="mt-1 text-3xl font-normal font-display">{result.score} pts</p>
            <p className="mt-1 text-foreground">{LOOT_DASH_BGMI_THEME.gradeLine[grade]}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-[8px] border border-border bg-card px-2 py-2">
                <dt className="font-mono text-[10px] tracking-widest text-muted-foreground">PICKUPS</dt>
                <dd className="text-lg font-semibold">{result.pickups}</dd>
              </div>
              <div className="rounded-[8px] border border-border bg-card px-2 py-2">
                <dt className="font-mono text-[10px] tracking-widest text-muted-foreground">BEST COMBO</dt>
                <dd className="text-lg font-semibold">×{result.bestCombo}</dd>
              </div>
              <div className="rounded-[8px] border border-border bg-card px-2 py-2">
                <dt className="font-mono text-[10px] tracking-widest text-muted-foreground">HITS</dt>
                <dd className="text-lg font-semibold">{result.hitsTaken}</dd>
              </div>
            </dl>
            <p className="mt-2 text-xs text-muted-foreground">
              Personal practice feedback — not a skill rating. Nothing is saved; replay freely.
            </p>
            </div>
          </div>
        ) : null}
        <p className="text-xs text-muted-foreground">
          An original MicroNest practice game — nothing is predicted. Nothing is saved; replay freely.
        </p>
      </CardContent>
    </Card>
  );
}
