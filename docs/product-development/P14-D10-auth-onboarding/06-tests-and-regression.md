# 06 — Tests and Regression (P14-D10)

## New / updated

- `src/lib/auth/redirect.test.ts` (5): exact allowlist, `/workspace/` prefix,
  external/protocol-relative/absolute rejection, public-path rejection, bare-prefix fallback.
- `src/lib/auth/validation.test.ts` (3): email shape, password length, display-name bounds.
- `src/components/shared/site-header.test.tsx` (4): anonymous (Discover + login/signup,
  no account/settings/signout), authenticated (Workspace + Account, no signup/login),
  mobile panel both states, Arena treatment (no `rounded-full`, no "Opportunities").
- `src/app/signup/signup-form.test.tsx` (3): signup/login/recovery labelled fields,
  requirements, toggles, recovery link (next/navigation mocked).
- `src/components/marketing/marketing.test.tsx`: "No signup CTA" replaced with
  "Auth entry points" (sources link `/signup`; home has `/signup`; header/footer have
  both); header expectations updated (Discover, signup/login, preserved a11y hooks);
  homepage H1 contract updated (`Sign up free`).

## Results

- `npm run typecheck`: clean (typedRoutes regenerated; `safeNextPath` returns `Route`).
- `npm test`: 103 files / 1018 tests pass (was 102 files before; +5 new/updated).
- `npm run lint`: clean. `npm run build`: passes; routes `/signup`, `/forgot-password`,
  `/auth/callback` listed as dynamic.
- Authenticated-flow coverage preserved: existing `ensureAppUser`, consent/handle/visibility,
  workspace, team-security-boundary (incl. `email_confirmed_at`), settings-suspended tests
  all pass. No migration/RLS/function-grant changes (`git status`: only app/components/lib/docs).

## Not run

- `test:integration` (requires live Supabase + disposable accounts) and `test:e2e`
  (Playwright browsers) — not executed here; recommend preview-deployment pass with
  disposable `p14d10.*@example.invalid` identities covering valid/invalid signup, mismatch,
  existing-email, confirmation on/off, login success/failure, logout, callback code/invalid,
  protected `next` return, and suspended-user restricted flow before production promotion.
  Clean up only test-created records.
