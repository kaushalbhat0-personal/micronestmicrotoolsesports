"use client";

import Link from "next/link";

// Route-level error boundary for /tools/[slug]: unexpected throwables render
// an honest retry state — never raw error detail, never a fake 404.
export default function ToolSlugError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h2 className="text-2xl font-semibold">Tool unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">Could not load this tool. Please try again.</p>
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Try again
        </button>
        <Link
          href="/tools"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-900"
        >
          Back to tools
        </Link>
      </div>
    </div>
  );
}
