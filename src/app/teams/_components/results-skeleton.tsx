// Loading placeholder for the streamed team results block. Announces the
// loading region for assistive technology; carries no data shapes.
export function TeamsResultsSkeleton() {
  return (
    <div aria-label="Loading team directory results" role="status" className="mt-6 grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="flex gap-4 rounded-lg border border-slate-200 bg-white p-4">
          <div aria-hidden="true" className="h-16 w-16 shrink-0 rounded-lg bg-slate-100" />
          <div aria-hidden="true" className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-slate-100" />
            <div className="h-3 w-1/2 rounded bg-slate-100" />
            <div className="h-3 w-3/4 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
