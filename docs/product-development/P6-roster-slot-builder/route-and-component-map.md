# Route and Component Map (P6)

## Routes (no new route files)

- `/tools` — directory discovers the tool via `TOOL_REGISTRY`; game filter
  `bgmi` includes it, unrelated games exclude it, category
  `team-management` isolates it.
- `/tools/roster-slot-builder` — existing `[slug]` landing renders hero,
  audience/compat, inputs/outputs, guidance, then the runner inline
  (`availability: "available"`).
- Invalid slugs keep generic 404-equivalence; no coming-soon logic touched.

## Components

```
src/app/tools/[slug]/_components/roster-builder-runner.tsx  (new, client)
  ├─ Roster plan section      team name · starter count · substitute count
  ├─ Completeness section     status line (aria-live) + progressbar + counts
  ├─ Add-player section       name · player ID · role · slot · notes + Add
  ├─ Players section          cards (sm:grid-cols-2, no table-only model)
  │    ├─ view: name + role/slot badges, edit · slot select · remove (2-step)
  │    └─ edit: inline fields + Save/Cancel, duplicate feedback inline
  ├─ Needs-attention box      empty-starter + unassigned issues
  └─ Summary section          pre block (aria-live) + Copy + Reset (2-step)
```

## Interaction contract

- Domain ops run eagerly against current state so `RosterError` messages
  surface synchronously next to the causing control (config error, slot
  error, add/edit failure). No silent overwrites, no silent drops.
- Keyboard: native inputs/selects/buttons throughout, visible focus rings
  (P5 token classes), `role="progressbar"` with min/max/now, `role="alert"`
  for failures, `aria-live="polite"` for status and summary.
- Mobile: stacked cards; `sm:` grids only enhance. Reset disabled while
  the roster is pristine; armed confirm states ("Confirm remove",
  "Confirm reset" + "Keep …" escape hatches).
