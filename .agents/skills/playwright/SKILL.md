---
name: playwright
description: "Use for future E2E/browser testing — role/label selectors, isolated contexts, auth state, a11y checks. Skill may exist before Playwright dependency is installed."
---

# Playwright — E2E Guidance

**When to use:** Adding E2E/browser tests, reviewing UI for role/label correctness, determinism, or when task explicitly asks for browser automation.

**When not to use:** Unit/service tests (use `testing` skill), pure styling without interaction, or when dependency not yet needed — skill can exist before `npm install -D @playwright/test`.

**Source:** Adapted from PyModel React Frontend Skills — `playwright` skill (MIT). Project currently **does not have** `@playwright/test` installed (intentional — install only when E2E needed). Keep skill minimal until then.

## Rules

**Rule: Install only when needed**
Why: Keep `$0` infra, context efficient.
Good: Keep this `SKILL.md` with guidance; do not `npm install -D @playwright/test` until RCCF adds first E2E. Document in `package.json` when added.
Bad: `npm install playwright` just to have it — bloats CI.

**Rule: Role/label selectors, isolated contexts**
Why: Stable, a11y-first.
Good: `await page.getByRole('button', { name: 'Create organization' }).click()`; `await page.getByLabel('Name').fill('Acme')`; `await context = browser.newContext({ storageState: 'playwright/.auth/user.json' })` for auth, `test.use({ storageState: ... })` per org.
Bad: `page.locator('.btn-123').click()` or `page.waitForTimeout(3000)` — brittle.

**Rule: Deterministic waiting, no hard waits**
Why: Flaky.
Good: `await expect(page.getByRole('heading', { name: 'Org A' })).toBeVisible()`; `await page.waitForResponse(/supabase/)` with timeout.
Bad: `waitForTimeout(5000)` for Supabase.

**Rule: Auth state + production build**
Why: Mirrors real SSR.
Good: `npx playwright test --project=chromium` against `npm run build && npm start` with `.env` real anon key, `storageState` for `user-1` vs `user-2` to test cross-org IDOR (user-2 cannot visit `/dashboard/org-a`).
Bad: Testing against `dev` only with mocked auth.

**Rule: Mobile/desktop + a11y**
Why: Esports users mobile.
Good: `projects: [{ name: 'Mobile', use: { ...devices['Pixel 7'] } }, { name: 'Desktop' }]` in `playwright.config.ts`; `axe` checks for Dialog/Dropdown focus.
Bad: Only 1280px, no `prefers-reduced-motion` check.

## Future Enablement

When first E2E added:
1. `npm install -D @playwright/test`
2. `npx playwright init` → `playwright.config.ts` (baseURL `http://localhost:3000`, `webServer: { command: 'npm run build && npm start' }`)
3. `tests/e2e/org-context.spec.ts` — cases from `ARCHITECTURE.md` §6 (member allowed, non-member denied, nonexistent 404, sponsor-sentinel requires membership).
4. Add `npm run test:e2e` script.

## Checklist

- [ ] Installed only when needed, version pinned, not `as any` selectors?
- [ ] Isolated contexts, role/label, no hard waits, screenshots on failure (`trace: 'on-first-retry'`)?
- [ ] Auth state per user, tested cross-org, mobile + desktop?

See `testing` skill for unit; this skill for browser.
