# 06 — Security Verification (P14-D3)

## Implemented & statically verified

- Session-only identity (`auth.uid` / `ensureAppUser`)
- Verified-email gate in `create_team` SQL
- Active-account gates
- Owner/captain settings matrix (A1); co-captain excluded from `is_team_captain`
- Immutable ownership columns trigger
- Client DML revoked on teams/members/audit
- Public projection privacy (no member ids)
- Kill switch OFF + tests pin it
- No transfer/leave/appoint RPCs
- F-A01 active `is_super_admin` re-homed before P9/P11/P13
- No G1 player projection changes
- No LMS project access

## Runtime JWT/PostgREST

**BLOCKED / PENDING** — no Docker; no disposable JWT harness available; Supabase MCP unavailable this session; primary DB not mutated.

Prepared matrix remains P14-D2 `05-security-test-plan.md` (T-01…T-32). Do not treat elevated SQL as RLS proof.
