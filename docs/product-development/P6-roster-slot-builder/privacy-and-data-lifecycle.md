# Privacy and Data Lifecycle (P6)

## Decision: manual entry only, memory only

All roster data is typed by hand into the runner form. There are no file
uploads, no paste-import, no OCR, no lookups, no verification, no accounts,
no persistence (deliberately no `localStorage`), no share links, no network
calls. Closing or reloading the page destroys the roster. This is stated in
the tool description ("Everything stays in this browser session").

## Data minimization

| Field | Collected? | Justification / bound |
|-------|-----------|----------------------|
| Display / in-game name | Yes, required | Minimum to name a slot (2–24 chars). |
| Player ID | Optional | In-game character ID only; distinguishes same names (4–32 chars). |
| Role | Optional | BGMI vocabulary or Flexible; planning signal, not identity. |
| Notes | Optional | ≤140 chars, user free text. |
| Phone, email, real name, contact info | **Never** | No input exists for them; schema rejects unknown fields (`.strict()`). |

## Lifecycle

1. **Entry** — keystrokes held in React state; Zod validates lengths/shapes.
2. **Use** — pure in-memory transforms (assign, summarize); clipboard copy
   only on explicit user action via `navigator.clipboard`.
3. **Disposal** — state dies with the page; Reset clears it on demand
   (two-step confirm when data exists). Nothing is transmitted, stored, or
   logged.

## Audit posture

The P5 static route audit (`routes.test.ts`) passes unmodified: no
`.from(`/`.rpc(`, no supabase imports, no `fetch(`, no server actions, no
mutations, no commerce/tracking tokens in the new route sources.
