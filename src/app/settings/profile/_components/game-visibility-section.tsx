"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  setGameVisibilityAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

interface GameVisibility {
  game_key: string;
  ign: string;
  is_visible: boolean;
}

// Per-game visibility (04 section 2). Independent of the master switch: a
// game row appears publicly only when master discoverability AND this flag
// are on (plus active account and active game, enforced by the RPCs).
export function GameVisibilitySection({
  games,
  masterDiscoverable,
}: {
  games: GameVisibility[];
  masterDiscoverable: boolean;
}) {
  const [state, action, pending] = useActionState(setGameVisibilityAction, initialState);
  return (
    <section
      aria-labelledby="game-visibility-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="game-visibility-heading" className="text-lg font-semibold">
        Game visibility
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Control each game profile independently. A game profile appears in public discovery
        only when both the master discoverability switch above and this per-game switch are
        on.
        {!masterDiscoverable
          ? " Master discoverability is currently off, so no game profile is publicly visible."
          : ""}
      </p>
      {games.length === 0 ? (
        <p className="mt-3 text-sm text-slate-600">No game profiles yet.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {games.map((game) => (
            <li
              key={game.game_key}
              className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2"
            >
              <div>
                <p className="text-sm font-medium">
                  {game.game_key} · {game.ign}
                </p>
                <p className="text-sm text-slate-600">
                  {game.is_visible ? "Visible" : "Hidden"}
                </p>
              </div>
              <div className="flex gap-2">
                <form action={action}>
                  <input type="hidden" name="game_key" value={game.game_key} />
                  <input type="hidden" name="is_visible" value="true" />
                  <Button type="submit" variant="secondary" disabled={pending || game.is_visible}>
                    Show
                  </Button>
                </form>
                <form action={action}>
                  <input type="hidden" name="game_key" value={game.game_key} />
                  <input type="hidden" name="is_visible" value="false" />
                  <Button
                    type="submit"
                    variant="secondary"
                    disabled={pending || !game.is_visible}
                  >
                    Hide
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
      {state.message.length > 0 ? (
        <p role="status" className="mt-3 text-sm text-slate-700">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
