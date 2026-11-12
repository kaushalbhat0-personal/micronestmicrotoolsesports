export function NewsResultsSkeleton() {
  return (
    <div aria-hidden="true" className="mt-6 space-y-4">
      <div className="h-48 animate-pulse rounded-lg bg-slate-100" />
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-32 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <p className="sr-only">Loading stories…</p>
    </div>
  );
}
