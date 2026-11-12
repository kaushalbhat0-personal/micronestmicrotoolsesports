# Qualification Semantics (P7)

## Cutoff model

`cutoff = 0` means no qualification line (every team `no-cutoff`).
Otherwise "top N qualify", computed from **positions**, never names: a tie
group occupying positions `start…end` qualifies cleanly iff `end ≤ N`.

## States

| Status | Meaning |
|--------|---------|
| `qualified` | Group fully inside the cutoff ("Inside the top N."). |
| `out` | Group fully outside ("Outside the top N."). |
| `contested` | Group straddles the cutoff. Nobody in it is auto-qualified; the note says a further criterion or human decision is needed. |
| `no-cutoff` | No line configured; no badge shown. |

`cutoffContested` flags the scenario; the runner shows an amber banner
above standings ("The top-N line cuts through a tie…").

## Tie across the cutoff

By construction a straddling group is fully equal on total and every
criterion, so no configured rule can separate it — auto-qualifying one side
would invent a result. The engine reports `contested` for the whole group
and refuses to pick. Cutoffs larger than the field qualify everyone
without contest (tested).

## Display vs. status

Qualification badges render only when a cutoff is set. Tied teams share
the same state; display order inside the group remains entry order and is
never presented as a qualification order.
