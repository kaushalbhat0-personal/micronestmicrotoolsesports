# 07 — Security & Architecture Constraints

## Non-negotiables (VERIFIED)

1. Do not weaken RLS, RPC grants, or authorization helpers.
2. Soft UI gates never replace hard SQL checks (`create_team` email confirmation, captain/owner).
3. Public player projection omits private identifiers (`game_user_id`, etc.).
4. Public team detail does not expose roster identities.
5. Self-reported profiles must not claim verification.
6. Tools remain planning aids — no payment custody.
7. No LMS / sibling project access.
8. Legacy code is reference-only.

## Auth & onboarding

| Topic | Status |
|---|---|
| Frictionless signup UX | VERIFIED in app |
| Production Confirm-email setting | **UNVERIFIED** (P14-D14 Management API 401) |
| Redirect allowlist / Site URL | **UNVERIFIED** dashboard; historical allowlist gaps noted in P14 docs |
| Safe `next` redirects | VERIFIED unit tests + acceptance |

**Risk:** If production confirmation were re-enabled without UX changes, signup session assumptions break and team create hard-gate behavior changes. Owner dashboard certification remains open.

## Public RPCs & RLS

| Area | Status |
|---|---|
| Player directory/detail RPCs | VERIFIED migrations + app |
| Team directory/detail + mutations | VERIFIED migrations + grant hardening |
| Brands / organizations / news tables | MISSING migrations |
| Rate limiting (handles, RPC abuse, share) | MISSING |

## Export / share designs that need review

| Design | Migration / policy needed? | Notes |
|---|---|---|
| Client PNG from public fields | No | Preferred |
| `localStorage` tool presets | No | Stay client-side |
| Encoded tool state in URL | No DB; spoof risk | Disclose untrusted content |
| Server share tokens / snapshots | **Yes** | New table + RLS + rate limit + TTL |
| Public roster identity cards | **Conflicts** with current privacy | Would need explicit product + RPC change |
| Explicit `looking_for` / open-slot tables | **Yes** | Authz + moderation |

Any item marked **Yes** is **BLOCKED** until an authorized security/schema milestone — not part of Share Kit v1.

## Abuse & operational risks

| Risk | Mitigation direction |
|---|---|
| Scraping directories | Existing `noindex`; consider future rate limits (**MISSING** today) |
| Fake recruiting claims | Keep self-reported labeling; defer verified badges |
| Share-token spam | Don’t ship tokens without limiter |
| PII in PNGs | Allowlist fields; never render email/phone |
| Over-allocation tool crash | UX fix only; no security boundary |

## Architecture fit for Share Kit

- Place generation under `features/tools` / `features/player-profile` / `features/teams` presentation helpers — not cross-feature internals.
- Keep `app/` orchestration thin.
- Do not import `legacy/` share implementations; re-derive against current contracts.

## Finding — F-SEC-01

- Evidence: strong RPC/RLS; missing rate limits; Auth dashboard unverified.
- User impact: low day-to-day if autoconfirm holds; high if config drifts.
- Business impact: share tokens without limits could create support load.
- Complexity: low to certify Auth; medium to add limiters. Risk: medium. Action: certify Auth; keep M1 client-only.
