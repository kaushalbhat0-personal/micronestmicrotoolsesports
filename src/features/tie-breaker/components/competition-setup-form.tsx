"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Route } from "next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { RuleId, RulePresetId } from "../types";
import { PRESET_LABELS, PRESET_ORDERS } from "../presets";
import { createCompetitionAction, updateCompetitionAction } from "../actions/competition-actions";
import { RuleOrderEditor } from "./rule-order-editor";
import { presetDescription } from "./rule-labels";

export interface SetupFormValues {
  name: string;
  description: string;
  preset: RulePresetId;
  win: number;
  draw: number;
  loss: number;
  allowDraws: boolean;
  roundLabel: "rounds" | "games";
  ruleOrder: RuleId[];
}

const presets: RulePresetId[] = ["round_robin", "group_stage", "swiss_lite"];

/** Create + edit competition setup. Server validates; this form only presents. */
export function CompetitionSetupForm({
  orgSlug,
  mode,
  competitionId,
  initial,
}: {
  orgSlug: string;
  mode: "create" | "edit";
  competitionId?: string;
  initial: SetupFormValues;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<SetupFormValues>(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string[]> | undefined>(undefined);
  const [saving, setSaving] = React.useState(false);

  function set<K extends keyof SetupFormValues>(key: K, value: SetupFormValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
  }

  function choosePreset(preset: RulePresetId) {
    setValues((v) => ({ ...v, preset, ruleOrder: [...PRESET_ORDERS[preset]] }));
  }

  function parseScore(raw: string, fallback: number): number {
    const n = Number.parseInt(raw, 10);
    if (!Number.isInteger(n) || n < 0 || n > 10) return fallback;
    return n;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors(undefined);
    setSaving(true);
    try {
      const payload = {
        orgSlug,
        name: values.name.trim(),
        description: values.description.trim() ? values.description.trim() : null,
        scoring: {
          win: values.win,
          draw: values.draw,
          loss: values.loss,
          drawsEnabled: values.allowDraws,
          roundLabel: values.roundLabel,
        },
        ruleOrder: values.ruleOrder,
        presetRef: values.preset,
      };
      const result =
        mode === "create"
          ? await createCompetitionAction(payload)
          : await updateCompetitionAction({ ...payload, competitionId: competitionId as string });
      if (result.error) {
        setError(result.error);
        setFieldErrors(result.fieldErrors);
        return;
      }
      const target = mode === "create" ? result.competitionId : competitionId;
      router.push(`/dashboard/${orgSlug}/tie-breaker/${target}` as Route);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6" aria-label={mode === "create" ? "New competition" : "Competition setup"}>
      {error && (
        <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Competition details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tb-name">Competition name</Label>
            <Input
              id="tb-name"
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Monsoon Cup — Group A"
              maxLength={80}
              required
              aria-invalid={fieldErrors?.name ? true : undefined}
            />
            {fieldErrors?.name && <p className="text-sm text-destructive">{fieldErrors.name.join(" ")}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tb-description">Description (optional)</Label>
            <Input
              id="tb-description"
              value={values.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Round-robin, top 2 qualify"
              maxLength={500}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Starting setup</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Choose a starting setup. You can adjust the rule order before locking. Presets are starting points, not
            official rulebooks.
          </p>
          <div className="grid gap-2 sm:grid-cols-3" role="group" aria-label="Starting setup">
            {presets.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => choosePreset(preset)}
                aria-pressed={values.preset === preset}
                className={`min-h-[44px] rounded-[12px] border p-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  values.preset === preset ? "border-primary bg-primary/5" : "border-border bg-card hover:border-border-strong"
                }`}
              >
                <span className="block text-sm font-semibold">{PRESET_LABELS[preset]}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{presetDescription(preset)}</span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Scoring</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Points are the first rule used to separate standings. Whole numbers from 0 to 10.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                ["win", "Win"],
                ["draw", "Draw"],
                ["loss", "Loss"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={`tb-score-${key}`}>{label}</Label>
                <Input
                  id={`tb-score-${key}`}
                  inputMode="numeric"
                  value={values[key]}
                  onChange={(e) => set(key, parseScore(e.target.value, values[key]))}
                />
              </div>
            ))}
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={values.allowDraws}
              onChange={(e) => set("allowDraws", e.target.checked)}
              className="h-5 w-5 accent-[var(--color-primary)]"
            />
            Allow draws in this competition
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="tb-round-label">Track rounds or games</Label>
            <select
              id="tb-round-label"
              value={values.roundLabel}
              onChange={(e) => set("roundLabel", e.target.value as "rounds" | "games")}
              className="flex h-11 w-full rounded-[12px] border border-input bg-card px-3.5 py-2 text-[14px] shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="rounds">Rounds (for example 26–19)</option>
              <option value="games">Games</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ranking rules</CardTitle>
        </CardHeader>
        <CardContent>
          <RuleOrderEditor order={values.ruleOrder} onChange={(ruleOrder) => set("ruleOrder", ruleOrder)} roundLabel={values.roundLabel} />
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="submit" loading={saving} className="min-h-[44px]">
          {mode === "create" ? "Create competition" : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
