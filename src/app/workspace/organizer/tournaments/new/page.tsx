import type { Metadata } from "next";
import Link from "next/link";
import { TournamentDraftForm } from "../_components/tournament-draft-form";

export const metadata: Metadata = {
  title: "New tournament draft",
  description: "Draft a tournament listing for your organizer profile.",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function NewTournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const raw = await searchParams;
  const value = raw["organizer"];
  const organizerId = Array.isArray(value) ? value[0] : value;
  if (typeof organizerId !== "string" || organizerId.trim() === "") {
    return (
      <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">New tournament draft</h1>
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
          <h2 className="text-lg font-semibold">Choose an organizer first</h2>
          <p className="mt-2 text-sm text-slate-600">
            Tournament drafts belong to exactly one organizer. Choose the organizer profile first.
          </p>
          <Link
            href="/workspace/organizer/tournaments"
            className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Choose organizer
          </Link>
        </div>
      </div>
    );
  }
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6">
      <p className="mb-4 text-sm">
        <Link
          href={`/workspace/organizer/tournaments?organizer=${organizerId}`}
          className="rounded text-slate-600 underline-offset-2 hover:underline"
        >
          ← Back to managed tournaments
        </Link>
      </p>
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">New tournament draft</h1>
      <p className="mt-3 text-sm text-slate-600">
        Drafts validate locally with strict schemas. Saving and submission stay disabled until the
        moderation boundary is approved — nothing here is published.
      </p>
      <p className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Publishing is disabled in this phase. The form validates your input; saving, submission and
        publication cannot complete yet.
      </p>
      <TournamentDraftForm organizerId={organizerId} />
    </div>
  );
}
