// Organizer directory filter form (P9). GET-only shareable filters: game,
// region, organizer type, search query. No POST, no mutations.

import Link from "next/link";
import type { OrganizerFilters } from "../_lib/query";
import { buildOrganizersHref } from "../_lib/query";

export function OrganizerFiltersForm({ filters }: { filters: OrganizerFilters }) {
  return (
    <form
      method="get"
      action="/organizers"
      className="grid gap-3 rounded-lg border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5"
    >
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Game</span>
        <input
          name="game"
          defaultValue={filters.game ?? ""}
          placeholder="e.g. bgmi"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Region</span>
        <input
          name="region"
          defaultValue={filters.region ?? ""}
          placeholder="e.g. india"
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Type</span>
        <select
          name="type"
          defaultValue={filters.organizerType ?? ""}
          className="rounded-md border border-slate-300 px-3 py-2"
        >
          <option value="">All types</option>
          <option value="independent">Independent organizer</option>
          <option value="organization">Organization-run</option>
          <option value="professional">Professional operator</option>
        </select>
      </label>
      <label className="grid gap-1 text-sm">
        <span className="font-medium text-slate-700">Search</span>
        <input
          name="query"
          defaultValue={filters.query ?? ""}
          placeholder="Organizer name"
          maxLength={120}
          className="rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white"
        >
          Apply
        </button>
        <Link
          href={buildOrganizersHref({}, 1)}
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
