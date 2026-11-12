import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  ModerationDisabledNotice,
  ModerationQueueShell,
  ModerationSignInPrompt,
} from "./_components/moderation-states";

export const metadata: Metadata = {
  title: "Moderation workspace",
  description: "Review queue for tournament and organizer moderation (disabled).",
  // Private authenticated surface: never indexed, never followed.
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

// Moderation workspace index (P10) — DISABLED SHELL. Thin orchestration:
// session check only, then the honest disabled state. No queue tables exist,
// no reviewer boundary is proven, and no approve/return/publish action is
// reachable from any route under this path.
async function ModerationIndex() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (user === null) {
    return <ModerationSignInPrompt />;
  }
  return (
    <>
      <ModerationDisabledNotice />
      <nav aria-label="Moderation queues" className="mt-6">
        <ul className="grid gap-4">
          <li className="rounded-lg border border-slate-200 bg-white p-4">
            <Link href="/workspace/moderation/reports" className="text-base font-semibold underline">
              Report queue
            </Link>
            <p className="mt-1 text-sm text-slate-600">
              Tournament and organizer reports. Intake validation exists; review stays disabled.
            </p>
          </li>
          <li className="rounded-lg border border-slate-200 bg-white p-4">
            <Link
              href="/workspace/moderation/tournaments"
              className="text-base font-semibold underline"
            >
              Tournament reviews
            </Link>
            <p className="mt-1 text-sm text-slate-600">
              Submitted listings awaiting moderator publish, return, or archival decisions.
            </p>
          </li>
          <li className="rounded-lg border border-slate-200 bg-white p-4">
            <Link
              href="/workspace/moderation/organizers"
              className="text-base font-semibold underline"
            >
              Organizer verification
            </Link>
            <p className="mt-1 text-sm text-slate-600">
              Submitted organizers awaiting manual evidence review. No evidence intake exists yet.
            </p>
          </li>
        </ul>
      </nav>
      <ModerationQueueShell
        title="No review queue is operational"
        description="Queue tables, reviewer authority, and retention rules are awaiting owner decisions. This shell lists nothing and approves nothing."
      />
    </>
  );
}

export default function ModerationWorkspacePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Moderation workspace</h1>
      <p className="mt-3 text-sm text-slate-600">
        Tournament and organizer review queues. Publishing, verification, and archival decisions
        stay disabled until reviewer authority and retention policy are approved.
      </p>
      <Suspense
        fallback={
          <p role="status" className="mt-6 text-sm text-slate-600">
            Loading moderation workspace…
          </p>
        }
      >
        <ModerationIndex />
      </Suspense>
    </div>
  );
}
