"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import type { ProfileCompletenessMissing } from "@/features/player-profile/server/completeness";
import {
  setDiscoverabilityAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

const MISSING_COPY: Record<ProfileCompletenessMissing, string> = {
  handle: "Add a handle.",
  display_name: "Add a display name.",
  avatar_or_bio: "Add an avatar or a bio.",
  game_profile: "Add at least one game profile.",
};

// Master discoverability consent (P15-M2B.1).
// Consent preference (is_discoverable) is separate from completeness and from
// verification. Enable is blocked while incomplete (UI + RPC). Public directory
// also requires completeness, so incomplete + consented stays invisible.
export function DiscoverabilitySection({
  isDiscoverable,
  profileComplete,
  missing,
}: {
  isDiscoverable: boolean;
  profileComplete: boolean;
  missing: ProfileCompletenessMissing[];
}) {
  const [state, action, pending] = useActionState(setDiscoverabilityAction, initialState);
  const canEnable = profileComplete && !isDiscoverable;

  return (
    <section
      aria-labelledby="discoverability-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="discoverability-heading" className="text-lg font-semibold">
        Make my player profile discoverable
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        This switch stores your consent preference. A complete profile plus consent is required
        before you can enable it. Appearing in the public player registry also requires an approved
        BGMI ownership review with a matching Player ID. You can still share your public profile
        URL and download a PNG without that review. Consent is never erased when review is missing
        or invalidated. You can turn consent off at any time.
      </p>
      <p className="mt-3 text-sm">
        Consent preference:{" "}
        <strong>{isDiscoverable ? "Opted in" : "Opted out (default)"}</strong>
      </p>
      <p className="mt-1 text-sm">
        Registry listing:{" "}
        <strong>
          {isDiscoverable && profileComplete
            ? "Consent saved — registry also needs approved ownership review"
            : "Not listed in the public registry"}
        </strong>
      </p>
      {!profileComplete ? (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Complete your profile before enabling discoverability.</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {missing.map((item) => (
              <li key={item}>{MISSING_COPY[item]}</li>
            ))}
          </ul>
          {isDiscoverable ? (
            <p className="mt-2">
              Your consent is still saved as opted in, but you will not appear in public discovery
              until the missing items are fixed.
            </p>
          ) : null}
        </div>
      ) : null}
      <p className="mt-3 text-sm text-slate-600">
        Both this master switch and per-game visibility must be on for a game profile to appear
        publicly.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={action}>
          <input type="hidden" name="is_discoverable" value="true" />
          <Button type="submit" disabled={pending || !canEnable} aria-disabled={!canEnable}>
            Enable discoverability
          </Button>
        </form>
        <form action={action}>
          <input type="hidden" name="is_discoverable" value="false" />
          <Button
            type="submit"
            variant="secondary"
            disabled={pending || !isDiscoverable}
          >
            Disable discoverability
          </Button>
        </form>
      </div>
      {state.message.length > 0 ? (
        <p
          role={state.ok ? "status" : "alert"}
          className={`mt-3 text-sm ${state.ok ? "text-slate-700" : "text-accent-600"}`}
        >
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
