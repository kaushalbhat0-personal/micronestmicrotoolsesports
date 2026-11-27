# 08 — Next Phase Gates

Recommended order — no step substitutes for another:

1. **Owner responses (D1.6 `08`):** 12 rows + line-item defers; authority core
   {D1-D3, D1-D10, D1-D12} jointly; F-NEW-01 scheduling and replay-environment
   authorization included in the sheet's extra items.
2. **Replay environment authorization:** disposable project (or Docker-permitted
   `supabase start`); run RT-01…RT-18 + RT-04b with per-test evidence.
3. **Forward corrections from replay:** any divergence → additive migration
   (000005+), same convention; never rewrite applied history.
4. **Feature migrations (only after 1–2):** captain-decision RPC (owns FWD-01
   trigger revision), transfer RPC (owns FWD-02), report retention (D1-D9),
   availability caps (D1-D8), lifecycle automation (D1-D12) — each gated on its
   owner row.
5. **Separate apply authorization:** pre/post table-list evidence on the
   primary project. Nothing in D1.6.1 grants it.

Stop condition restated: functionality requiring captain, organization,
owner-transfer, moderation, applicant-decision, or report-retention authority
waits for the explicit owner row. The multi-title principle authorizes
direction, never behavior.
