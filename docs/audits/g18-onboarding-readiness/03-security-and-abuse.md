# 03 — Security and Abuse Prevention (verified 2026-11-11)

## 1. Supabase Auth rate limits

- Local `supabase/config.toml` `[auth.rate_limit]` (local-dev only, NOT
  remote evidence): `email_sent 2`, `sms_sent 30`, `anonymous_users 30`,
  `token_refresh 150`, `sign_in_sign_ups 30`, `token_verification 30`,
  `web3 30` (per-second-ish buckets per CLI semantics).
- Remote provider-enforced Auth rate limits: **UNVERIFIED** (no authorized
  read API). Do not quote numeric remote limits. Historical note: G1 live
  lanes performed sequential signups without hitting a limit — anecdotal,
  not a measurement.
- Login brute-force resistance, signup abuse protection, recovery abuse
  protection, email-enumeration protection at the Auth provider layer:
  **UNVERIFIED** for the same reason. These are dashboard-managed Gotrue
  settings with no read-only MCP exposure.

## 2. Public directory RPC abuse (G1-4)

Verified from the live function bodies (`prosrc` checks: no `game_user_id`,
no `EXECUTE`, no `SELECT *`) and migration
`20261110000007_g1_public_projection.sql:30-37,73-82`:

| Control | Exact value | Enforcement | Evidence |
|---|---|---|---|
| `p_limit` clamp | 1..48, default 24 | Database (SQL `CASE` in RPC) + app Zod `min(1).max(48).default(24)` | Migration lines 73-77; `schemas/directory.ts:18` |
| `p_offset` clamp | 0..1000 | Database (SQL `CASE` in RPC) | Migration lines 78-82 |
| `p_query` bound | trim + `LEFT(...,120)` SQL-side; Zod `max(120)` | Database + app | Migration lines 91-99; `schemas/directory.ts:17` |
| Wildcard escaping | `%`/`_`/`\` escaped, deliberate `ESCAPE '\'` | Database | Migration lines 93-99, 130 |
| Handle syntax | `^[a-z0-9_]{3,20}` on lowercased input, fail-closed → empty set | Database (+ Zod at reader) | Migration lines 180-181 |
| Unknown game/region/role | match zero rows, indistinguishable from valid-no-match | Database | Migration lines 125-127 + G1-4 live matrix |
| Result ordering | `ORDER BY handle, game_key` | Database | Migration line 134 |
| Consent gating | `is_discoverable AND is_visible AND status='active' AND is_active` static predicates | Database | Migration lines 121-124 |

What is NOT present: **no per-IP / per-user / per-window request throttling,
no CAPTCHA, no authenticated-only restriction** on either RPC (anon EXECUTE
is intentional per D-G1-03; advisors flag the two anon-DEFINER WARNs as
accepted). A caller with the anon key can invoke the RPCs directly in a
tight loop; the only server-side costs controls are the LIMIT/OFFSET clamps
and the 60s `revalidate` on the profile route. Zod checks live in the app
boundary and do NOT protect direct PostgREST RPC invocation.

## 3. Enumeration risks

- Signup/login/recovery/confirmation responses: **cannot be evaluated** — no
  such UI exists in the repo, and provider-level enumeration protection is
  UNVERIFIED. Supabase defaults and any "prevent enumeration" dashboard
  setting must be confirmed during G1-8B before copy is written.
- Handle availability: **accepted enumerable residual** (frozen, `11 §4`,
  G1-7 report §18). `HandleTakenError` surfaces as `This handle is already
  taken.` (`actions.ts:148-150`) — generic, no owner info, but existence is
  revealed by design.
- `get_player_by_handle` 404-equivalence: VERIFIED — missing, private,
  suspended, inactive, invisible, and malformed handles all return zero rows
  → `null` → generic `notFound()` with no handle echo
  (`[handle]/not-found.tsx` generic copy; `getPlayerByHandle` maps
  `DirectoryValidationError` → `notFound()`).
- Suspended/ Which-condition oracles: VERIFIED absent — `SuspendedError`
  (`Account unavailable…`), `BootstrapError` (`Could not initialize…`),
  `DirectoryOperationError` (`Could not load…`), and `getSettingsSnapshot`'s
  catch-all (`signedIn: false`) reveal no status, ID, or existence.
- No public projection change in this phase; frozen 12 columns preserved
  (live-verified `pg_get_function_result` on both RPCs + runtime key-set
  assertion `assertFrozenKeySet` in `directory-reader.ts:136-147`).

## 4. Smallest safe throttling recommendation (NOT implemented here)

Add in G1-8B, in this order, without touching RLS/projection:

1. Supabase dashboard: confirm provider Auth rate limits + enumeration
   protection for signup/login/recovery (verify first, document values).
2. Edge/proxy or RPC-wrapper throttle on `search_player_directory` +
   `get_player_by_handle` + handle-availability path (e.g. per-IP
   token-bucket with a low burst for anon, higher for authenticated;
   exact numerics to be set from observed traffic, not invented here).
   Enforce server-side (never client-only); the SQL LIMIT/OFFSET clamps stay
   as the inner DoS guard.
3. Keep 404-equivalence and generic errors under throttle (429 must not
   distinguish existing vs missing handles).
