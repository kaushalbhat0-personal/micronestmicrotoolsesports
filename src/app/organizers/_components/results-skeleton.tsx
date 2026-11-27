export function OrganizersResultsSkeleton() {
  return (
    <div className="mt-6" aria-hidden="true">
      <div className="h-4 w-48 animate-pulse rounded bg-slate-200" />
      <ul className="mt-4 grid gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <li key={index} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="mt-3 h-4 w-1/3 animate-pulse rounded bg-slate-100" />
          </li>
        ))}
      </ul>
    </div>
  );
}
