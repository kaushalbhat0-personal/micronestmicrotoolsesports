# Next-Phase Recommendation (P6)

## Recommended next phase: P7 — third tool (tie-breaker or qualifier aid)

Rationale: two tools now validate the extension path for both one-shot
(stateless) and session-stateful interaction models. A third, rules-driven
tool (tie-break orderings, qualification scenarios) would stress the one
untested dimension — codified competition logic — and justify the
`RunnerForTool` map refactor at 3+ branches if clumsiness appears.

## Preconditions before P7

- Owner ruling on whether any tool may encode "official" tournament rules;
  until then, all tools stay planning-aids with disclaimers.
- Decide interactive-test strategy (Playwright tool specs vs. Vitest
  interaction tests) — P6 deferred this.

## Do not

- Add persistence, accounts, uploads, or external lookups to the roster
  tool without a fresh privacy review.
- Port the D1 bulk parser into the tool casually — it changes the trust
  surface the P6 boundary was built to avoid.
- Generalize a "tools framework" (plugin loaders, dynamic runners) ahead
  of a demonstrated third-tool need.
