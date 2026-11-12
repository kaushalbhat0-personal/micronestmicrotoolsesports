# Next-Phase Recommendation (P7.1)

## Recommended next phase: tool four on the stabilized foundation

The stabilization goal is met: three tools share a mapped runner
architecture with drift protection, a 21-test interaction suite, and
verified a11y/privacy posture. The fourth tool can proceed without paying
down further infrastructure.

## Preconditions (unchanged from P7)

- Owner ruling on the simulation-aids principle and official-rulebook
  posture before anything competition-flavoured encodes real rules.
- Human-decides posture for contested cutoffs confirmed or replaced.

## Suggested fourth-tool shape

Prefer the remaining uncovered archetype — a **planning input aid**
(e.g. schedule/fixture planner or points-table projector from
user-entered results) — over a second rules engine, keeping each tool's
domain distinct.

## Do not

- Revisit domain semantics of tools 1–3 without a product reason; the
  suites now guard them at two levels (unit + interaction).
- Generalize a tools framework (dynamic loading, plugins) — the static
  map + parity test is sufficient through at least 5–6 tools.
- Add persistence, accounts, uploads, or external data without a fresh
  privacy review.
- Expand browser/CI matrix prematurely — add it when e2e gates a deploy,
  not before.
