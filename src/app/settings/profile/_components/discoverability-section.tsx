"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  setDiscoverabilityAction,
  type SettingsActionState,
} from "../actions";

const initialState: SettingsActionState = { ok: false, message: "" };

// Master discoverability consent (04 section 2 + approved copy 2026-11-11).
// Explicit enable/disable control; the flag defaults off and withdrawal is
// immediate on the next public RPC call. Both master and per-game visibility
// must be on for a game row to appear publicly.
export function DiscoverabilitySection({ isDiscoverable }: { isDiscoverable: boolean }) {
  const [state, action, pending] = useActionState(setDiscoverabilityAction, initialState);
  return (
    <section
      aria-labelledby="discoverability-heading"
      className="rounded-lg border border-slate-200 bg-white p-5"
    >
      <h2 id="discoverability-heading" className="text-lg font-semibold">
        Make my player profile discoverable
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        When enabled, your approved profile and visible game profiles can appear in the public
        player directory and on your public profile page. You can turn this off at any time.
        When disabled, your profile will no longer be returned by public discovery.
      </p>
      <p className="mt-3 text-sm">
        Current state:{" "}
        <strong>{isDiscoverable ? "Discoverable" : "Not discoverable (default)"}</strong>
      </p>
      <p className="mt-1 text-sm text-slate-600">
        Both this master switch and per-game visibility must be on for a game profile to appear
        publicly.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={action}>
          <input type="hidden" name="is_discoverable" value="true" />
          <Button type="submit" disabled={pending || isDiscoverable}>
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
        <p role="status" className="mt-3 text-sm text-slate-700">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
