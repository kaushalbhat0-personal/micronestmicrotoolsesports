"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createDraftMatchAction } from "../actions/match-actions";
import type { DraftStep } from "../types";

function parsePool(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter(Boolean);
}

export function MatchSetupForm({
  orgSlug,
  templateId,
  templateName,
  sequence,
  defaultTeamA,
  defaultTeamB,
  defaultPool,
}: {
  orgSlug: string;
  templateId: string | null;
  templateName: string;
  sequence: readonly DraftStep[];
  defaultTeamA: string;
  defaultTeamB: string;
  defaultPool: readonly string[];
}) {
  const router = useRouter();
  const [teamA, setTeamA] = React.useState(defaultTeamA);
  const [teamB, setTeamB] = React.useState(defaultTeamB);
  const [poolRaw, setPoolRaw] = React.useState(defaultPool.join("\n"));
  const [matchName, setMatchName] = React.useState("");
  const [eventName, setEventName] = React.useState("");
  const [formatLabel, setFormatLabel] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  const pool = parsePool(poolRaw);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const result = await createDraftMatchAction({
        orgSlug,
        teamA: teamA.trim(),
        teamB: teamB.trim(),
        pool,
        sequence: sequence.map((s) => ({ team: s.team, type: s.type })),
        templateId,
        matchName: matchName.trim() ? matchName.trim() : null,
        eventName: eventName.trim() ? eventName.trim() : null,
        formatLabel: formatLabel.trim() ? formatLabel.trim() : null,
        notes: notes.trim() ? notes.trim() : null,
      });
      if (result.error || !result.matchId) {
        setError(result.error ?? "Failed to create draft");
        return;
      }
      router.push(`/dashboard/${orgSlug}/draft-ban/${result.matchId}` as Route);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Match setup</CardTitle>
          <CardDescription>
            Draft setup: {templateName} · {sequence.length} steps · needs {sequence.length} pool items
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
              {error}
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="team-a">Team A</Label>
              <Input id="team-a" value={teamA} onChange={(e) => setTeamA(e.target.value)} required minLength={1} maxLength={40} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="team-b">Team B</Label>
              <Input id="team-b" value={teamB} onChange={(e) => setTeamB(e.target.value)} required minLength={1} maxLength={40} autoComplete="off" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pool">Draft pool — one item per line ({pool.length} items)</Label>
            <textarea
              id="pool"
              value={poolRaw}
              onChange={(e) => setPoolRaw(e.target.value)}
              rows={7}
              className="min-h-[140px] w-full rounded-[12px] border border-input bg-card px-4 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              placeholder={"Map A\nMap B\nMap C"}
              aria-describedby="pool-help"
            />
            <p id="pool-help" className="text-xs text-muted-foreground">
              Names are matched case-insensitively. Duplicates are rejected.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="match-name">Match name (optional)</Label>
              <Input id="match-name" value={matchName} onChange={(e) => setMatchName(e.target.value)} maxLength={80} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-name">Event (optional)</Label>
              <Input id="event-name" value={eventName} onChange={(e) => setEventName(e.target.value)} maxLength={80} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="format-label">Format (optional, e.g. BO3)</Label>
              <Input id="format-label" value={formatLabel} onChange={(e) => setFormatLabel(e.target.value)} maxLength={20} autoComplete="off" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional, private)</Label>
              <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} autoComplete="off" />
            </div>
          </div>
          <Button type="submit" loading={pending} className="min-h-[44px] w-full sm:w-auto">
            Start draft
          </Button>
        </CardContent>
      </Card>
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Sequence preview</CardTitle>
          <CardDescription>Fixed at creation. Editing the template later never changes this match.</CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="space-y-1.5 text-sm">
            {sequence.map((s, i) => (
              <li key={i} className="flex items-center justify-between rounded-[8px] bg-surface-muted/60 px-3 py-2">
                <span className="text-muted-foreground">
                  Step {i + 1} · Team {s.team}
                </span>
                <span className="font-medium capitalize">{s.type}</span>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </form>
  );
}
