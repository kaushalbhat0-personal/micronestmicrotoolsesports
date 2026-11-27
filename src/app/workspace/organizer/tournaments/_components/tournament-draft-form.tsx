// Tournament draft form (P9). Client component with live preview.
// Validates through the same strict contracts the server actions use, shows
// field-level feedback, renders a live preview of the validated draft, and
// submits to the gated server action — which validates again and returns the
// disabled-boundary message (never a fake success).

"use client";

import { useActionState, useState } from "react";
import { createTournamentDraftAction } from "../../actions";
import type { OrganizerWorkspaceActionState } from "../../_lib/boundary";

const initialState: OrganizerWorkspaceActionState = { ok: false, message: "" };

function Field({
  label,
  name,
  defaultValue,
  required,
  type,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="grid gap-1 text-sm">
      <span className="font-medium text-slate-700">
        {label}
        {required ? " *" : ""}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        type={type ?? "text"}
        placeholder={placeholder}
        className="rounded-md border border-slate-300 px-3 py-2"
      />
      {hint !== undefined ? <span className="text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

export function TournamentDraftForm({ organizerId }: { organizerId: string }) {
  const [state, action, pending] = useActionState(createTournamentDraftAction, initialState);
  const [preview, setPreview] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <form action={action} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
        <input type="hidden" name="organizerId" value={organizerId} />
        <Field label="Tournament title" name="title" required placeholder="City Clash Cup" />
        <Field
          label="Slug"
          name="slug"
          required
          placeholder="city-clash-cup"
          hint="Lowercase words joined by hyphens, 2–80 chars. Never changes after creation."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Game key"
            name="gameKey"
            defaultValue="bgmi"
            required
            hint="Only bgmi is supported in this phase."
          />
          <Field
            label="Region code"
            name="regionCode"
            required
            placeholder="india"
            hint="BGMI vocabulary: india, asia, europe, north-america, south-america, middle-east, online."
          />
        </div>
        <label className="grid gap-1 text-sm">
          <span className="font-medium text-slate-700">Format *</span>
          <select
            name="format"
            required
            className="rounded-md border border-slate-300 px-3 py-2"
            defaultValue="team"
          >
            <option value="team">Teams</option>
            <option value="individual">Individual players</option>
            <option value="both">Teams and individual players</option>
          </select>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Starts at (UTC ISO)"
            name="startsAt"
            required
            placeholder="2026-12-01T10:00:00Z"
          />
          <Field
            label="Ends at (UTC ISO)"
            name="endsAt"
            required
            placeholder="2026-12-02T18:00:00Z"
          />
        </div>
        <Field
          label="Timezone (IANA)"
          name="timezone"
          required
          placeholder="Asia/Kolkata"
          hint="Display-only. Must be a valid IANA timezone."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Entry fee (minor units)"
            name="entryFeeMinor"
            placeholder="0 = free, empty = not disclosed"
          />
          <Field label="Entry fee currency (ISO)" name="entryFeeCurrency" placeholder="INR" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Prize pool (minor units)"
            name="prizePoolMinor"
            placeholder="Empty = not disclosed"
          />
          <Field label="Prize currency (ISO)" name="prizePoolCurrency" placeholder="INR" />
        </div>
        <Field
          label="Registration URL (https)"
          name="registrationUrl"
          required
          placeholder="https://organizer.example/register"
          hint="External only. https, no credentials, handed off verbatim."
        />
        <Field
          label="Contact instructions"
          name="contactInstructions"
          placeholder="Optional, ≤ 500 chars"
        />
        <Field label="Description" name="description" placeholder="Optional, ≤ 4000 chars" />
        {state.message !== "" ? (
          <p
            role={state.ok ? "status" : "alert"}
            className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
          >
            {state.message}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? "Validating…" : "Save draft"}
          </button>
          <button
            type="button"
            onClick={() => {
              const form = document.querySelector("form");
              if (form instanceof HTMLFormElement) {
                const data = new FormData(form);
                const title = String(data.get("title") ?? "");
                const slug = String(data.get("slug") ?? "");
                setPreview(title !== "" || slug !== "" ? `${title} (@${slug})` : null);
              }
            }}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Preview
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Drafts validate locally with strict schemas (money in minor units, https-only URLs, IANA
          timezones). Saving and submission are disabled until ownership and moderation boundaries
          are approved — validation never implies persistence.
        </p>
      </form>
      {preview !== null ? (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Draft preview</h2>
          <p className="mt-2 text-sm text-slate-700">{preview}</p>
          <p className="mt-1 text-xs text-slate-500">
            Preview only — nothing here is published or saved.
          </p>
        </div>
      ) : null}
    </div>
  );
}
