# Privacy Review (P7.1)

Method: grep + full read of all runner and tool-page sources; no new
collection points were added in this phase (only attributes, a confirm
state, and test files).

## Findings (all PASS)

- **Storage:** zero `localStorage` / `sessionStorage` / `indexedDB` hits in
  tool sources. State is `useState` only; tiebreak snapshots are
  `structuredClone` in memory, labelled "browser session only".
- **Network:** zero `fetch(`, `XMLHttpRequest`, `sendBeacon` in tool
  sources. Playwright tests hit localhost only.
- **Tracking:** zero analytics/tracking identifiers; tool pages set
  `robots: { index: false }`.
- **Personal data:** no new fields. Collected per tool — prize: totals,
  currencies, row numbers; roster: team name, slot counts, display names,
  optional game IDs, roles, notes; tiebreak: scenario/criterion/team names,
  scores. No emails, phones, addresses, or real names anywhere; Zod
  `.strict()` schemas reject extras.
- **Clipboard:** only inside explicit `copySummary` click handlers with
  try/catch; tests stub it. No background copying.
- **Injection:** zero `dangerouslySetInnerHTML`; all user strings render as
  text, including inside `<pre>` summaries.

## Consistency note

Each tool's landing + runner states the memory-only posture in its own
domain vocabulary ("no payments, no custody" / "stays in this browser
session" / "session only"). Wording intentionally not unified — the
guarantee is identical, the context differs.
