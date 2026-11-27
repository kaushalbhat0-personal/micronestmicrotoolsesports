"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  updateProfileDetailsAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

const inputClass =
  "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-slate-900";

export function ProfileDetailsSection({
  displayName,
  bio,
  countryCode,
}: {
  displayName: string;
  bio: string | null;
  countryCode: string | null;
}) {
  const [state, action, pending] = useActionState(updateProfileDetailsAction, initialState);

  return (
    <section
      aria-labelledby="profile-details-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="profile-details-heading" className="text-lg font-semibold">
        Profile details
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Public display name, bio, and country. Completeness needs a display name plus an avatar or
        bio. This is self-reported — not a verification badge.
      </p>
      <form action={action} className="mt-4 grid gap-4">
        <div>
          <label htmlFor="settings-display-name" className="text-sm font-medium">
            Display name
          </label>
          <input
            id="settings-display-name"
            name="display_name"
            type="text"
            required
            maxLength={40}
            defaultValue={displayName}
            autoComplete="nickname"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="settings-bio" className="text-sm font-medium">
            Short bio <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <textarea
            id="settings-bio"
            name="bio"
            rows={3}
            maxLength={280}
            defaultValue={bio ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="settings-country" className="text-sm font-medium">
            Country code <span className="font-normal text-slate-500">(optional, ISO alpha-2)</span>
          </label>
          <input
            id="settings-country"
            name="country_code"
            type="text"
            maxLength={2}
            defaultValue={countryCode ?? ""}
            placeholder="IN"
            autoComplete="country"
            className={`${inputClass} uppercase`}
          />
        </div>
        <div>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save profile details"}
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
