// Loading placeholder for the streamed tournament results block. Announces
// the loading region for assistive technology; carries no data shapes.
export function TournamentsResultsSkeleton() {
  return (
    <div aria-label="Loading tournament directory results" role="status" className="mt-6 grid gap-4 md:grid-cols-2">
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} aria-hidden="true" className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <div className="h-4 w-2/3 rounded bg-slate-100" />
          <div className="h-3 w-1/2 rounded bg-slate-100" />
          <div className="h-3 w-3/4 rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
