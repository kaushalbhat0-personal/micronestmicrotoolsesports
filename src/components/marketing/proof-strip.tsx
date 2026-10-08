import * as React from "react";
import { BadgeCheck, Clapperboard, ListChecks, Tv, Users } from "lucide-react";
import { BrowserFrame } from "./browser-frame";
import { cn } from "@/lib/utils/cn";

const STEPS = [
  {
    n: "01",
    title: "Campaign",
    text: "Set sponsor requirements once.",
    icon: Users,
  },
  {
    n: "02",
    title: "Channel",
    text: "Connect creator channels.",
    icon: Tv,
  },
  {
    n: "03",
    title: "Check",
    text: "Content is checked automatically.",
    icon: ListChecks,
  },
  {
    n: "04",
    title: "Proof",
    text: "Proof is organized per video.",
    icon: Clapperboard,
  },
] as const;

const PROOF_ROWS = [
  { requirement: "#ad in description", status: "Pass", pass: true },
  { requirement: "30s verbal mention", status: "Pass", pass: true },
  { requirement: "Pinned comment", status: "Needs review", pass: false },
] as const;

/**
 * ProofStrip — code-drawn illustrative workflow (campaign → channel → check
 * → proof) plus a compact proof-report artifact. Illustrative only: it never
 * claims to show a real customer account or real sponsor data.
 */
export function ProofStrip({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)}>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="How Sponsorship Tracking works">
        {STEPS.map((step, i) => (
          <li
            key={step.n}
            className="nest-reveal relative rounded-[16px] border border-border bg-card p-4"
            style={{ animationDelay: `${i * 60}ms` } as React.CSSProperties}
          >
            <p className="font-mono text-[11px] tracking-widest text-primary" aria-hidden>
              {step.n}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <step.icon className="h-4 w-4 text-muted-foreground" aria-hidden />
              <h3 className="text-sm font-semibold">{step.title}</h3>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.text}</p>
          </li>
        ))}
      </ol>

      <BrowserFrame className="mx-auto max-w-2xl">
        <div className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">Sponsor proof report</p>
            <span className="inline-flex items-center gap-1.5">
              <BadgeCheck className="h-3.5 w-3.5 text-success" aria-hidden />
              <span className="text-xs text-muted-foreground">Illustrative example</span>
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {PROOF_ROWS.map((row) => (
              <li
                key={row.requirement}
                className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-surface-muted/40 px-3 py-2"
              >
                <span className="truncate font-mono text-xs">{row.requirement}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    row.pass ? "bg-success/15 text-success" : "bg-warning/15 text-warning"
                  )}
                >
                  {row.status}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-center text-xs text-muted-foreground">This is what you send your sponsor.</p>
        </div>
      </BrowserFrame>
    </div>
  );
}
