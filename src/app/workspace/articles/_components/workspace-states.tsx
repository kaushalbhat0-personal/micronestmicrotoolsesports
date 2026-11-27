// Editorial workspace article list states: sign-in prompt, empty, and
// unavailable. Presentation only — no persistence, no fake rows.

import Link from "next/link";

export function ArticlesSignInPrompt() {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h2 className="text-lg font-semibold">Sign in to write</h2>
      <p className="mt-2 text-sm text-slate-600">
        The editorial workspace requires a signed-in author. Author identity and
        editorial authorization are awaiting decisions.
      </p>
      <Link
        href="/settings/profile"
        className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Go to settings
      </Link>
    </div>
  );
}

export function ArticlesEmpty() {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h2 className="text-lg font-semibold">No drafts yet</h2>
      <p className="mt-2 text-sm text-slate-600">
        Drafts you create will appear here for review. Publishing stays disabled until
        author identity and editorial authorization are accepted.
      </p>
      <Link
        href="/workspace/articles/new"
        className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Start a draft
      </Link>
    </div>
  );
}

export function ArticlesUnavailable() {
  return (
    <div
      role="alert"
      className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center"
    >
      <h2 className="text-lg font-semibold">Workspace unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">
        Could not load drafts. Please try again.
      </p>
      <Link
        href="/workspace/articles"
        className="mt-4 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Try again
      </Link>
    </div>
  );
}

export function ArticlesSkeleton() {
  return (
    <div aria-hidden="true" className="mt-6 space-y-3">
      <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      <div className="h-24 animate-pulse rounded-lg bg-slate-100" />
      <p className="sr-only">Loading drafts…</p>
    </div>
  );
}
