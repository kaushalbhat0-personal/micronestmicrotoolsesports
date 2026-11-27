# 02 — Current vs target gap (repository evidence)

## Summary

| AC | Today | Gap |
| --- | --- | --- |
| AC1 PNG without verification | **Met** — `PlayerShareCard` / Share Kit have no ownership gate | None |
| AC2 public URL without verification | **Met for opted-in complete profiles** — `get_player_by_handle` gates on consent + completeness only (M2B.1), not ownership | Keep this split when adding registry ownership gate |
| AC3 unverified hidden from registry | **Not met** — `search_player_directory` uses consent + completeness only | **Must add** ownership eligibility to **search** only |
| AC4 approved appears in registry | Partially — approved players who are discoverable already appear, but so do unverified | Search must require valid approval |
| AC5 ID mismatch clears registry + badge | Badge: **Met** via public status reader + ID-mismatch trigger. Registry: **Not met** — mismatched players can still list if consent+complete | Search must use same validity rule as badge reader |
| AC6 no private verification data in public/PNG | **Met** — allowlists + separate badge reader | Keep |
| AC7 sharing operational | **Met** | Keep; do not gate PNG on verification |

## Evidence — sharing (no verification gate)

- `src/app/players/_components/player-share-card.tsx` — download uses public card + URL only.
- `src/features/player-profile/share/player-card-model.ts` — forbids `game_user_id` / fake verified keys; disclaimer still MicroNest-era “not a verification badge” (copy debt, not a hard gate).

## Evidence — registry / handle (no ownership gate today)

From `supabase/migrations/20261128000001_p15_m2b1_discoverability_completeness.sql`:

- `search_player_directory`: `is_discoverable` + `player_profile_is_complete` (+ game visibility / active).
- `get_player_by_handle`: same pair of gates.

P15 product copy still says ownership review is “not required for the directory” (`discoverability-section.tsx`). **FRAGIX-C1 overturns that directory rule** while keeping share/PNG ungated.

## Evidence — badge validity (already correct shape)

- `get_player_bgmi_ownership_public_status` (M2B.4): approved + discoverable + complete + live ID matches claim.
- ID change flags approved → `id_mismatch` (M2B.4 trigger).
- Profile page shows badge via separate reader; frozen G1 remains 12 fields.

## Consent preservation

- `set_player_discoverability` stores preference; incompleteness does not clear consent (M2B.1).
- C1 must **not** clear `is_discoverable` on reject / withdraw / ID mismatch — only computed registry eligibility changes.

## Settings / campaign copy debt (not AC blockers alone)

| Surface | Issue vs C1 messaging |
| --- | --- |
| Discoverability section | Says ownership “not required for the directory” — **wrong under C1** |
| Homepage hero | “nothing is verified” — overbroad |
| Share card UI | “not verified” always — should allow optional reviewed badge when valid, without blocking download |
| FRAGIX audit `07` P0.3 | Still valid to show badge on card **when approved**; must not make badge a download prerequisite |

## Recommended gate split (for implementers)

| Surface | Gates |
| --- | --- |
| PNG download | Public projection available to page (existing) — **no** ownership |
| `get_player_by_handle` | Consent + completeness (+ existing active/visibility) — **no** ownership (supports AC2) |
| `search_player_directory` (registry) | Consent + completeness + **valid ownership approval** (AC3–AC5) |
| Reviewed badge | Existing public status reader rules |

If product later decides direct URLs should also require verification, that would break AC2 as written — treat as an explicit owner overturn.
