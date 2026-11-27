import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  ModerationDisabledNotice,
  ModerationQueueShell,
  ModerationSignInPrompt,
} from "../_components/moderation-states";

export const metadata: Metadata = {
  title: "Report queue",
  description: "Tournament and organizer reports (disabled).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Report queue (P10) — DISABLED SHELL. Session check only; no report rows are
// listed (reporter identity and private details must not leak) and no review
// action exists.
export default async function ModerationReportsPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Report queue</h1>
        <ModerationSignInPrompt />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Report queue</h1>
      <p className="mt-3 text-sm text-slate-600">
        Reports against tournaments and organizers, newest first once the review boundary is
        approved. Only platform moderators will be able to see this queue.
      </p>
      <ModerationDisabledNotice />
      <ModerationQueueShell
        title="No reports listed"
        description="Report intake validation is implemented and tested; submission and review stay disabled until the moderation authority and retention rule are approved."
      />
    </div>
  );
}
