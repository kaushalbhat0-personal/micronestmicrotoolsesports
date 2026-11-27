# 04 — Profile Completion Flow (P14-D12)

## Route

`/onboarding/profile` — `src/app/onboarding/profile/`

- Server page loads session + `getOwnOnboardingStatus`.
- Unsigned users → login CTA with `next=/onboarding/profile`.
- `complete` status → settings / workspace CTAs (explicit: not a verification badge).
- Otherwise → `ProfileOnboardingForm`.

## Collected fields (G1 contracts)

| Field | Source |
|---|---|
| Handle | `create_player_profile` / handle schema |
| Display name | profile schema |
| Country / region (ISO α-2) | optional `country_code` |
| Bio | optional; used for D-G1-08 completeness with avatar |
| Game | `bgmi` (catalogue) |
| IGN | game profile |
| Primary role | BGMI roles |
| Play modes | BGMI modes |
| Game region | BGMI vocabulary |

**Evidence uploads** are not part of this form. The `private-verification`
bucket exists for future admin review; no owner onboarding upload path was
added (avoids unverified “proof” UX).

## Server action

`completeProfileOnboardingAction`:

1. `createPlayerProfile` (resume-safe if profile already exists).
2. `createGameProfile` for BGMI (resume-safe if game row exists).
3. Revalidate settings / directory / workspace; redirect to `/settings/profile`.

Uses owner session client only — no service-role, no caller user IDs.

## Completeness

Still derived by `getProfileCompleteness` (D-G1-08): handle + display name +
(avatar OR bio) + ≥1 game profile. Informational — not verification.

## Settings entry

Null-profile settings page now links to `/onboarding/profile`.
