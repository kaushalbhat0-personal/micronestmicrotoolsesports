"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";

/**
 * CircleIqMicroChallenge — the homepage play moment.
 *
 * Boundary: a tiny self-contained training prompt with local state only.
 * It never imports the full Circle IQ product — the map below is
 * presentational SVG plus three buttons placed on it. Result copy is
 * deliberately non-competitive and makes no skill-measurement claims.
 */

export type MicroRotationChoice = "A" | "B" | "C";
export type MicroRead = "good" | "different";

interface MicroOption {
  readonly id: MicroRotationChoice;
  /** Short hint shown in the legend and the option's accessible name. */
  readonly hint: string;
  /** Button position over the map, as a share of the diagram box. */
  readonly left: string;
  readonly top: string;
}

const MICRO_OPTIONS: readonly MicroOption[] = [
  { id: "A", hint: "Hold the edge", left: "19%", top: "75%" },
  { id: "B", hint: "Rotate to the center", left: "60%", top: "42%" },
  { id: "C", hint: "Swing wide", left: "83%", top: "20%" },
];

/**
 * Read the pick. B sits inside the next playable area, so it is the
 * safer rotation; A and C stay outside it. Pure and total — the unit
 * tests pin every option through this function.
 */
export function getMicroRead(choice: MicroRotationChoice): MicroRead {
  return choice === "B" ? "good" : "different";
}

const BASE_BUTTON =
  "absolute flex size-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 font-mono text-sm font-bold transition-[border-color,background-color,box-shadow] duration-[180ms] ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

export function CircleIqMicroChallenge() {
  const [selected, setSelected] = useState<MicroRotationChoice | null>(null);
  const read: MicroRead | null = selected === null ? null : getMicroRead(selected);

  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-surface-muted/40">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5 sm:px-6">
        <p className="font-mono text-[11px] tracking-widest text-primary">ROUND 01</p>
        <p className="font-mono text-[11px] tracking-widest text-muted-foreground">3 ROUTES</p>
      </div>
      <h3 className="font-display px-5 pt-2 text-xl font-normal tracking-tight sm:px-6 sm:text-2xl">
        Where would you rotate?
      </h3>
      <p className="px-5 pt-2 text-sm leading-relaxed text-muted-foreground sm:px-6">
        Study the zone snapshot and pick a position on the map. A training prompt — nothing is scored, nothing is saved.
      </p>

      <div className="px-5 pt-4 sm:px-6">
        <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[12px] border border-border bg-card">
          <svg
            viewBox="0 0 360 240"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
            focusable="false"
          >
            <circle
              cx="180"
              cy="122"
              r="102"
              fill="none"
              stroke="var(--color-border-strong)"
              strokeWidth="1.5"
              strokeDasharray="7 6"
              opacity="0.7"
            />
            <circle cx="216" cy="100" r="56" fill="var(--color-primary)" opacity="0.07" />
            <circle
              cx="216"
              cy="100"
              r="56"
              fill="none"
              stroke="var(--color-primary)"
              strokeWidth="2"
            />
            <path
              d="M96 182 L200 108"
              fill="none"
              stroke="var(--color-foreground-muted)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              opacity="0.7"
            />
            <circle cx="96" cy="182" r="11" fill="none" stroke="var(--color-primary)" strokeWidth="1.5" opacity="0.4" />
            <circle cx="96" cy="182" r="6" fill="var(--color-primary)" />
            <text x="96" y="214" textAnchor="middle" fontSize="10" fill="var(--color-foreground-muted)" fontFamily="monospace" letterSpacing="2">
              YOU
            </text>
            <text x="180" y="20" textAnchor="middle" fontSize="10" fill="var(--color-foreground-muted)" fontFamily="monospace" letterSpacing="2">
              ZONE NOW
            </text>
            <text x="216" y="104" textAnchor="middle" fontSize="10" fill="var(--color-primary)" fontFamily="monospace" letterSpacing="2">
              NEXT
            </text>
          </svg>
          {MICRO_OPTIONS.map((option) => {
            const isPicked = selected === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={isPicked}
                aria-label={`Rotation option ${option.id}: ${option.hint}`}
                onClick={() => setSelected(option.id)}
                style={{ left: option.left, top: option.top }}
                className={
                  isPicked
                    ? `${BASE_BUTTON} border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary ring-offset-2 ring-offset-card`
                    : `${BASE_BUTTON} border-border-strong bg-card text-foreground hover:border-primary hover:bg-primary/10`
                }
              >
                {option.id}
              </button>
            );
          })}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 pt-3 text-xs text-muted-foreground" aria-label="Route legend">
          {MICRO_OPTIONS.map((option) => (
            <li key={option.id} className={selected === option.id ? "font-semibold text-foreground" : undefined}>
              <span className="font-mono font-bold">{option.id}</span> · {option.hint}
            </li>
          ))}
        </ul>
      </div>

      <div className="px-5 py-5 sm:px-6">
        {selected === null ? (
          <p className="rounded-[12px] border border-dashed border-border px-4 py-4 text-center text-sm text-muted-foreground">
            Pick a position on the map — A, B, or C.
          </p>
        ) : (
          <div key={selected} role="status" className="nest-reveal rounded-[12px] border border-primary/25 bg-primary/[0.06] px-4 py-4">
            <p className="font-mono text-[11px] tracking-widest text-primary">YOUR READ</p>
            <p className="font-display mt-1 text-lg font-normal tracking-tight">
              {read === "good" ? "Good read" : "Different read"}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {read === "good"
                ? "You chose the safer rotation."
                : "The stronger route was toward the center."}
            </p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Link
                href="/bgmi-lab/circle-iq"
                aria-label="Try the full Circle IQ drill — no signup needed"
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground hover:bg-[var(--color-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                Try Circle IQ
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full border border-border bg-card px-6 text-sm font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <RotateCcw className="h-4 w-4" aria-hidden />
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
