"use client";

import * as React from "react";
import { Crosshair, RotateCcw } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Circle IQ — architecture/demo shell (Phase 1.3).
 *
 * Clearly a placeholder for the interaction boundary: server-rendered
 * content lives on the page; this island proves dynamic loading, instant
 * feedback, and ephemeral state (no account, no persistence). Full game
 * mechanics arrive in a later RCCF.
 *
 * AdSense convention (documented, no ads yet): ad slots must never sit
 * inside this interaction container or between the options and the
 * verdict below.
 */

const ROUNDS = [
  {
    id: "ridge-vs-field",
    prompt: "Circle pulls east across open ground. You hold a compound west with a ridge to the north-east.",
    options: [
      { id: "ridge", label: "Rotate early along the ridge with cover", correct: true, why: "Cover beats distance — the ridge hides the crossing and arrives before the gate closes." },
      { id: "hold", label: "Hold the compound until the last second", correct: false, why: "Holding wastes the timing window; the late crossing runs open ground under fire." },
      { id: "field", label: "Drive straight across the open field", correct: false, why: "Shortest path, highest risk — open-field crossings late are how squads wipe." },
    ],
  },
  {
    id: "split-circle",
    prompt: "Split circle: hard cover north, open dip south. Two squads already north.",
    options: [
      { id: "edge", label: "Take the quiet south edge with smoke cover", correct: true, why: "Contested cover loses to numbers; a smoked edge entry keeps all four alive for the next pull." },
      { id: "contest", label: "Contest the north compound head-on", correct: false, why: "Fighting uphill into two squads before the circle shrinks burns utility and players." },
      { id: "wait", label: "Wait in the open and react to the next circle", correct: false, why: "No cover means every pull is a gamble — proactive edge play beats reactive waiting." },
    ],
  },
];

export function CircleIqShell() {
  const [roundIndex, setRoundIndex] = React.useState(0);
  const [picked, setPicked] = React.useState<string | null>(null);
  const [score, setScore] = React.useState(0);
  const [plays, setPlays] = React.useState(0);
  const round = ROUNDS[roundIndex % ROUNDS.length]!;

  function pick(id: string, correct: boolean) {
    if (picked !== null) return;
    setPicked(id);
    setPlays((p) => p + 1);
    if (correct) setScore((s) => s + 1);
  }

  function next() {
    setPicked(null);
    setRoundIndex((i) => i + 1);
  }

  function reset() {
    setPicked(null);
    setRoundIndex(0);
    setScore(0);
    setPlays(0);
  }

  const pickedOption = round.options.find((o) => o.id === picked) ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Crosshair className="h-4 w-4 text-primary" aria-hidden /> Try it — pick the rotation
        </CardTitle>
        <CardDescription>
          Demo shell for the interaction boundary. {plays > 0 ? `You have called ${score} of ${plays} correctly.` : "Two sample rounds, instant feedback."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium leading-relaxed">{round.prompt}</p>
        <div className="grid gap-2" role="group" aria-label="Rotation options">
          {round.options.map((o) => {
            const selected = picked === o.id;
            const revealed = picked !== null;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => pick(o.id, o.correct)}
                disabled={revealed}
                aria-pressed={selected}
                className={`min-h-[44px] rounded-[12px] border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  revealed && o.correct
                    ? "border-success/40 bg-success-soft"
                    : revealed && selected
                      ? "border-destructive/40 bg-destructive-soft"
                      : "border-border bg-card hover:bg-muted"
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        {pickedOption ? (
          <div aria-live="polite" className="rounded-[12px] border border-border bg-surface-muted/40 p-4 text-sm leading-relaxed">
            <p>
              <Badge variant={pickedOption.correct ? "success" : "secondary"}>{pickedOption.correct ? "Good call" : "Risky call"}</Badge>
            </p>
            <p className="mt-2 text-muted-foreground">{pickedOption.why}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-[44px] items-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Next round
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
        <p className="text-xs text-muted-foreground">Demo shell — full mechanics arrive later. Nothing is saved; replay freely.</p>
      </CardContent>
    </Card>
  );
}
