"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  GAME_USER_ID_MAX_LENGTH,
  GAME_USER_ID_MIN_LENGTH,
} from "@/features/player-profile/schemas/game";
import {
  updateBgmiPlayerIdAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

export function BgmiPlayerIdSection({
  gameKey,
  gameUserId,
}: {
  gameKey: string;
  gameUserId: string | null;
}) {
  const [state, action, pending] = useActionState(updateBgmiPlayerIdAction, initialState);
  const hasId = gameUserId !== null && gameUserId.length > 0;

  return (
    <section
      id="bgmi-player-id-settings"
      aria-labelledby={`bgmi-id-${gameKey}`}
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id={`bgmi-id-${gameKey}`} className="text-lg font-semibold">
        BGMI Player ID <span className="font-normal text-slate-500">(private)</span>
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Stored only for you and future ownership review. It never appears in the public directory,
        public profile page, or share cards. This is not official BGMI verification.
      </p>
      <p className="mt-2 text-sm">
        Current value:{" "}
        <strong className="font-mono tracking-wide">
          {hasId ? gameUserId : "Not set"}
        </strong>
      </p>
      <form action={action} className="mt-4 grid gap-4">
        <input type="hidden" name="game_key" value={gameKey} />
        <div>
          <label htmlFor={`bgmi-player-id-${gameKey}`} className="text-sm font-medium">
            Player ID
          </label>
          <input
            id={`bgmi-player-id-${gameKey}`}
            name="game_user_id"
            type="text"
            inputMode="text"
            autoComplete="off"
            spellCheck={false}
            maxLength={GAME_USER_ID_MAX_LENGTH}
            defaultValue={gameUserId ?? ""}
            placeholder="Your in-game character ID"
            aria-describedby={`bgmi-id-hint-${gameKey}`}
            className={inputClass}
          />
          <p id={`bgmi-id-hint-${gameKey}`} className="mt-1 text-xs text-slate-500">
            {GAME_USER_ID_MIN_LENGTH}–{GAME_USER_ID_MAX_LENGTH} characters. Leading zeroes are kept.
            Leave empty and save to clear.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={pending} name="intent" value="save">
            {pending ? "Saving…" : hasId ? "Update Player ID" : "Save Player ID"}
          </Button>
          {hasId ? (
            <Button
              type="submit"
              variant="secondary"
              disabled={pending}
              name="intent"
              value="clear"
            >
              Clear Player ID
            </Button>
          ) : null}
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
