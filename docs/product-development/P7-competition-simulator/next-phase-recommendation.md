# Next-Phase Recommendation (P7)

## Recommended next phase: harden before a fourth tool

Three tools now cover the three interaction archetypes (one-shot
calculation, stateful composition, rules-driven simulation). The extension
path is proven. The next highest-value work is consolidation, not a fourth
runner:

1. **Decide the P7 owner questions** (principle adoption, official-rules
   posture) — they gate everything competition-flavoured next.
2. **Add interaction coverage** for the three runners (the harness decision
   from item 1.5 above) — P7's cell-commit and snapshot flows are the most
   complex to date.
3. **Refactor `RunnerForTool`** to a slug→component map — 3 branches now;
   the P6 4–5 trigger will hit with the next tool.

## Do not

- Encode any official points table or format without an explicit owner +
  sourcing decision.
- Add persistence, sharing, uploads, or external data to any tool without
  a fresh privacy review.
- Build a generic "tools framework" (dynamic runners, plugin loading)
  ahead of a demonstrated fourth-tool need.
- Present simulation output as a tournament result anywhere (UI, copy,
  exports, marketing).
