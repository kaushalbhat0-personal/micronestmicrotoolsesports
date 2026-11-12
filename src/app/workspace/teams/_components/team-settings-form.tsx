"use client";

// Team settings form (P14-D6) — wired to updateTeamSettingsAction.

import { useActionState } from "react";
import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import { COMPETITIVE_LEVELS, SELF_REPORTED_LEVEL_NOTE } from "@/features/teams/domain/levels";
import { MAX_TEAM_DESCRIPTION_LENGTH } from "@/features/teams/schemas/team";
import type { ManagedTeam } from "@/features/teams/domain/workspace";
import {
  WORKSPACE_DISABLED_MESSAGE,
  WORKSPACE_WRITES_ENABLED,
  WORKSPACE_WRITES_HINT,
  type WorkspaceActionState,
} from "@/features/teams/domain/workspace";
import { updateTeamSettingsAction } from "@/features/teams/server/team-actions";
import { getGameByKey } from "@/lib/game-catalog/catalog";

const fieldClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

const labelClass = "text-sm font-medium";

const lockedClass =
  "rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600";

const initialState: WorkspaceActionState = { ok: false, message: "" };

export function TeamSettingsForm({ team }: { team: ManagedTeam }) {
  const gameName = getGameByKey(team.game_key)?.name ?? team.game_key;
  const [state, formAction, pending] = useActionState(updateTeamSettingsAction, initialState);

  return (
    <div>
      <form
        action={formAction}
        aria-label={`Settings for ${team.name}`}
        aria-describedby="team-settings-boundary"
      >
        <input type="hidden" name="team_id" value={team.id} />
        <div className="grid gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="settings-name" className={labelClass}>
              Team name
            </label>
            <input
              id="settings-name"
              name="name"
              type="text"
              autoComplete="off"
              maxLength={60}
              minLength={2}
              required
              defaultValue={team.name}
              className={fieldClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span id="settings-slug-label" className={labelClass}>
                Team slug (locked)
              </span>
              <p aria-labelledby="settings-slug-label" className={lockedClass}>
                @{team.slug}
              </p>
              <p className="text-xs text-slate-500">Slugs are permanent after creation.</p>
            </div>
            <div className="flex flex-col gap-1">
              <span id="settings-game-label" className={labelClass}>
                Game (locked)
              </span>
              <p aria-labelledby="settings-game-label" className={lockedClass}>
                {gameName}
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="settings-region" className={labelClass}>
              Region
            </label>
            <select
              id="settings-region"
              name="regionCode"
              className={fieldClass}
              defaultValue={team.region_code}
              required
            >
              {BGMI_REGION_VOCABULARY.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="settings-current-level" className={labelClass}>
                Current level <span className="font-normal text-slate-500">(self-reported)</span>
              </label>
              <select
                id="settings-current-level"
                name="currentLevel"
                className={fieldClass}
                defaultValue={team.current_level}
                required
              >
                {COMPETITIVE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="settings-target-level" className={labelClass}>
                Target level <span className="font-normal text-slate-500">(self-reported)</span>
              </label>
              <select
                id="settings-target-level"
                name="targetLevel"
                className={fieldClass}
                defaultValue={team.target_level}
                required
              >
                {COMPETITIVE_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-slate-500">{SELF_REPORTED_LEVEL_NOTE}</p>

          <div className="flex flex-col gap-1">
            <label htmlFor="settings-description" className={labelClass}>
              Description
            </label>
            <textarea
              id="settings-description"
              name="description"
              rows={4}
              maxLength={MAX_TEAM_DESCRIPTION_LENGTH}
              defaultValue={team.description ?? ""}
              className={fieldClass}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="settings-recruiting" className="inline-flex items-center gap-2 text-sm">
              <input
                id="settings-recruiting"
                name="recruiting"
                type="checkbox"
                defaultChecked={team.recruiting}
                className="h-4 w-4"
              />
              Open for recruitment
            </label>
            <label htmlFor="settings-public" className="inline-flex items-center gap-2 text-sm">
              <input
                id="settings-public"
                name="isPublic"
                type="checkbox"
                defaultChecked={team.is_public}
                className="h-4 w-4"
              />
              Publicly discoverable
            </label>
          </div>

          <div>
            <button
              type="submit"
              disabled={pending}
              className="min-h-[44px] rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {pending ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
      {state.message ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-4 rounded-md border px-4 py-3 text-sm ${
            state.ok
              ? "border-emerald-200 bg-emerald-50 text-emerald-900"
              : "border-amber-200 bg-amber-50 text-amber-900"
          }`}
        >
          {state.message}
        </p>
      ) : (
        <p
          id="team-settings-boundary"
          role="note"
          className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          {WORKSPACE_WRITES_ENABLED
            ? WORKSPACE_WRITES_HINT
            : `${WORKSPACE_DISABLED_MESSAGE} Ownership, game and slug cannot be edited here.`}
        </p>
      )}
    </div>
  );
}
