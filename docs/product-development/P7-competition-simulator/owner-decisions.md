# Owner Decisions (P7)

## Proposed product principle — recorded, NOT claimed as approved

> "MicroNest Esports competition tools are planning and simulation aids,
> not official rules engines. They calculate outcomes from user-provided
> inputs and explicitly selected scoring rules. They must not claim that a
> result is official, tournament-approved or universally applicable."

**Status: proposed.** No owner approval has occurred or is claimed. The
implementation is built so the principle holds regardless:

- Every user-facing surface carries the simulation disclaimer (landing
  guidance, standings header, summary header + footer).
- Registry copy was scanned for "official result" / "verified" language
  (test-enforced absence).
- Nothing in the engine can produce an official-looking artifact: no
  rulebook import, no organizer branding, no verification marks.

## Decisions still required from the owner

1. **Adopt, amend, or reject the principle above.** If rejected, the three
   competition-adjacent tools need repositioning, not just relabelling.
2. **Whether any tool may ever encode an official rulebook** (e.g. a
   named BGMI points table). P7 deliberately supports only user-configured
   criteria; adding official tables needs a sourcing + versioning decision.
3. **Cutoff authority**: the simulator flags contested cutoffs but cannot
   resolve them — confirm that "human decides" is acceptable product
   posture versus a future organizer-override input.
4. **Game-specific variants**: the engine is generic (`gameKeys: null`).
   Confirm no BGMI-only labelling is wanted, and whether a future
   per-game preset (still user-editable, never official) is desirable.
5. **Interactive UX tests**: P6 deferred Playwright/Vitest-interaction
   coverage for tool flows; P7 adds more flows. Decide the harness before
   the fourth tool.
