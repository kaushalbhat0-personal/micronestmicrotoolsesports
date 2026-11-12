import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import {
  ModerationDisabledNotice,
  ModerationQueueShell,
  ModerationSignInPrompt,
} from "../_components/moderation-states";

export const metadata: Metadata = {
  title: "Organizer verification",
  description: "Submitted organizers awaiting verification review (disabled).",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Organizer verification queue (P10) — DISABLED SHELL. Session check only;
// no submission intake, no evidence upload, and no confirm/reject/expire
// action exists. Domain ownership alone is never treated as legitimacy.
export default async function ModerationOrganizersPage() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user === null) {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Organizer verification</h1>
        <ModerationSignInPrompt />
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Organizer verification</h1>
      <p className="mt-3 text-sm text-slate-600">
        Submitted organizers awaiting manual evidence review. Only platform moderators will
        review; organizer owners can never approve their own verification.
      </p>
      <ModerationDisabledNotice />
      <ModerationQueueShell
        title="No verifications listed"
        description="The verification workflow (submitted, under review, confirmed, rejected, expired) is specified with every transition disabled. Evidence intake arrives only with approved storage, access, and retention policy."
      />
    </div>
  );
}
