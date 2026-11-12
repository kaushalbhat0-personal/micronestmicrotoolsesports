"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { updateHandleAction, type SettingsActionState } from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

// Dedicated handle change (D-G1-05 Option A). Approximately 30 days between
// successful changes; failures never advance the cooldown. Uniqueness stays
// case-insensitive; the generic profile editor cannot change handles.
export function HandleSection({
  handle,
  nextEligibleAt,
}: {
  handle: string;
  nextEligibleAt: string | null;
}) {
  const [state, action, pending] = useActionState(updateHandleAction, initialState);
  return (
    <section
      aria-labelledby="handle-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="handle-heading" className="text-lg font-semibold">
        Handle
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Current handle: <strong>{handle}</strong>
      </p>
      <p className="mt-1 text-sm text-slate-600">
        {nextEligibleAt === null
          ? "You can change your handle now. After a successful change, the next change unlocks in about 30 days."
          : `You can change your handle again after ${nextEligibleAt}.`}
      </p>
      <form action={action} className="mt-4 flex max-w-md flex-col gap-3">
        <label htmlFor="handle-input" className="text-sm font-medium">
          New handle (3–20 characters: a–z, 0–9, _)
        </label>
        <input
          id="handle-input"
          name="handle"
          type="text"
          autoComplete="off"
          minLength={3}
          maxLength={20}
          pattern="[a-z0-9_]{3,20}"
          required
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        <div>
          <Button type="submit" disabled={pending}>
            Change handle
          </Button>
        </div>
      </form>
      {state.message.length > 0 ? (
        <p role="status" className="mt-3 text-sm text-slate-700">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
