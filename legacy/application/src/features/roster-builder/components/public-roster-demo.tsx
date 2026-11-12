"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList } from "lucide-react";
import { RosterBuilderWorkspace } from "./roster-builder-workspace";

/**
 * PublicRosterDemo — anonymous hands-on demo for the marketing page.
 *
 * Renders the canonical `RosterBuilderWorkspace` verbatim (same parser,
 * conflict detection, slot model, and copy/CSV primitives). Fully ephemeral:
 * no account, nothing stored anywhere — state dies with the page, exactly
 * as the workspace documents.
 *
 * The signup CTA sits after delivered value and only offers continued use
 * with an account — it never gates the roster-building workflow.
 */
export function PublicRosterDemo() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] border border-border bg-card">
          <ClipboardList className="h-4 w-4 text-primary" aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold">Try it now — no signup needed</p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            Paste messy registrations, see duplicates and shared players flagged, then arrange clean slots.
            This demo runs entirely in your browser — nothing is saved.
          </p>
        </div>
      </div>
      <RosterBuilderWorkspace />
      <p className="rounded-[12px] border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
        Want to keep using MicroNest tools?{" "}
        <Link
          href="/signup"
          aria-label="Create a free account to keep using MicroNest tools"
          className="font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          Create a free account
        </Link>
        .
      </p>
    </div>
  );
}
