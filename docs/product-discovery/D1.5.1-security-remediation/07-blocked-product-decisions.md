# 07 — Blocked Product Decisions

All 12 D1 decisions remain **AWAITING OWNER APPROVAL** (0/12 approved).
Nothing below was resolved, assumed, or encoded beyond a fail-closed block.

- **D1-D1 multi-team limits:** no cap encoded; PK unchanged.
- **D1-D2 one-game vs multi-game:** game fixed-ness enforced for direct writes
  (F-T01 freeze); whether multi-game teams may ever exist undecided.
- **D1-D3 captain/co-captain authority:** dual-authority helper untouched;
  co-captain still rightless; captain decision RPC not built.
- **D1-D4 org ownership/authority:** `organization_id` still inert, still in no
  RLS; no org membership table/permissions created.
- **D1-D5 game vocabulary:** BGMI set unchanged.
- **D1-D6 tiers:** matching code untouched.
- **D1-D7 verification:** `verified=false` contract untouched; no badge column.
- **D1-D8 availability shape/caps:** `text[]` unbounded still (no CHECK/GIN
  added — a cap choice awaits the vocabulary decision).
- **D1-D9 report retention/visibility:** `reporter CASCADE` kept; no `SET NULL`,
  no evidence-copy, no reporter-read policy.
- **D1-D10 owner transfer/interim admin:** transfer impossible (blocked, not
  redirected); no transfer RPC, no admin override path.
- **D1-D11 billing:** no entitlement surface added.
- **D1-D12 lifecycle/expiry/duplicate windows/privacy:** no transition guards,
  no expiry automation, no re-apply windows, no PII narrowing; partial-unique
  anti-double-apply preserved as-is.

## Deferred non-blocking hardening

F-T10 (game_key equality), F-T11 (owner-row delete guard), F-T12 (org-id guard),
F-T13 (indexes), F-A05 (bootstrap runbook), F-A07 (cron data quality): documented
in D1.5 `06`; safe to schedule with the replay phase, none required for the
security verdict.
