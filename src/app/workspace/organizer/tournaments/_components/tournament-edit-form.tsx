"use client";

import { useActionState } from "react";
import { updateTournamentDraftAction } from "../../actions";
import type { OrganizerWorkspaceActionState } from "../../_lib/boundary";

const initialState: OrganizerWorkspaceActionState = { ok: false, message: "" };

function Field({
  label,
  name,
  defaultValue,
  type,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        type={type ?? "text"}
        className="rounded-md border border-slate-300 px-3 py-2"
      />
      {hint !== undefined ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function TournamentEditForm({
  tournamentId,
  initial,
}: {
  tournamentId: string;
  initial: { title: string; startsAt: string; endsAt: string };
}) {
  const [state, action, pending] = useActionState(updateTournamentDraftAction, initialState);
  return (
    <form
      action={action}
      className="mt-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4"
    >
      <input type="hidden" name="tournament_id" value={tournamentId} />
      <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Locked through edits: slug and game. Ownership and lifecycle can never move through this
        form.
      </p>
      <Field label="Tournament title" name="title" defaultValue={initial.title} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts at (UTC ISO)" name="startsAt" defaultValue={initial.startsAt} />
        <Field label="Ends at (UTC ISO)" name="endsAt" defaultValue={initial.endsAt} />
      </div>
      <Field
        label="Timezone (IANA)"
        name="timezone"
        hint="Display-only. Must be a valid IANA timezone."
      />
      <Field
        label="Registration URL (https)"
        name="registrationUrl"
        hint="External only. https, no credentials."
      />
      {state.message !== "" ? (
        <p
          role="alert"
          className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {state.message}
        </p>
      ) : null}
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {pending ? "Validating…" : "Save changes"}
        </button>
      </div>
      <p className="text-xs text-slate-500">
        Saving stays disabled until ownership and moderation boundaries are approved. Unpublish and
        archive actions require moderator authority and are not available here.
      </p>
    </form>
  );
}
