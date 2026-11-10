"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center sm:px-6">
      <h2 className="text-2xl font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-slate-600">
        {error.digest
          ? `Reference: ${error.digest}`
          : "Please try again. If the problem persists, contact support."}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
      >
        Try again
      </button>
    </div>
  );
}
