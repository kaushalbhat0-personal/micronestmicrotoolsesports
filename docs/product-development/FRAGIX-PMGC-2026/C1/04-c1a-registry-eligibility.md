# 04 — C1A registry ownership eligibility (implemented)

## Policy enforced

| Surface | Ownership gate? | Gates |
| --- | --- | --- |
| `search_player_directory` | **Yes** | `is_discoverable` + `player_profile_is_complete` + `player_bgmi_ownership_registry_eligible` (+ existing active/visibility filters) |
| `get_player_by_handle` | **No** | Unchanged: consent + completeness only |
| PNG download | **No** | Unchanged Share Kit path |
| Reviewed badge | Separate reader | Existing `get_player_bgmi_ownership_public_status` |

Consent (`is_discoverable`) is never cleared by C1A.

## Helper

`player_bgmi_ownership_registry_eligible(uuid)` → true iff:

- A case exists with `status = 'approved'`
- `claimed_game_user_id` is non-null
- Live BGMI `player_game_profiles.game_user_id` equals that claim

Pending / rejected / withdrawn / `id_mismatch` / no case → false.

Execute revoked from `anon` / `authenticated` (internal use by SECURITY DEFINER search only).

## Migration

**File:** `supabase/migrations/20261128000006_fragix_c1a_registry_ownership_eligibility.sql`

**Hosted apply:** Applied to Esports `knniommcyyhbyiwljisk` (`micronestmicrotoolsesports`) on 2026-11-28 via authorized `npx supabase db push --linked`. Remote records `20261128000006`. Live verify: `has_helper=true`, `search_gated=true`, `handle_gated=false`.

## App copy

`discoverability-section.tsx` updated to describe consent vs registry eligibility and ungated share/PNG.

## Tests

| Suite | Purpose | Result (this turn) |
| --- | --- | --- |
| `registry-ownership-policy.test.ts` | Static migration + PNG privacy contracts | **4/4 passed** |
| Related unit (directory/projection/share/consent) | Regression | **28/28 passed** (with policy suite) |
| `registry-ownership-eligibility.integration.test.ts` | Live JWT scenarios (`G1_TEST_MODE=c1a`) | **5/5 passed** after hosted apply |
| typecheck / build (apply turn) | Quality gates | **PASS** |

## Security notes

- Helper execute revoked from API roles; no new table grants.
- Search still returns only frozen 12 columns.
- Handle RPC not modified.
- Consent column not written by C1A.
