import Link from "next/link";
import { buildNotFoundMetadata } from "../_lib/query";

const copy = buildNotFoundMetadata();

// Generic not-found for the profile route. Identical for missing, private,
// suspended and inactive handles (404-equivalence): no existence signal, no
// handle echo beyond the URL the visitor already typed.
export default function PlayerNotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h1 className="text-2xl font-semibold">{copy.title}</h1>
      <p className="mt-2 text-sm text-slate-600">
        This profile does not exist or is not public. Private, suspended and removed profiles look
        exactly like this.
      </p>
      <Link
        href="/players"
        className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Browse player directory
      </Link>
    </div>
  );
}
