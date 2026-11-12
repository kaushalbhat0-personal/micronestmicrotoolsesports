# 04 — Browser Test Evidence (Gate 4)

Requirement: execute the **actual Playwright runner** — the M1–M2 limitation
(missing browser binary) is resolved here, no substitutions.

## Resolution

`npx playwright install chromium-headless-shell` (network available) installed
**Chrome Headless Shell 158.0.8127.18** (`chromium_headless_shell-1254`) into
the user-level Playwright cache — test infrastructure only, nothing added to
the production application or `package.json`.

## Actual runner execution

Command (dev server on 3100; config skips its own webServer when the base URL
is provided):

```powershell
$env:PLAYWRIGHT_BASE_URL='http://localhost:3100'; npx playwright test
```

Result: **2 passed (2.3s)** — `e2e/home.spec.ts` hero assertions and about
assertions, both green on the real runner. Existing regression tests
preserved (no e2e file removed; spec was updated in M1–M2 to the new H1).

## Versions (recorded)

| Component | Version |
|---|---|
| `@playwright/test` (runner) | 1.65.0 |
| Browser binary | chromium-headless-shell 1254 — Chrome 158.0.8127.18 |
| Cross-check binary (sweeps/Lighthouse) | chromium-1248 full build |
| axe-core (a11y scans) | 4.14.0 |
| Lighthouse | 13.6.0 |

## Supplementary interaction evidence

- Native-equivalent menu verification (production): real `Menu` button click
  opens the disclosure (`Close` state, links visible, screenshot
  `home-390-menu-fixed-open.png`); keyboard Enter path verified during the
  details experiment window; final button header re-verified by click.
- Keyboard walkthrough: first Tab stop = `Skip to content` (`#main-content`).

## Tooling quirk (documented, not a product issue)

Playwright's `isVisible`/actionability checks report `<summary>` of a
**closed** `<details>` as hidden even when rendered and operable (verified:
44×44 box, `visibility: visible`, flips to visible once open). Relevant only
as a caution if future tests target native disclosures; the shipped header
uses a `<button>` and is unaffected.
