# Interaction Test Strategy (P7.1)

## Setup

- Existing infra reused: `@playwright/test 1.65.0` (already a devDependency),
  `playwright.config.ts` untouched (Chromium project, `npm run dev`
  webServer, `PLAYWRIGHT_BASE_URL` override respected).
- Chromium binary installed locally for test execution only
  (`ms-playwright/chromium-1254`); no Docker, no external services, no
  disposable Supabase, no deployment, no real user data.
- New: `npm run test:e2e` → `playwright test`. Deterministic by construction:
  fresh page per test, hand-entered fixture data, clipboard stubbed via
  `addInitScript` (writes recorded on `window`, never touching the OS
  clipboard), no clocks, no network beyond localhost.
- Selectors prefer accessible roles/labels (`getByRole`, `getByLabel`);
  stable text only where the UI guarantees it. Two suite-wide lessons
  recorded: `<option>` text matches `getByText` (scope badge assertions to
  `span`), and summary `<pre>` duplicates visible copy (scope with
  `.first()` or exact badges).

## Coverage (21 tests, all passing)

**Prize Pool Splitter (7):** valid-pool exact calculation; unallocated
remainder (50/30 → 20%); stubbed-clipboard copy + confirmation; empty-total
validation with issue list; two-step reset (arm / keep / confirm);
keyboard Enter on focused Calculate; mobile viewport (390px) with no
horizontal overflow.

**Roster & Slot Builder (7):** empty state + zeroed progressbar; add to
bench; assign + move between starter slots with progressbar values;
duplicate / occupied-slot / blocked-shrink errors (shrink blocked by name);
confirmed remove + clipboard copy; two-step reset; keyboard Enter on Add;
mobile add + assign without overflow.

**Tie-Break Simulator (7):** exact totals + named tie-break; priority
reorder flipping the favored team; fully-equal tie (entry order, shared
rank) + cutoff-crossing contest (2× Contested, banner); snapshot
save → diverge → confirmed restore → delete; copy + confirmed reset;
keyboard Enter on Add team; mobile rank + overflow check.

Each tool also asserts its simulation/planning disclaimer is visible, and
each mobile test asserts `scrollWidth − clientWidth ≤ 1`.
