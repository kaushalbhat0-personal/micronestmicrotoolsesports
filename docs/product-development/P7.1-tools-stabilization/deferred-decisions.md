# Deferred Decisions (P7.1)

1. **Owner approval of the six proposed defaults** (owner-decisions.md) —
   recorded as recommendations; still need approve/amend/reject.
2. **Monetization, persistence/sharing, official rulebooks** — explicitly
   out of scope; unresolved by design.
3. **Error-summary parity** — prize shows a "Check these fields" issue
   list (calculate-on-demand); roster/tiebreak show per-control alerts
   (live validation). Different patterns for different interactions;
   deliberately not unified (see Phase 3 constraint against forced
   uniformity).
4. **Empty-state copy** — differs per tool by necessity (prize has no
   empty state; invariant ≥1 row). Not unified.
5. **Disclaimer wording** — per-domain vocabulary preserved intentionally.
6. **Runner row-id hydration note** — pre-existing dev-only warning, benign;
   changing id generation is deferred to avoid touching runner behavior
   for cosmetic reasons.
7. **Firefox/WebKit projects, CI wiring, visual regression** — not added;
   Chromium-local suffices for the stabilization goal. Revisit when e2e
   runs in CI.
8. **Fourth tool** — unblocked: map + parity test + extension procedure are
   ready.
