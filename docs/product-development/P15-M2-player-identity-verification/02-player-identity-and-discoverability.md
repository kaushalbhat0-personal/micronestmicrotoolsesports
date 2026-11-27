# 02 — Player Identity & Discoverability

Locked: completeness and discoverability are separate; discoverability requires **complete profile AND opt-in**; verification badge is **not** required for directory visibility.

## 1. Field inventory

### Already stored (Verified)

| Field | Location | Sensitivity | Public today? |
|---|---|---|---|
| handle | `player_profiles` | public when discoverable | yes (projection) |
| display_name | `player_profiles` | public when discoverable | yes |
| bio | `player_profiles` | public when discoverable | yes |
| avatar_path → avatar_url | `player_profiles` / `public-avatars` | public object when path set | yes |
| country_code | `player_profiles` | public when discoverable | yes |
| is_discoverable | `player_profiles` | consent flag (not projected as column) | N/A (predicate) |
| ign | `player_game_profiles` | public when visible+discoverable | yes |
| primary_role | same | public | yes |
| play_modes | same | public | yes |
| region_code | same | public | yes |
| availability | same | public | yes |
| **game_user_id** (BGMI Player ID) | same | **owner-private** | **never** |
| is_visible | same | per-game consent | predicate |

### Missing as product surfaces (Verified gap)

| Capability | Storage | UI / action |
|---|---|---|
| Edit display name / bio / country after onboarding | columns exist | **no** settings form |
| Edit IGN / role / region / modes / availability | columns exist | **no** settings form |
| Collect / edit BGMI Player ID | `game_user_id` exists | **not collected** in onboarding UI |
| Avatar upload | bucket + server ops | **no** UI |
| Availability vocabulary picker | array shape only (≤7 tokens) | onboarding does not collect; no frozen enum in Zod beyond shape |

### Do not duplicate (Proposed)

- Reuse `game_user_id` for BGMI Player ID — do **not** add a second BGMI ID column.
- Reuse `public-avatars` for public portraits — never store verification screenshots there.
- Do **not** put BGMI ID into `player_profiles` or the 12-field RPCs.

## 2. Required vs optional (Proposed)

### Onboarding / “profile complete” (directory-eligible)

Align locked decision “complete profile” with a **directory-eligible** definition used only as a **server-side gate** for enabling discoverability:

| Field | Required for directory-eligible? | Notes |
|---|---|---|
| handle | Yes | Already |
| display_name | Yes | Already |
| avatar **or** bio | Yes | Keep D-G1-08 rule |
| ≥1 game profile | Yes | Already |
| ign | Yes | Already created at onboarding; must remain non-empty |
| primary_role | Yes (Proposed) | BGMI enum already exists |
| region_code | Yes (Proposed) | BGMI vocabulary exists |
| play_modes (≥1) | Yes (Proposed) | Vocab exists |
| game_user_id | Yes (Proposed) for BGMI | Private; required to submit evidence later |
| availability | Optional | Catalog TBD — see open decisions |
| Discord | Never required | Locked |
| Verification badge | Never required | Locked |

**Open (owner):** Whether directory-eligible **replaces** D-G1-08 or sits as a stricter second check used only by discoverability RPC. Recommendation: keep D-G1-08 for onboarding status copy; enforce **directory-eligible** inside discoverability enable path.

## 3. Validation rules (Verified + Proposed)

| Field | Rule source | Rule |
|---|---|---|
| ign | Verified Zod/SQL | trim 2–30 |
| primary_role | Verified | `IGL` \| `Assaulter` \| `Support` \| `Scout` (or flexible null today — product may require non-null for eligibility) |
| region_code | Verified | BGMI vocabulary in `schemas/game.ts` |
| play_modes | Verified | subset of squad/duo/solo/tpp/fpp, max 5 |
| availability | Verified shape | ≤7 non-empty tokens ≤48 chars; **no frozen enum verified** |
| game_user_id | Verified | optional text 4–32; **no BGMI-specific digit regex verified** |

**BGMI ID format (Open):** Do **not** invent a Krafton-official regex. Proposed conservative rule until confirmed:

- Required when claiming BGMI game profile for directory eligibility
- Trimmed string length 4–32 (existing CHECK)
- Reject control characters / whitespace-only
- Optionally: digits-only **if** product confirms BGMI character IDs are numeric — **unverified** here

## 4. Completeness calculation (Proposed)

```
directoryEligible =
  D-G1-08 complete
  AND game_profile.ign present
  AND primary_role present (non-null)
  AND region_code present
  AND play_modes.length >= 1
  AND game_user_id present (for bgmi)
```

Informational UI shows missing list. Never implies verification.

## 5. Discoverability consent & transitions (Proposed)

### Current (Verified)

- Default `is_discoverable = false`
- Toggle via `set_player_discoverability` only
- Soft UI does not require completeness
- Effective public row also needs `is_visible` + active account + active game

### Target state machine

| From | Event | To | Guards |
|---|---|---|---|
| off | Owner Enable | on | session owner; active; **directoryEligible**; explicit consent |
| on | Owner Disable | off | session owner |
| on | Profile becomes ineligible (required field cleared) | off **or** remain on but RPC returns zero rows | **Open** — recommend auto-disable + audit reason `completeness_lost` |
| * | Opt-out | off | immediate (force-dynamic pages already preferred) |
| * | Suspended account | invisible | existing RPC predicate |

**Do not silently change consent history:** when adding the completeness gate, document as explicit RPC change; existing discoverable-but-incomplete rows (if any) need a one-time remediation plan (Open).

### Behavior when removing required data

1. Owner update rejected **or** accepted with auto `is_discoverable=false`.
2. Public RPCs stop returning the player (predicate and/or auto-off).
3. Share Kit route 404-equivalences for undiscoverable handles (existing).

### BGMI ID changes (Proposed)

| Event | Behavior |
|---|---|
| Owner edits `game_user_id` while no submission | Allow; no public effect |
| Owner edits while `pending` | Invalidate pending submission → `withdrawn` or require re-evidence |
| Owner edits while `approved` | **Revoke** public reviewed flag; require new submission; audit `bgmi_id_changed` |
| Never | Expose old/new ID in public APIs |

## 6. Avatar (Proposed)

- Wire existing `uploadAvatar` / `removeAvatar` into settings.
- Keep MIME/size/path rules.
- Avatar remains public portrait — **not** verification evidence.

## 7. Soft UI vs hard gates (Proposed)

| Concern | Soft (UI) | Hard (DB/RPC) |
|---|---|---|
| Completeness checklist | Yes | directoryEligible in discoverability RPC |
| Discoverability consent | Toggle UI | `set_player_discoverability` |
| Verification claim | Never in UI as self-serve | Reviewer DEFINER only |
| Discord | Optional CTA | No hard dependency |
