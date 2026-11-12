# Route and Component Map (P7)

## Routes (no new route files)

- `/tools` — discovers via `TOOL_REGISTRY`; `gameKeys: null` keeps the tool
  visible under every game filter (generic engine, no BGMI semantics);
  `scoring` category isolates it; search matches name/tagline.
- `/tools/tiebreak-qualifier` — existing `[slug]` landing + inline runner
  (`availability: "available"`). Invalid slugs keep 404-equivalence.

## Runner sections (`tiebreak-runner.tsx`, client)

```
├─ Scenario          name · cutoff (0 = off)
├─ Criteria          priority-ordered list (#n badges, weight + direction)
│    · ↑/↓ priority (disabled at ends) · inline edit · two-step remove
│    · add form (name · weight · direction)
├─ Teams             cards (sm:grid-cols-2, no table-only model)
│    · rename (inline) · two-step remove · per-criterion score inputs
│    · invalid input stays a local draft; domain keeps last valid value
├─ Standings          aria-live: rank badges · totals · breakdowns
│    · explanations · qualification badges · contested banner
│    · missing-as-zero + tie-honesty status lines
├─ Snapshots         save · restore (two-step) · delete; memory-only
└─ Summary           pre block (aria-live) + Copy + Reset (two-step)
```

## Interaction contract

- Domain ops run eagerly against current state so `ScenarioError` surfaces
  synchronously next to its control; nothing is silently overwritten.
- Native inputs/selects/buttons, visible focus rings, `role="alert"` for
  failures, `role="status"` for empty/contested states, `aria-live`
  standings + summary.
- Standings show whenever teams exist (even with zero criteria — the
  all-tied-at-0 state is itself the honest answer, with a nudge to add a
  criterion).
