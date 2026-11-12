"use client";

import Link from "next/link";

export default function OrganizerSlugError() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div role="alert" className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold">Organizer unavailable</h1>
        <p className="mt-2 text-sm text-slate-600">
          Could not load this organizer profile. Please try again.
        </p>
        <Link
          href="/organizers"
          className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Back to organizers
        </Link>
      </div>
    </div>
  );
}
