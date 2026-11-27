"use client";

import { useActionState } from "react";
import {
  BGMI_PLAY_MODES,
  BGMI_REGION_VOCABULARY,
  BGMI_ROLES,
} from "@/features/player-profile/schemas/game";
import {
  completeProfileOnboardingAction,
  type OnboardingActionState,
} from "./actions";

const inputClass =
  "rounded-none border border-slate-300 bg-white px-3 py-2 text-sm text-ink-900 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent-600";
const labelClass = "text-sm font-medium text-ink-900";

const initialState: OnboardingActionState = { ok: false, message: "" };

export function ProfileOnboardingForm({
  defaultDisplayName,
}: {
  defaultDisplayName?: string | undefined;
}) {
  const [state, formAction, pending] = useActionState(
    completeProfileOnboardingAction,
    initialState,
  );

  return (
    <form action={formAction} aria-label="Complete player profile" className="grid gap-5">
      <fieldset className="grid gap-4">
        <legend className="font-display text-sm font-extrabold tracking-wide uppercase">
          Player identity
        </legend>
        <p className="text-xs text-slate-600">
          Self-reported only. Completing this form does not verify your identity or game account.
        </p>
        <div className="flex flex-col gap-1">
          <label htmlFor="onboard-handle" className={labelClass}>
            Handle
          </label>
          <input
            id="onboard-handle"
            name="handle"
            type="text"
            required
            minLength={3}
            maxLength={20}
            pattern="[a-z0-9_]{3,20}"
            placeholder="nova_cap"
            className={inputClass}
            aria-describedby="handle-help"
          />
          <p id="handle-help" className="text-xs text-slate-500">
            3–20 characters: lowercase letters, numbers, underscore.
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="onboard-display-name" className={labelClass}>
            Display name
          </label>
          <input
            id="onboard-display-name"
            name="display_name"
            type="text"
            required
            minLength={1}
            maxLength={40}
            defaultValue={defaultDisplayName ?? ""}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="onboard-country" className={labelClass}>
            Country / region (ISO code)
          </label>
          <input
            id="onboard-country"
            name="country_code"
            type="text"
            maxLength={2}
            placeholder="IN"
            className={inputClass}
            aria-describedby="country-help"
          />
          <p id="country-help" className="text-xs text-slate-500">
            Optional ISO 3166-1 alpha-2 code (for example IN, US).
          </p>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="onboard-bio" className={labelClass}>
            Short bio
          </label>
          <textarea
            id="onboard-bio"
            name="bio"
            rows={3}
            maxLength={280}
            placeholder="BGMI IGL focused on grassroots cups."
            className={inputClass}
            aria-describedby="bio-help"
          />
          <p id="bio-help" className="text-xs text-slate-500">
            Optional but recommended — a bio or later avatar is required for a complete profile.
          </p>
        </div>
      </fieldset>

      <fieldset className="grid gap-4">
        <legend className="font-display text-sm font-extrabold tracking-wide uppercase">
          Game profile (BGMI)
        </legend>
        <input type="hidden" name="game_key" value="bgmi" />
        <div className="flex flex-col gap-1">
          <label htmlFor="onboard-ign" className={labelClass}>
            In-game name (IGN)
          </label>
          <input
            id="onboard-ign"
            name="ign"
            type="text"
            required
            minLength={2}
            maxLength={30}
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="onboard-role" className={labelClass}>
            Primary role
          </label>
          <select id="onboard-role" name="primary_role" className={inputClass} defaultValue="">
            <option value="">Flexible / unset</option>
            {BGMI_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="onboard-region" className={labelClass}>
            Game region
          </label>
          <select id="onboard-region" name="region_code" className={inputClass} defaultValue="">
            <option value="">Unset</option>
            {BGMI_REGION_VOCABULARY.map((region) => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className={`${labelClass} mb-2`}>Play modes</legend>
          <div className="flex flex-wrap gap-3">
            {BGMI_PLAY_MODES.map((mode) => (
              <label key={mode} className="inline-flex min-h-[44px] items-center gap-2 text-sm">
                <input type="checkbox" name="play_modes" value={mode} className="size-4" />
                {mode}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      {state.message ? (
        <p role="alert" className="text-accent-600 text-sm">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="bg-accent-600 hover:bg-accent-700 focus-visible:outline-accent-600 inline-flex min-h-[44px] items-center justify-center px-4 py-2 text-sm font-bold tracking-wide text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-60"
      >
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
