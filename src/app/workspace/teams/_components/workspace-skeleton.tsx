// Loading placeholder for workspace blocks. Announces the loading region
// for assistive technology; carries no data shapes.
export function WorkspaceSkeleton() {
  return (
    <div aria-label="Loading team workspace" role="status" className="mt-6 grid gap-4">
      {Array.from({ length: 3 }, (_, index) => (
        <div key={index} className="rounded-lg border border-slate-200 bg-white p-4">
          <div aria-hidden="true" className="h-4 w-1/3 rounded bg-slate-100" />
          <div aria-hidden="true" className="mt-2 h-3 w-1/2 rounded bg-slate-100" />
          <div aria-hidden="true" className="mt-3 flex gap-2">
            <div className="h-8 w-24 rounded bg-slate-100" />
            <div className="h-8 w-24 rounded bg-slate-100" />
            <div className="h-8 w-24 rounded bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
