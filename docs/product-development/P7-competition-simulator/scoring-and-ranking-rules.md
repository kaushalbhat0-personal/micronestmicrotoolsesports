# Scoring and Ranking Rules (P7)

## Scoring math

`total = Σ(value × weight)` over all criteria, integer arithmetic only.
Maximum `|total| = 8 × 10⁶ × 10³ = 8×10⁹ < 2⁵³` — provably exact in
double-precision; asserted via `Number.isSafeInteger` at the limits (test).
Zero-weight criteria add nothing but still tie-break. Negative weights
model penalties. No rounding, no division, no floats.

## Ranking

1. Higher total ranks first.
2. On equal totals, criteria apply in **priority (array) order**, each with
   its own direction: `high` (larger value wins, e.g. points), `low`
   (smaller wins, e.g. deaths/penalty time).
3. Teams equal on the total **and every criterion** form a tie group and
   share one rank. No further comparison exists — there is deliberately no
   alphabetical or entry-order tie-break in the competition path.
4. Ranks use standard competition ranking ("1224"): a 2-way tie for 1st is
   followed by rank 3.

## Missing values (documented policy)

A blank score is "not entered": it counts as **0 and is flagged**
(`assumed: true`) in the breakdown, the per-team view, the assumed-count
line, and the exported summary. The engine never invents a value and never
hides the assumption. Rationale: blocking ranking on every blank would make
partial scenarios unusable; silent defaults would be dishonest. Flagged-zero
is the disclosed middle ground.

## Explanations (why, not just what)

- Sole-rank team tied on total with a neighbour: names the neighbour, the
  first differing criterion, both values, and the direction
  ("tie with "Bravo" broken by "Wins" (1 vs 3, higher wins)").
- Tie group: lists mates, states identical total + criterion count, and
  requires "another criterion or a human decision"; display is labelled
  "entry order, not ranked order".
- Otherwise: "Ranked Nth of M on total T."

## What the engine refuses

Equal-on-everything teams are never ordered as 1st/2nd; a neighbour-based
`decidedBy` is only attached when an actual differing criterion exists;
with zero criteria every team ties at 0 and the UI says so.
