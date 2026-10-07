"use client";

import * as React from "react";
import { Check, Copy, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { OrgLogo } from "./org-logo";
import type { DraftMatch } from "@/types/database";

export function ResultCard({
  match,
  organizationName,
  organizationLogoUrl,
  shareUrl,
  showNotes = false,
}: {
  match: DraftMatch;
  organizationName: string;
  organizationLogoUrl?: string | null;
  shareUrl?: string | null;
  showNotes?: boolean;
}) {
  const [copied, setCopied] = React.useState(false);
  const picks = match.actions.filter((a) => a.type === "pick");
  const remaining = match.pool.filter((p) => !match.actions.some((a) => a.item.toLowerCase() === p.toLowerCase()));

  async function copyResult() {
    const lines = [
      "MICRONEST — MATCH DRAFT RECORD",
      `${match.team_a} vs ${match.team_b}`,
      ...(match.event_name ? [`Event: ${match.event_name}`] : []),
      ...(match.format_label ? [`Format: ${match.format_label}`] : []),
      `Record no.: ${match.ref_code}`,
      `Workspace: ${organizationName}`,
      "",
      "ACTION HISTORY",
      ...match.actions.map((a, i) => `${i + 1}. ${a.team === "A" ? match.team_a : match.team_b} — ${a.type === "ban" ? "Ban" : "Pick"} — ${a.item}`),
      "",
      "FINAL SELECTIONS",
      ...picks.map((a) => `${a.item} — ${a.team === "A" ? match.team_a : match.team_b} pick`),
      ...(remaining.length > 0 ? ["", `REMAINING POOL: ${remaining.join(", ")}`] : []),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
    } catch {
      const ta = document.createElement("textarea");
      ta.value = lines.join("\n");
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <OrgLogo name={organizationName} logoUrl={organizationLogoUrl} />
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">MicroNest · Match Draft Record</p>
            <CardTitle className="break-words">
              {match.team_a} vs {match.team_b}
            </CardTitle>
            <p className="mt-1 text-xs font-medium text-muted-foreground">Locked · Official record — this result cannot be changed.</p>
          </div>
          <Badge variant="outline" className="ml-auto shrink-0 font-mono">
            {match.ref_code}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <dl className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          {match.match_name && (
            <div>
              <dt className="text-muted-foreground">Match</dt>
              <dd className="font-medium">{match.match_name}</dd>
            </div>
          )}
          {match.event_name && (
            <div>
              <dt className="text-muted-foreground">Event</dt>
              <dd className="font-medium">{match.event_name}</dd>
            </div>
          )}
          {match.format_label && (
            <div>
              <dt className="text-muted-foreground">Format</dt>
              <dd className="font-medium">{match.format_label}</dd>
            </div>
          )}
          <div>
            <dt className="text-muted-foreground">Completed</dt>
            <dd className="font-medium">{match.completed_at ? new Date(match.completed_at).toLocaleString("en-GB") : "—"}</dd>
          </div>
        </dl>
        <ol className="space-y-1.5 text-sm">
          {match.actions.map((a) => (
            <li key={a.stepIndex} className="flex flex-wrap items-center gap-x-2 rounded-[8px] bg-surface-muted/60 px-3 py-2">
              <span className="text-muted-foreground">{a.stepIndex + 1}.</span>
              <span className="font-medium">{a.team === "A" ? match.team_a : match.team_b}</span>
              <Badge variant={a.type === "ban" ? "destructive" : "success"}>{a.type === "ban" ? "Ban" : "Pick"}</Badge>
              <span className="font-medium">{a.item}</span>
            </li>
          ))}
        </ol>
        {remaining.length > 0 && <p className="text-sm text-muted-foreground">Remaining pool: {remaining.join(", ")}{remaining.length === 1 ? ` · Decider: ${remaining[0]}` : ""}</p>}
        {showNotes && match.notes && <p className="text-sm">Notes: {match.notes}</p>}
        {shareUrl && (
          <p className="truncate text-xs text-muted-foreground">
            Official share link: <span className="font-mono">{shareUrl}</span>
          </p>
        )}
        <div className="flex flex-col gap-2 print:hidden sm:flex-row">
          <Button onClick={copyResult} className="min-h-[44px]" aria-label="Copy result as text">
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Copy result"}
          </Button>
          <span role="status" aria-live="polite" className="sr-only">
            {copied ? "Result copied." : null}
          </span>
          <Button variant="outline" onClick={() => window.print()} className="min-h-[44px]" aria-label="Print result">
            <Printer className="h-4 w-4" aria-hidden /> Print
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
