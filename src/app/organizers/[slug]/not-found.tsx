import Link from "next/link";

export default function OrganizerNotFound() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6">
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-center">
        <h1 className="text-lg font-semibold">Organizer not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          The requested organizer profile could not be found.
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
