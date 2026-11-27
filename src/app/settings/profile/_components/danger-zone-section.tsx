"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  deletePlayerProfileAction,
  removeGameProfileAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

// Deletion controls (D-G1-07 Option A: hard delete after confirmation).
// Game-profile removal deletes one owned game row; canonical-profile
// deletion removes the canonical profile and all associated game profiles.
// Neither deletes the login/account, Auth identity, app_users anchor,
// catalogue rows or other users' data. Handles become reusable immediately.
export function DangerZoneSection({
  handle,
  games,
}: {
  handle: string;
  games: Array<{ game_key: string; ign: string }>;
}) {
  const [removeState, removeAction, removePending] = useActionState(
    removeGameProfileAction,
    initialState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePlayerProfileAction,
    initialState,
  );
  return (
    <section
      aria-labelledby="danger-zone-heading"
      className="rounded-lg border border-red-200 bg-white p-5"
    >
      <h2 id="danger-zone-heading" className="text-lg font-semibold text-red-900">
        Delete
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Deletion is immediate and permanent. There is no grace period or recovery. Deleting
        your player profile does not delete your login or account.
      </p>

      <h3 className="mt-5 text-sm font-semibold">Remove a game profile</h3>
      {games.length === 0 ? (
        <p className="mt-1 text-sm text-slate-600">No game profiles to remove.</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {games.map((game) => (
            <li
              key={game.game_key}
              className="rounded-md border border-slate-100 px-3 py-2"
            >
              <form action={removeAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="game_key" value={game.game_key} />
                <span className="text-sm">
                  {game.game_key} · {game.ign}
                </span>
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="confirm" value="yes" required />
                  I understand this removes this game profile permanently.
                </label>
                <Button type="submit" variant="secondary" disabled={removePending}>
                  Remove {game.game_key}
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {removeState.message.length > 0 ? (
        <p role="status" className="mt-3 text-sm text-slate-700">
          {removeState.message}
        </p>
      ) : null}

      <h3 className="mt-6 text-sm font-semibold">Delete player profile</h3>
      <p className="mt-1 text-sm text-slate-600">
        This deletes your canonical player profile and all associated game profiles, plus
        your avatar. Your login stays intact and your handle becomes available again
        immediately.
      </p>
      <form action={deleteAction} className="mt-3 flex max-w-md flex-col gap-3">
        <label htmlFor="confirm-handle-input" className="text-sm font-medium">
          Type your handle (<span>{handle}</span>) to confirm
        </label>
        <input
          id="confirm-handle-input"
          name="confirm_handle"
          type="text"
          autoComplete="off"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="confirm" value="yes" required />I understand this
          permanently deletes my player profile and all my game profiles.
        </label>
        <div>
          <Button type="submit" variant="secondary" disabled={deletePending}>
            Delete my player profile
          </Button>
        </div>
      </form>
      {deleteState.message.length > 0 ? (
        <p role="status" className="mt-3 text-sm text-slate-700">
          {deleteState.message}
        </p>
      ) : null}
    </section>
  );
}
