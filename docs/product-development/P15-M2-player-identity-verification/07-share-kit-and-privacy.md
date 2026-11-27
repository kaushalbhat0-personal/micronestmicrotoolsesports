# 07 — Share Kit & Privacy Rules

## 1. Asset classes (must stay distinct)

| # | Asset | Bucket / source | Public? | May appear on Share PNG? |
|---|---|---|---|---|
| 1 | Private BGMI verification screenshot | `private-verification` | No | **Never** |
| 2 | Public player avatar/portrait | `public-avatars` | Yes (when set) | Optional future paint; today text-only card |
| 3 | Public player share card | Canvas client export from public projection | Yes | Yes (allowlisted fields only) |
| 4 | Future team roster identity image | Not designed | Requires separate consent architecture | **Out of M2** |

**Rule:** Never reuse (1) as (2). Never feed (1) into (3) or (4).

## 2. Current player Share Kit (Verified)

Source: `src/features/player-profile/share/player-card-model.ts`

- Inputs: subset of public projection + `profileUrl`
- Explicitly forbids: `email`, `user_id`, `game_user_id`, verification keys, etc.
- Disclaimer: self-reported; not a verification badge
- Bio omitted from PNG by design

Wired from public `/players/[handle]` after `get_player_by_handle` (404 if private).

## 3. Current team Share Kit (Verified)

Source: `src/features/teams/share/team-card-model.ts`

- Uses public team detail + `member_count`
- Forbids roster/members/applicants keys
- Disclaimer: roster identities not shown

## 4. M2 rules (Proposed)

### Player card

| May include | Must exclude |
|---|---|
| display_name, ign, handle, game, role, region, modes, availability, profile URL | `game_user_id`, evidence paths/URLs, reject reasons, Discord ids/tokens, email, UUIDs |
| Optional minimal eyebrow when public reviewed flag true: “BGMI ownership evidence reviewed” | Words implying official Krafton/BGMI certification |
| | Internal reviewer notes |

Badge on PNG must use the **same** public boolean as the profile page (separate DEFINER), never private case tables in the browser.

### Team card

- No change that introduces individual roster identities.
- Team owners cannot publish member IGNs/IDs/evidence without a **future** explicit per-player consent design (not M2).
- Do not implement team roster identity cards in M2.

### Tools cards

Unaffected; continue client-side tool state only.

## 5. Regression tests (Proposed)

1. `assertNoForbiddenShareFields` remains red-line for `game_user_id` / evidence keys.
2. Player share unit test: approved flag adds eyebrow only; payload keys unchanged otherwise.
3. E2E: evidence upload never appears in downloaded player PNG bytes/text OCR optional; at minimum generation inputs logged in test assert allowlist.
4. Team share never gains `members[]`.

## 6. Caching / staleness

Public profile + share props must track consent and badge revocation (prefer `force-dynamic` or short revalidate already discussed in M1-V). Stale “reviewed” eyebrow after withdraw is a security/trust defect (see threat T17).
