// Streaming fallback for the directory results block. The directory shell
// (heading, copy, filters) paints immediately; this skeleton holds the
// results region until the reader resolves. Neutral pulse blocks only — no
// copy that implies streaming feeds, telemetry or record counts.
export function ResultsSkeleton() {
  return (
    <div aria-label="Loading player directory results" className="mt-6" role="status">
      <div className="h-5 w-48 animate-pulse bg-steel-200" />
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="h-44 animate-pulse border border-slate-deep/20 bg-steel-100" />
        <div className="h-44 animate-pulse border border-slate-deep/20 bg-steel-100" />
      </div>
    </div>
  );
}
