import Link from "next/link";

// Route-level not-found for /tournaments/[slug]: generic 404-equivalence
// copy. Identical for invalid, missing and unpublished slugs (P3 posture:
// no existence oracle, no internal detail).
export default function TournamentSlugNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold">Tournament not found</h1>
      <p className="mt-2 text-sm text-slate-600">
        The requested tournament could not be found.
      </p>
      <Link
        href="/tournaments"
        className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Back to tournaments
      </Link>
    </div>
  );
}
