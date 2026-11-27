# 01 — Profile Editing Implementation

## Pre-state (inspected)

- Onboarding creates `player_profiles` + first `player_game_profiles` row.
- Settings had consent / visibility / handle / completeness / danger zone only — **no** general edit forms.
- Server ops already existed: `updatePlayerProfile`, `updateGameProfile`, `uploadAvatar`, `removeAvatar`.

## What shipped

Authenticated `/settings/profile` now includes:

| Section | Fields | Action |
|---|---|---|
| Profile details | display_name, bio, country_code | `updateProfileDetailsAction` → `updatePlayerProfile` |
| Avatar | file upload / remove | `uploadAvatarAction` / `removeAvatarAction` |
| Game profile (per title) | ign, primary_role, region_code, play_modes, availability | `updateGameDetailsAction` → `updateGameProfile` |
| Existing sections | discoverability, game visibility, handle, danger zone | updated copy / gates |

## Reuse (no parallel state)

- Zod schemas unchanged for allowed columns (`update-profile`, `game-profile`).
- Session identity only (`auth.getUser`); no client-supplied user ids.
- Does **not** create duplicate profile/game rows on edit.
- **Does not** collect `game_user_id` (M2B.2).

## Optional vs required (UI)

| Field | Required for save | Required for completeness |
|---|---|---|
| display_name | Yes | Yes |
| bio | No | Yes *or* avatar |
| country | No | No |
| ign | Yes (game form) | Via ≥1 game row |
| primary_role / region / modes / availability | No | No (not invented as mandatory) |

## Files

- `src/app/settings/profile/page.tsx`
- `src/app/settings/profile/actions.ts`
- `src/app/settings/profile/_components/{profile-details,game-details,avatar,discoverability,completeness}-section.tsx`
