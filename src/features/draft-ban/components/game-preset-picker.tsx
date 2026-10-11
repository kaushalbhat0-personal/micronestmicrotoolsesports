"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Gamepad2 } from "lucide-react";
import { GAMES } from "@/config/games/catalog";
import { GAME_VETO_PRESETS, resolveGamePresetSetupNavigation } from "../services/game-presets";
import { createTemplateFromGamePresetAction } from "../actions/template-actions";

const OFFICIAL_PRESET_GAME_SLUGS = [...new Set(GAME_VETO_PRESETS.map((preset) => preset.gameSlug))];

/**
 * Official game veto presets. Selecting one saves a normal editable custom
 * template (counted toward the workspace template limit), then opens match
 * setup from it. Presets are starting sequences — map pools stay
 * event-supplied and editable.
 */
export function GamePresetPicker({ orgSlug, canCreate }: { orgSlug: string; canCreate: boolean }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [limited, setLimited] = React.useState(false);
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  async function applyPreset(presetId: string) {
    setError(null);
    setLimited(false);
    setPendingId(presetId);
    try {
      const result = await createTemplateFromGamePresetAction({ orgSlug, presetId });
      // Mirror the match-setup form pattern: push first, then refresh so the
      // navigation is never superseded by the action's path revalidation.
      const href = resolveGamePresetSetupNavigation(orgSlug, result);
      if (!href) {
        setError(result.error ?? "Something went wrong. Please try again.");
        setLimited(result.templateLimited === true);
        return;
      }
      router.push(href);
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Gamepad2 className="h-4 w-4" aria-hidden /> Official game presets
        </CardTitle>
        <CardDescription>
          Official preset — editable copy. Saves as a normal custom setup (counts toward your template limit), then opens match setup. Map pools are never included; supply the event pool.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <p role="alert" className="rounded-[12px] border border-destructive/20 bg-destructive-soft p-3 text-sm">
            {error}
          </p>
        )}
        {OFFICIAL_PRESET_GAME_SLUGS.map((slug) => {
          const game = GAMES.find((g) => g.slug === slug);
          const presets = GAME_VETO_PRESETS.filter((preset) => preset.gameSlug === slug);
          return (
            <div key={slug} className="space-y-2">
              <p className="text-sm font-medium">
                {game?.name ?? slug} <Badge variant="secondary" className="ml-1">Official preset</Badge>
              </p>
              <ul className="grid gap-2 sm:grid-cols-2" aria-label={`${game?.name ?? slug} presets`}>
                {presets.map((preset) => (
                  <li key={preset.id} className="flex items-center justify-between gap-2 rounded-[12px] border border-border bg-card px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium" title={preset.label}>{preset.label}</p>
                      <p className="truncate text-xs text-muted-foreground" title={preset.description}>
                        {preset.sequence.length} steps · {preset.description}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      className="min-h-[44px] shrink-0"
                      disabled={!canCreate || pendingId !== null}
                      onClick={() => applyPreset(preset.id)}
                      aria-label={`Use ${preset.label} preset`}
                    >
                      {pendingId === preset.id ? "Saving…" : "Use preset"}
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
        {!canCreate && (
          <p className="text-xs text-muted-foreground">Template limit reached — delete a custom setup to use a game preset, or upgrade.</p>
        )}
        {limited && (
          <p className="text-xs text-muted-foreground">The preset was not saved because the custom-template limit was reached.</p>
        )}
      </CardContent>
    </Card>
  );
}
