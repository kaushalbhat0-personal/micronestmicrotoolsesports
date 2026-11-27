"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TieBreakerResultRow } from "@/server/repositories/tie-breaker-results";
import type { TieBreakerTeamRow } from "@/server/repositories/tie-breaker-teams";
import { addResultAction, updateResultAction } from "../actions/result-actions";

export interface ResultFormValues {
  teamAId: string;
  teamBId: string;
  winner: string;
  mapsA: string;
  mapsB: string;
  roundsA: string;
  roundsB: string;
  notes: string;
}

function toNumberOrNull(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number.parseInt(trimmed, 10);
  return Number.isInteger(n) && n >= 0 ? n : null;
}

/** Compact result entry. Saves incomplete rows when no winner is chosen. */
export function ResultEntryForm({
  orgSlug,
  competitionId,
  teams,
  drawsEnabled,
  roundLabel,
  editing,
  onDone,
}: {
  orgSlug: string;
  competitionId: string;
  teams: readonly TieBreakerTeamRow[];
  drawsEnabled: boolean;
  roundLabel: "rounds" | "games";
  editing?: TieBreakerResultRow | null;
  onDone?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<ResultFormValues>(() => ({
    teamAId: editing?.team_a_id ?? "",
    teamBId: editing?.team_b_id ?? "",
    winner:
      editing == null
        ? ""
        : editing.winner === "draw"
          ? "draw"
          : editing.winner === "team_a"
            ? editing.team_a_id
            : editing.winner === "team_b"
              ? editing.team_b_id
              : "",
    mapsA: editing?.maps_a?.toString() ?? "",
    mapsB: editing?.maps_b?.toString() ?? "",
    roundsA: editing?.rounds_a?.toString() ?? "",
    roundsB: editing?.rounds_b?.toString() ?? "",
    notes: editing?.notes ?? "",
  }));
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const nameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? "Team";
  const roundWord = roundLabel === "games" ? "Games" : "Rounds";

  function set<K extends keyof ResultFormValues>(key: K, value: ResultFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (!values.teamAId || !values.teamBId) {
      setError("Choose both teams for this result.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        orgSlug,
        competitionId,
        teamAId: values.teamAId,
        teamBId: values.teamBId,
        winnerTeamId:
          values.winner === "" || values.winner === "draw" ? null : values.winner,
        isDraw: values.winner === "draw",
        mapsA: toNumberOrNull(values.mapsA),
        mapsB: toNumberOrNull(values.mapsB),
        roundsA: toNumberOrNull(values.roundsA),
        roundsB: toNumberOrNull(values.roundsB),
        playedAt: null,
        notes: values.notes.trim() ? values.notes.trim() : null,
      };
      const result = editing
        ? await updateResultAction({ ...payload, resultId: editing.id })
        : await addResultAction(payload);
      if (result.error) {
        setError(result.error);
        return;
      }
      if (!editing && result.duplicatePair) {
        setNotice("These teams already have a recorded result. Saved as an additional match.");
      }
      if (editing) {
        onDone?.();
      } else {
        setValues((v) => ({ ...v, winner: "", mapsA: "", mapsB: "", roundsA: "", roundsB: "", notes: "" }));
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const winnerOptions = [
    { value: "", label: "Winner not decided yet (save as incomplete)" },
    ...(values.teamAId ? [{ value: values.teamAId, label: `${nameOf(values.teamAId)} won` }] : []),
    ...(values.teamBId ? [{ value: values.teamBId, label: `${nameOf(values.teamBId)} won` }] : []),
    ...(drawsEnabled ? [{ value: "draw", label: "Draw" }] : []),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{editing ? "Edit result" : "Enter result"}</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4" aria-label={editing ? "Edit result" : "Enter result"}>
          {error && (
            <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="rounded-[12px] border border-warning/30 bg-warning-soft p-3 text-sm">
              {notice}
            </p>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="tb-team-a">Team A</Label>
              <select
                id="tb-team-a"
                value={values.teamAId}
                onChange={(e) => set("teamAId", e.target.value)}
                required
                disabled={teams.length < 2}
                className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 py-2 text-[14px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tb-team-b">Team B</Label>
              <select
                id="tb-team-b"
                value={values.teamBId}
                onChange={(e) => set("teamBId", e.target.value)}
                required
                disabled={teams.length < 2}
                className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 py-2 text-[14px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">Choose team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tb-winner">Winner</Label>
            <select
              id="tb-winner"
              value={values.winner}
              onChange={(e) => set("winner", e.target.value)}
              className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 py-2 text-[14px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {winnerOptions.map((o) => (
                <option key={o.value || "none"} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Results without a winner are saved as incomplete and are not included in the standings.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="tb-maps-a">Maps A</Label>
              <Input id="tb-maps-a" inputMode="numeric" value={values.mapsA} onChange={(e) => set("mapsA", e.target.value)} placeholder="2" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tb-maps-b">Maps B</Label>
              <Input id="tb-maps-b" inputMode="numeric" value={values.mapsB} onChange={(e) => set("mapsB", e.target.value)} placeholder="1" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tb-rounds-a">{roundWord} A</Label>
              <Input id="tb-rounds-a" inputMode="numeric" value={values.roundsA} onChange={(e) => set("roundsA", e.target.value)} placeholder="—" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tb-rounds-b">{roundWord} B</Label>
              <Input id="tb-rounds-b" inputMode="numeric" value={values.roundsB} onChange={(e) => set("roundsB", e.target.value)} placeholder="—" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tb-notes">Private note (optional)</Label>
            <Input
              id="tb-notes"
              value={values.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Only visible to your workspace"
              maxLength={500}
            />
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" loading={saving} className="min-h-[44px]">
              {editing ? "Save result" : "Save result"}
            </Button>
            {editing && onDone && (
              <Button type="button" variant="outline" className="min-h-[44px]" onClick={onDone}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
