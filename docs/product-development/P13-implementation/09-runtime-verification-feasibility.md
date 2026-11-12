# 09 — Runtime verification feasibility (P13-B, 2026-11-12)

Question: can the pending D1/P9/P11/P13 migrations be verified against real
PostgreSQL/RLS/PostgREST/Supabase-Auth behavior without Docker, without a second
project, without reset, and without mutating the primary database?

Answer: NO — under the current constraints there is no faithful, safe,
end-to-end runtime route. Static + simulated verification stands; real
PostgreSQL/RLS/PostgREST/Auth execution is BLOCKED until an authorized
controlled-application window exists. Nothing below was executed as a write:
`execute_sql` was SELECT-only, `apply_migration` never called, no
repair/push/reset/branch, `supabase status` confirms no local Docker engine.

## 1. Five-layer distinction (used throughout this phase)

1. **Static source verification** — SQL-text pins (`npm test` suites read
   migration files and assert clauses, CHECKs, revokes, policy text).
2. **Simulated unit testing** — TypeScript mirrors of binding logic
   (`isApprovalBindingValid`, `requiredApprovalFor`, `isSelfApproval`,
   `canRoleTransition`) run without a database.
3. **Real PostgreSQL behavior** — trigger firing, CHECK enforcement, function
   execution, concurrency, fault injection inside the live engine.
4. **Real authenticated/anonymous PostgREST behavior** — RLS allow/deny per role,
   RPC EXECUTE posture, status codes, via the REST API as anon/authenticated.
5. **Real Supabase Auth identity behavior** — `auth.uid()` binding to live
   GoTrue sessions, suspension propagation, JWT lifecycle.

Only layers 1–2 are available today. Layers 3–5 require the pending objects to
exist remotely plus test identities plus write probes — all prohibited now.

## 2. Capability matrix (verified this phase)

| Capability | Available mechanism | Real PG? | Persists? | Identity fidelity | RLS fidelity | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| CLI `migration list` | CLI v2.109.1 | n/a (ledger) | no | n/a | n/a | SAFE — used |
| `supabase status` / local stack | CLI + Docker | no (no engine: `//./pipe/dockerDesktopLinuxEngine` missing) | — | — | — | UNAVAILABLE — probe only |
| Schema introspection (tables, policies, triggers, functions, counts, seed) | MCP `execute_sql` SELECT + `list_tables` | yes (reads live catalog) | no | n/a | proves existence, not enforcement | SAFE — used |
| Policy/trigger/function inventory | SELECT on `pg_policies`, `information_schema`, `pg_proc` | yes (live objects) | no | n/a | proves presence, never proves a *deny* | SAFE — used |
| Advisor lints | `get_advisors` security | yes (runs on live schema) | no | n/a | partial (flags DEFINER×anon EXECUTE by design) | SAFE — used |
| `execute_sql` BEGIN…ROLLBACK sandbox for DDL+RLS | MCP single-statement channel | nominally real PG but NOT isolated | locks + WAL churn on primary even if rolled back | NO — runs as instance role, `auth.uid()` NULL, no JWT switching | NO — RLS bypassed/mis-attributed outside a real session | UNSAFE — PROHIBITED; NOT attempted |
| `apply_migration` dry-run | none (applies immediately) | real but destructive-by-design | YES | n/a | n/a | UNSAFE — never called |
| `migration repair` / `db push` / `db reset` | CLI, all mutating | real | YES | n/a | n/a | UNSAFE — none executed |
| Authenticated/anon RLS proof | PostgREST + real JWTs only | only via PostgREST path | requires test users = writes | `execute_sql` CANNOT mint or assume a GoTrue session | cannot be proven from the SQL channel | BLOCKED — no faithful route without an authorized write window |
| PostgREST behavior (policies via REST, RPC EXECUTE as anon/authenticated) | project URL + keys + test identities | only with live API calls | requires signups/inserts/decisions = writes | needs real sessions per role | needs per-role allow/deny probes | BLOCKED — not attempted; would violate no-write constraint |
| Second project / branch / local stack sandbox | prohibited | — | — | — | — | OUT OF SCOPE — D-06 + task constraints; never created |

## 3. Why the "clever" routes fail (do not attempt)

1. **"Wrap it in a transaction and roll back"** — still executes DDL/DML on the
   primary (locks, `pg_catalog` churn, `auth` touches for users), still runs as
   the wrong role, still produces no real JWT session. Rollback ≠ isolation,
   and the task explicitly states a transaction + ROLLBACK is not automatically
   a safe isolated test (triggers, sequences, `auth.uid()`, PostgREST role
   switching, transaction scope, side effects all differ).
2. **"Set `request.jwt.claims` manually"** — fabricates identity inside a
   superuser-ish session; RLS outcomes under fabricated claims do not prove
   PostgREST outcomes and risk masking a real bypass.
3. **"Test hash/validator as pure SELECTs"** — `tournament_content_hash` and
   `tournament_review_approval_valid` do not exist remotely (P13 unapplied) and
   their dependencies (`tournaments`, `moderation_decisions`,
   `platform_admins`, `organizer_members`) do not exist either. Selecting a
   re-implementation proves nothing about the migration text.
4. **"Create a branch — it's not a project"** — a branch is a second database
   under any honest accounting; prohibited and never attempted.

## 4. What IS verified without runtime (carried, not re-claimed)

- Static SQL-text pins: hash fields, UTC normalization, CHECK, validator
  clauses, 6 queue policies, lifecycle branches, revokes, P9-behavior
  preservation (`p13-snapshot`, `p13-adversarial`, `p12-activation-proposal`,
  `f01`, `f02` suites — green per P13-A; P14-B4 reports 1,012 unit + 9/9 E2E
  with no DB changes, i.e. app surface did not regress).
- Simulated binding logic (`isApprovalBindingValid`, `requiredApprovalFor`,
  `isSelfApproval`, `canRoleTransition`).
- Zero-drift app surface (P3/G1 projections untouched, all three write switches
  OFF re-verified today in source + test pins).

## 5. Route to unblock faithful runtime (requires authorization, NOT done here)

1. Stage-3/4 authorization (named applier, ref `knniommcyyhbyiwljisk`, rollback
   readiness) for G1 repair + push.
2. Forward-only G1 repair (§07), then `db push` of D1+P9+P11+P13 in order (§08).
3. Controlled runtime battery against the now-present schema with dedicated test
   identities (`rt-*`) + cleanup, all three switches still OFF, audit rows
   retained as evidence. Full case list (F-01…F-15, P-01…P-10, R-01…R-15,
   L-01…L-09 with steps, expected outcomes, and required layers) is specified
   in the prior `09-postgres-test-plan.md` and remains the evidence battery —
   unexecuted.
4. Only then can PostgreSQL/RLS/PostgREST/Auth claims be made honestly.

Verdict for runtime under P13-B constraints: **BLOCKED**. No runtime
verification is claimed in this phase; §§07–08–10 evidence is static/simulated
plus live read-only inventory only.
