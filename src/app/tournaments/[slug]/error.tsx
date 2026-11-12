"use client";

import Link from "next/link";

// Route-level error boundary for /tournaments/[slug] (P3 correction):
// unexpected throwables render the intentional unavailable state — never
// raw error detail, never a misleading 404. Reader outages handled inline
// in page.tsx never reach this boundary; this is the safety net.
export default function TournamentSlugError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h2 className="text-2xl font-semibold">Tournament unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">
        Could not load this tournament listing. Please try again.
      </p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/tournaments"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
        >
          Back to tournaments
        </Link>
      </div>
    </div>
  );
}
