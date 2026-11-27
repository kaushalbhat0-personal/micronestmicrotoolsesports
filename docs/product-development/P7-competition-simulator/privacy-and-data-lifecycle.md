# Privacy and Data Lifecycle (P7)

## Decision: manual entry only, memory only

All scenario data (names, scores, criteria, snapshots) is typed by hand and
held in React state. No file uploads, no imports, no lookups, no
verification, no accounts, no persistence (deliberately no `localStorage`),
no share links, no network calls. Closing or reloading the page destroys the
scenario **and** all snapshots. Stated in the tool description ("Everything
runs in this browser session") and the snapshots section ("live in this
browser session only").

## Data minimization

| Field | Collected? | Bound |
|-------|-----------|-------|
| Scenario name | Optional | ≤48 chars |
| Team names | Required per team | 2–40 chars, ≤24 teams |
| Criterion names | Required per criterion | 2–32 chars, ≤8 criteria |
| Scores / weights | Required where used | Bounded integers |
| Personal data | **Never** | No inputs exist; `.strict()` schemas reject extras |

## Lifecycle

1. **Entry** — keystrokes in state; Zod validates lengths/shapes; cell
   commits validate per keystroke (invalid input stays a local draft with
   an inline error — the domain keeps its last valid value).
2. **Use** — pure in-memory transforms; summaries render locally; clipboard
   copy only on explicit user action.
3. **Disposal** — state dies with the page; Reset clears on demand
   (two-step when data exists). Nothing transmitted, stored, or logged.

## Audit posture

The P5 static route audit passes unmodified with the new runner: no table
access, no supabase imports, no `fetch`, no server actions, no mutations,
no commerce/tracking tokens, no raw HTML, no fabricated social proof.
