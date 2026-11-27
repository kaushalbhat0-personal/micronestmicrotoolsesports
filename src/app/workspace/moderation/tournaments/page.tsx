import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  ModerationDisabledNotice,
  ModerationQueueShell,
  ModerationSignInPrompt,
} from "../_components/moderation-states";

export const metadata: Metadata = {
  title: "Tournament reviews",
  description: "Submitted tournaments awaiting moderation (disabled).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Tournament review queue (P10) — DISABLED SHELL. Session check only; no
// publish/return/republish/archive action exists. Direct draft-to-published
// stays blocked at every layer.
export default async function ModerationTournamentsPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tournament reviews</h1>
        <ModerationSignInPrompt />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Tournament reviews</h1>
      <p className="mt-3 text-sm text-slate-600">
        Submitted listings awaiting a moderator decision: publish, return to draft with a
        reason, or archive. Rejection returns to draft — there is no stored rejected state.
      </p>
      <ModerationDisabledNotice />
      <ModerationQueueShell
        title="No submissions listed"
        description="The lifecycle table (draft, submitted, published, unpublished, archived) is validated in code and SQL; every privileged transition stays disabled."
      />
    </div>
  );
}
