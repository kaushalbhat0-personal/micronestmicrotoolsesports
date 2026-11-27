# 08 — Execution Summary (P14-D5)

## Verdict

**PASS — DATABASE PERMISSIONS HARDENED AND JWT SECURITY BATTERY PASSED**

## Delivered

1. Function permission inventory (exact signatures)
2. Hardening migration `20261115000001_p14_teams_grant_hardening.sql` applied  
   SHA-256 `3A7D1A555B37839449CD125EB0EE9AA2E33F65D32F6C96303729EDC7B6704F1E`
3. Anon EXECUTE removed from mutations + helpers; public reads retained
4. Disposable JWT identities + **31/31** PostgREST cases passed
5. Write-switch scope review: `WORKSPACE_WRITES_ENABLED` is Teams-only; left **OFF**
6. Full fixture cleanup; ledger/grants rechecked

## Residual (non-blocking)

- `supabase_admin` default privileges still auto-grant function EXECUTE to anon for **future** objects created as that role; continue explicit revokes in migrations.
- Unverified-email JWT obtained via confirm→token→unconfirm (Auth cannot password-login unconfirmed users).

## Next milestone

**P14-D6 — Narrow Teams write-switch activation** (`WORKSPACE_WRITES_ENABLED=true`) with regression tests proving organizer/tournament/moderation/news switches stay false, plus UI E2E for create/settings under real sessions.
