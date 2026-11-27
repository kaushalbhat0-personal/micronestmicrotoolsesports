"use client";

// Team creation form — wired to createTeamAction (P14-D6 writes enabled).

import { useActionState } from "react";
import { BGMI_REGION_VOCABULARY } from "@/features/player-profile/schemas/game";
import { COMPETITIVE_LEVELS } from "@/features/teams/domain/levels";
import { MAX_TEAM_DESCRIPTION_LENGTH } from "@/features/teams/schemas/team";
import { SUPPORTED_GAMES } from "@/lib/game-catalog/catalog";
import {
  WORKSPACE_DISABLED_MESSAGE,
  WORKSPACE_WRITES_ENABLED,
  WORKSPACE_WRITES_HINT,
  type WorkspaceActionState,
} from "@/features/teams/domain/workspace";
import { createTeamAction } from "@/features/teams/server/team-actions";

const fieldClass =
  "rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

const labelClass = "text-sm font-medium";

const initialState: WorkspaceActionState = { ok: false, message: "" };

export function TeamForm() {
  const [state, formAction, pending] = useActionState(createTeamAction, initialState);

  return (
    <div>
      <form
        action={formAction}
        aria-label="Create a team"
        aria-describedby="team-form-boundary"
        className="grid gap-4"
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="team-name" className={labelClass}>
              Team name
            </label>
            <input
              id="team-name"
              name="name"
              type="text"
              autoComplete="off"
              maxLength={60}
              minLength={2}
              required
              placeholder="e.g. Nova Esports"
              className={fieldClass}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="team-slug" className={labelClass}>
              Team slug
            </label>
            <input
              id="team-slug"
              name="slug"
              type="text"
              autoComplete="off"
              maxLength={60}
              minLength={2}
              required
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              placeholder="e.g. nova-esports"
              aria-describedby="team-slug-hint"
              className={fieldClass}
            />
            <p id="team-slug-hint" className="text-xs text-slate-500">
              Lowercase words joined by hyphens. Permanent after creation.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="team-game" className={labelClass}>
              Game
            </label>
            <select id="team-game" name="gameKey" className={fieldClass} defaultValue="bgmi">
              {SUPPORTED_GAMES.map((game) => (
                <option key={game.key} value={game.key}>
                  {game.name}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500">
              One team supports one game. Additional titles arrive incrementally.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="team-region" className={labelClass}>
              Region
            </label>
            <select id="team-region" name="regionCode" className={fieldClass} defaultValue="" required>
              <option value="" disabled>
                Select a region
              </option>
              {BGMI_REGION_VOCABULARY.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="team-current-level" className={labelClass}>
              Current level <span className="font-normal text-slate-500">(self-reported)</span>
            </label>
            <select
              id="team-current-level"
              name="currentLevel"
              className={fieldClass}
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select a level
              </option>
              {COMPETITIVE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="team-target-level" className={labelClass}>
              Target level <span className="font-normal text-slate-500">(self-reported)</span>
            </label>
            <select
              id="team-target-level"
              name="targetLevel"
              className={fieldClass}
              defaultValue=""
              required
            >
              <option value="" disabled>
                Select a level
              </option>
              {COMPETITIVE_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {level}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="team-description" className={labelClass}>
            Description
          </label>
          <textarea
            id="team-description"
            name="description"
            rows={4}
            maxLength={MAX_TEAM_DESCRIPTION_LENGTH}
            placeholder="What is this team about?"
            className={fieldClass}
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="team-recruiting" className="inline-flex items-center gap-2 text-sm">
            <input id="team-recruiting" name="recruiting" type="checkbox" defaultChecked className="h-4 w-4" />
            Open for recruitment
          </label>
          <label htmlFor="team-public" className="inline-flex items-center gap-2 text-sm">
            <input id="team-public" name="isPublic" type="checkbox" defaultChecked className="h-4 w-4" />
            Publicly discoverable
          </label>
        </div>

        <div>
          <button
            type="submit"
            disabled={pending}
            className="min-h-[44px] rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {pending ? "Submitting…" : "Create team"}
          </button>
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
          id="team-form-boundary"
          role="note"
          className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
        >
          {WORKSPACE_WRITES_ENABLED ? WORKSPACE_WRITES_HINT : WORKSPACE_DISABLED_MESSAGE}
        </p>
      )}
    </div>
  );
}
