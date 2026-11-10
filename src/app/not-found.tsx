import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h2 className="text-2xl font-semibold">Page not found</h2>
      <p className="mt-2 text-sm text-slate-600">
        The page you are looking for does not exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-6 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Back to home
      </Link>
    </div>
  );
}
