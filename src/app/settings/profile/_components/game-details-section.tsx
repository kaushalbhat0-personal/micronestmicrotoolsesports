"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  BGMI_PLAY_MODES,
  BGMI_REGION_VOCABULARY,
  BGMI_ROLES,
} from "@/features/player-profile/schemas/game";
import {
  updateGameDetailsAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

/** Suggested availability windows (shape-only in schema; optional). */
const AVAILABILITY_SUGGESTIONS = [
  "weeknights",
  "weekends",
  "mornings",
  "afternoons",
  "evenings",
  "flexible",
] as const;

export interface GameDetailsValues {
  game_key: string;
  ign: string;
  primary_role: string | null;
  region_code: string | null;
  play_modes: ReadonlyArray<string>;
  availability: ReadonlyArray<string>;
}

export function GameDetailsSection({ game }: { game: GameDetailsValues }) {
  const [state, action, pending] = useActionState(updateGameDetailsAction, initialState);
  const selectedModes = new Set(game.play_modes);
  const selectedAvailability = new Set(game.availability);

  return (
    <section
      aria-labelledby={`game-details-${game.game_key}`}
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id={`game-details-${game.game_key}`} className="text-lg font-semibold">
        Game profile · {game.game_key.toUpperCase()}
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Edit your public IGN, role, region, play modes, and optional availability. Private BGMI
        Player ID is managed in the separate private section below.
      </p>
      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="game_key" value={game.game_key} />
        <div>
          <label htmlFor={`ign-${game.game_key}`} className="text-sm font-medium">
            In-game name (IGN)
          </label>
          <input
            id={`ign-${game.game_key}`}
            name="ign"
            type="text"
            required
            minLength={2}
            maxLength={30}
            defaultValue={game.ign}
            className={inputClass}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={`role-${game.game_key}`} className="text-sm font-medium">
              Primary role <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <select
              id={`role-${game.game_key}`}
              name="primary_role"
              defaultValue={game.primary_role ?? ""}
              className={`${inputClass} bg-white`}
            >
              <option value="">Flexible / unset</option>
              {BGMI_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={`region-${game.game_key}`} className="text-sm font-medium">
              Region <span className="font-normal text-slate-500">(optional)</span>
            </label>
            <select
              id={`region-${game.game_key}`}
              name="region_code"
              defaultValue={game.region_code ?? ""}
              className={`${inputClass} bg-white`}
            >
              <option value="">Unset</option>
              {BGMI_REGION_VOCABULARY.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset>
          <legend className="text-sm font-medium">Play modes</legend>
          <ul className="mt-2 flex flex-wrap gap-3">
            {BGMI_PLAY_MODES.map((mode) => (
              <li key={mode}>
                <label className="inline-flex min-h-[44px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="play_modes"
                    value={mode}
                    defaultChecked={selectedModes.has(mode)}
                    className="size-4"
                  />
                  {mode}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <fieldset>
          <legend className="text-sm font-medium">
            Availability <span className="font-normal text-slate-500">(optional)</span>
          </legend>
          <ul className="mt-2 flex flex-wrap gap-3">
            {AVAILABILITY_SUGGESTIONS.map((slot) => (
              <li key={slot}>
                <label className="inline-flex min-h-[44px] items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="availability"
                    value={slot}
                    defaultChecked={selectedAvailability.has(slot)}
                    className="size-4"
                  />
                  {slot}
                </label>
              </li>
            ))}
          </ul>
        </fieldset>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save game profile"}
          </Button>
        </div>
      </form>
      {state.message.length > 0 ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-3 text-sm ${state.ok ? "text-emerald-800" : "text-accent-600"}`}
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
