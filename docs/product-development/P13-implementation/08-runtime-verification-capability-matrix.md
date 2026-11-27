# 08 — Runtime verification capability matrix (P13-B, 2026-11-12)

Question: can the approved P13 migrations be verified against real
PostgreSQL/RLS/PostgREST without Docker, without a second project, without
reset, and without mutating the primary database?

Answer: NO — under the current constraints there is no faithful, safe,
end-to-end runtime route. Static + simulated verification (P13-A) stands;
real PostgreSQL/RLS/PostgREST execution is BLOCKED until an authorized
controlled-application window exists. Nothing below was executed as a write;
`execute_sql` was used SELECT-only, `apply_migration` never called, no
branch/project created, `supabase status` confirms no local Docker engine.

## 1. Available mechanisms (verified this phase)

| Mechanism | Proven present | Read-only proof this phase |
| --------- | -------------- | -------------------------- |
| Supabase CLI `migration list` | yes (v2.109.1) | ledger dumped; 2 matched + 7 remote-only + 14 local-only |
| Supabase CLI `status` / local stack | NO (Docker daemon absent) | `supabase status` → `dockerDesktopLinuxEngine` pipe error |
| MCP `list_migrations` / `list_tables` / `get_project` | yes | 9 remote migrations; 4 tables; ACTIVE_HEALTHY PG 17.6.1.171 |
| MCP `execute_sql` SELECT | yes | `pg_policies` (11), triggers (3), `pg_proc` (7), counts, seed |
| MCP `apply_migration` (DDL) | exists, PROHIBITED here | never called (would mutate primary) |
| MCP branches (`create_branch` etc.) | exists, PROHIBITED here | never called (second-project prohibition covers branches) |
| PostgREST via project URL + publishable key | exists in principle, NOT proven/blocked | not attempted (needs test identities + writes) |

## 2. Capability matrix

| Capability | Available mechanism | Real PostgreSQL? | Changes persist? | Identity fidelity | RLS fidelity | Limitations | Safe/unsafe verdict |
| ---------- | ------------------- | ---------------- | ---------------- | ----------------- | ------------ | ----------- | ------------------- |
| Schema introspection | MCP `execute_sql` SELECT + `list_tables` | yes (reads real catalog) | no | n/a (catalog reads) | n/a | version/name only for ledger; body/grants need extra SELECTs | SAFE — used |
| Policy/trigger/function inventory | MCP `execute_sql` SELECT on `pg_policies`, `information_schema`, `pg_proc` | yes (reads live objects) | no | n/a | proves existence, not enforcement | cannot prove a policy *denies* without attempting the denied op | SAFE — used |
| Advisor lints | MCP `get_advisors` security/performance | yes (runs on live schema) | no | n/a | partial (flags DEFINER×anon EXECUTE by design) | WARNs are posture notes, not exploit proof | SAFE — used |
| Local `supabase status` / `db start` | CLI + Docker | no (no engine) | — | — | — | `//./pipe/dockerDesktopLinuxEngine` missing; prohibited anyway | UNSAFE/UNAVAILABLE — not attempted beyond `status` probe |
| `execute_sql` BEGIN…ROLLBACK sandbox for DDL+RLS | MCP `execute_sql` (single-statement channel) | nominally real PG, but NOT isolated | locks + WAL on primary even if rolled back; DDL transactional but session/role wrong | NO — runs as instance role, `auth.uid()` NULL, no JWT switching; `SET request.jwt.claims` / `set_config('role',…)` would be impersonation theater, not PostgREST | NO — RLS bypassed or mis-attributed outside a real authenticated session | P13 targets (`tournaments`, queue tables) do not exist remotely, so any F-02 test first needs the very DDL under test; no savepoint makes that a non-write | UNSAFE — prohibited (remote DDL + impersonation risk); NOT attempted |
| `apply_migration` dry-run | none (applies immediately) | real, but destructive-by-design | YES persists | n/a | n/a | no dry-run flag; constraint bans it | UNSAFE — never called |
| `migration repair` / `db push` / `db reset` | CLI, all mutating | real | YES persists | n/a | n/a | repair rewrites ledger; push replays G1 without reconciliation; reset destroys | UNSAFE — none executed |
| Authenticated/anon RLS proof (`auth.uid()`, active-account, moderator identity) | PostgREST + real JWTs only | only via PostgREST path | requires test users = writes | `execute_sql` CANNOT mint or assume a GoTrue session; any `auth.uid()` override is fake | cannot be proven from the SQL channel | creating test users/audit rows on primary = persistent writes needing authorization + cleanup | BLOCKED — no faithful route without an authorized write window |
| PostgREST behavior (policies via REST, RPC EXECUTE as anon/authenticated) | project URL + keys + test identities | only with live API calls | requires writes (signup, inserts, decisions) | needs real sessions per role | needs row-level allow/deny probes per role | rate limits, email confirmation, cleanup, and primary-pollution risk | BLOCKED — not attempted; would violate no-write constraint |
| Second project / branch / local stack as sandbox | prohibited | — | — | — | — | D-06 + task constraints: no Docker, no second project | OUT OF SCOPE — not created |

## 3. Why the "clever" routes fail (do not attempt)

1. "Just wrap it in a transaction and roll back" — still executes DDL/DML
   on the primary (locks, `pg_catalog` churn, `auth` touches for users),
   still runs as the wrong role, still cannot produce a real JWT session.
   Rollback ≠ isolation, and the task explicitly forbids assuming the SQL
   channel is isolated.
2. "Set `request.jwt.claims` manually" — fabricates identity inside a
   superuser-ish session; RLS outcomes under fabricated claims do not prove
   PostgREST outcomes and risk masking a real bypass.
3. "Test hash/validator as pure SELECTs" — `tournament_content_hash` does
   not exist remotely (P13 unapplied) and its dependencies
   (`tournaments`, `moderation_decisions`, `platform_admins`,
   `organizer_members`) do not exist either. Selecting a re-implementation
   of the hash proves nothing about the migration text.
4. "Create a branch — it's not a project" — a branch is a second database
   under any honest accounting; prohibited and never attempted.

## 4. What IS verified without runtime (carried from P13-A, not re-claimed)

- Static SQL-text pins (hash fields, CHECK, validator clauses, 6 policies,
  lifecycle branches, revokes, P9-behavior preservation): `npm test`
  suites `p13-snapshot`, `p13-adversarial`, `p12-activation-proposal`.
- Simulated binding logic (`isApprovalBindingValid`, `requiredApprovalFor`).
- Zero-drift app surface (P3 projection untouched, switches OFF).

## 5. Route to unblock faithful runtime (requires authorization, NOT done here)

1. Stage-3/4 authorization (named applier, ref `knniommcyyhbyiwljisk`).
2. Forward-only G1 repair (§07), then `db push` of D1+P9+P11+P13 in order.
3. Controlled runtime battery (§09) executed against the now-present schema
   with dedicated test identities + cleanup, all three switches still OFF,
   audit rows retained as evidence (not deleted).
4. Only then can PostgreSQL/RLS/PostgREST claims be made honestly.

Verdict for runtime under P13-B constraints: BLOCKED. No runtime
verification is claimed in this phase.
