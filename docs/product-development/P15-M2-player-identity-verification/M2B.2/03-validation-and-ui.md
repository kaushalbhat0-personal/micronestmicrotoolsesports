# 03 — Validation & UI

## Validation rules (exact)

| Rule | Detail |
|---|---|
| Type | Text (string) |
| Trim | Leading/trailing whitespace removed |
| Empty / whitespace-only when setting via clear | → `null` (clear) |
| Length when non-null | 4–32 characters (DB CHECK + Zod) |
| Control characters | Rejected (`U+0000–U+001F`, `U+007F`) |
| Digit-only / official BGMI regex | **Not invented** |
| Leading zeroes | Preserved |
| Error messages | Generic; **never echo** the submitted ID |

Helpers: `gameUserIdSchema`, `normalizeGameUserIdInput` in `schemas/game.ts`.

## UI

`BgmiPlayerIdSection` on `/settings/profile` (per game profile):

- Labels as **BGMI Player ID (private)**
- Shows current value or “Not set”
- Save / Update and Clear actions
- Copy: not shown in directory/profile/share cards; not official verification
- Mobile-friendly inputs and 44px-capable buttons

Public game fields remain in `GameDetailsSection` (no private ID there).
