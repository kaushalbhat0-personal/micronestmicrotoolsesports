# 07 — Remaining Application Blockers

No migration application is authorized. The gates below are cumulative.

## Security gates

1. **F-NEW-01 fix + re-review** — one-line-class forward correction (insert
   WITH CHECK and/or BEFORE INSERT trigger) with RT-04b in the replay set.
2. **Disposable-environment replay green** — RT-01…RT-18 in `05`, executed in
   an approved isolated project (or Docker-permitted `supabase start`), with
   per-test evidence. Static evidence alone must never satisfy this gate.
3. **FWD-01/FWD-02 ownership** — the captain-decision and transfer migrations
   must each own their trigger revisions; until then the blocks stand.

## Product gates (all AWAITING OWNER APPROVAL — 0/12 decided)

D1-D1 multi-team limits · D1-D2 one-vs-multi-game · D1-D3 captain/co-captain
authority · D1-D4 org ownership/authority · D1-D5 vocabulary · D1-D6 tiers ·
D1-D7 verification · D1-D8 availability shape · D1-D9 retention/visibility ·
D1-D10 transfer/interim admin · D1-D11 billing · D1-D12 lifecycle/expiry/
duplicate windows/privacy. Plus: audit-write API decision (F-A02 remainder),
reporter-read receipts, cron read visibility.

## Procedural gates

- Explicit, separate apply authorization with pre/post table-list evidence
  (this phase, like D1.5/D1.5.1, is not that authorization).
- Ops runbook entries: first-admin bootstrap (F-A05), owner/service-role
  TRUNCATE governance (F-A04), suspended-admin review cadence.

## Next required action

A **separate owner-decision phase** is now the required next step: it must
resolve the product gates (or explicitly defer each with a recorded risk
acceptance), approve the F-NEW-01 correction, and authorize the replay
environment. No engineering phase can substitute for those decisions.
