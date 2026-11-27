import Link from "next/link";

export function WorkspaceSignInPrompt() {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h2 className="text-lg font-semibold">Sign in required</h2>
      <p className="mt-2 text-sm text-slate-600">
        Sign in to manage your organizer profiles and tournament drafts.
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

export function WorkspaceUnavailable() {
  return (
    <div role="alert" className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h2 className="text-lg font-semibold">Organizer workspace unavailable</h2>
      <p className="mt-2 text-sm text-slate-600">
        Could not load your organizer workspace. Please try again.
      </p>
    </div>
  );
}

export function WorkspaceEmptyOrganizers() {
  return (
    <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 text-center">
      <h2 className="text-lg font-semibold">No organizer profiles yet</h2>
      <p className="mt-2 text-sm text-slate-600">
        Organizer publishing is disabled in this phase while ownership, verification and moderation
        boundaries await decisions. New organizer profiles cannot be saved yet.
      </p>
    </div>
  );
}

export function WorkspaceSkeleton() {
  return (
    <div className="mt-6" aria-hidden="true">
      <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 h-24 animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}
