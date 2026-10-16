"use client";

import * as React from "react";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { getPresetById } from "../services/presets";
import { isValidFinishes, isValidPlacement, scenarioPoints } from "../services/scoring";
import { scenarioMessage, verdictLabel } from "../services/copy";
import type { QualificationScenario } from "../types";

export interface ScenarioDraft {
  placement: number;
  finishes: number;
}

interface ScenarioEditorProps {
  readonly draft: ScenarioDraft;
  readonly onChange: (draft: ScenarioDraft) => void;
  readonly presetId: string;
  readonly current: number | null;
  readonly target: number | null;
  readonly onSave: (() => void) | null;
  readonly savedCount: number;
}

function parseCount(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  return Number.isInteger(n) ? n : null;
}

/** Single-match hypothesis editor with instant projected verdict. */
export function ScenarioEditor({ draft, onChange, presetId, current, target, onSave, savedCount }: ScenarioEditorProps) {
  const preset = getPresetById(presetId);
  const points = scenarioPoints(preset, draft.placement, draft.finishes);
  const projected = points !== null && current !== null ? current + points.total : null;
  const verdict = projected !== null && target !== null ? (projected > target ? "above" : projected === target ? "exact" : "below") : null;
  const finishesValid = isValidFinishes(preset, draft.finishes);

  return (
    <div className="rounded-[12px] border border-border bg-card p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="wq-placement">Placement</Label>
          <select
            id="wq-placement"
            value={draft.placement}
            onChange={(e) => onChange({ ...draft, placement: Number(e.target.value) })}
            className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {Array.from({ length: preset.maxPlacement }, (_, i) => i + 1).map((p) => (
              <option key={p} value={p}>
                {p}
                {p === 1 ? "st" : p === 2 ? "nd" : p === 3 ? "rd" : "th"} · {preset.placementPoints[p - 1]} pts
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wq-finishes">Finishes</Label>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One fewer finish"
              disabled={draft.finishes <= 0}
              onClick={() => onChange({ ...draft, finishes: draft.finishes - 1 })}
            >
              <Minus className="h-4 w-4" aria-hidden />
            </Button>
            <Input
              id="wq-finishes"
              inputMode="numeric"
              value={String(draft.finishes)}
              onChange={(e) => {
                const n = parseCount(e.target.value);
                onChange({ ...draft, finishes: n === null ? draft.finishes : n });
              }}
              aria-describedby={finishesValid ? undefined : "wq-finishes-error"}
              className="text-center tabular-nums"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="One more finish"
              disabled={draft.finishes >= preset.maxFinishesPerMatch}
              onClick={() => onChange({ ...draft, finishes: draft.finishes + 1 })}
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </div>
          {!finishesValid ? (
            <p id="wq-finishes-error" role="alert" className="text-xs text-destructive">
              Finishes must be 0–{preset.maxFinishesPerMatch}.
            </p>
          ) : null}
        </div>
      </div>

      <div aria-live="polite" className="mt-3 rounded-[12px] bg-surface-muted/50 p-3 text-sm">
        {points !== null && projected !== null && target !== null && verdict !== null && isValidPlacement(preset, draft.placement) ? (
          <p className="leading-relaxed">
            <span className="font-semibold tabular-nums">+{points.total} pts</span>{" "}
            <span className="text-muted-foreground">
              ({points.placementPoints} placement + {points.finishPoints} finishes)
            </span>{" "}
            → <span className="font-semibold tabular-nums">{projected} projected</span>{" "}
            <Badge variant={verdict === "above" ? "success" : verdict === "exact" ? "warning" : "secondary"} className="ml-1">
              {verdictLabel(verdict)}
            </Badge>
            <span className="mt-1 block text-xs text-muted-foreground">
              {scenarioMessage(draft.placement, draft.finishes, points.total, projected, target, verdict)}
            </span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Enter your current points and target above to see the projection.</p>
        )}
      </div>

      {onSave !== null ? (
        <Button type="button" variant="secondary" onClick={onSave} disabled={savedCount >= 3} className="mt-3">
          Save scenario ({savedCount}/3)
        </Button>
      ) : null}
    </div>
  );
}

export interface SavedScenarioRowProps {
  readonly scenario: QualificationScenario;
  readonly index: number;
  readonly presetId: string;
  readonly current: number;
  readonly target: number;
  readonly onRemove: () => void;
}

export function SavedScenarioRow({ scenario, index, presetId, current, target, onRemove }: SavedScenarioRowProps) {
  const preset = getPresetById(presetId);
  const points = scenarioPoints(preset, scenario.placement, scenario.finishes);
  if (points === null) return null;
  const projected = current + points.total;
  const verdict = projected > target ? "above" : projected === target ? "exact" : "below";
  const short = target - projected;
  return (
    <li className="flex items-center justify-between gap-3 rounded-[12px] border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">
          Scenario {index + 1} · {scenario.placement}
          {scenario.placement === 1 ? "st" : scenario.placement === 2 ? "nd" : scenario.placement === 3 ? "rd" : "th"} +{" "}
          {scenario.finishes} finishes
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          +{points.total} pts → {projected} projected ·{" "}
          {verdict === "above" ? "Above target" : verdict === "exact" ? "Needs tiebreak" : `${short} short`}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={verdict === "above" ? "success" : verdict === "exact" ? "warning" : "secondary"}>
          {verdictLabel(verdict)}
        </Badge>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove scenario ${index + 1}`} onClick={onRemove}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </div>
    </li>
  );
}
