# P8 test evidence

> Commands use npm (constraint). Recorded 2026-11-12.

## Unit (`npm test` — unit lane, no integration)

- Result: **83 files / 841 tests passed**, including 10 new P8 suites (73 tests):
  - `src/features/organizations/domain/organization.test.ts`
  - `src/features/organizations/server/organization-reader.test.ts`
  - `src/features/brands/domain/brand.test.ts`
  - `src/features/brands/server/brand-reader.test.ts`
  - `src/app/organizations/_lib/query.test.ts`
  - `src/app/brands/_lib/query.test.ts`
  - `src/app/organizations/routes.test.ts`
  - `src/app/brands/routes.test.ts`
  - `src/app/organizations/_components/components.test.tsx`
  - `src/app/brands/_components/components.test.tsx`

## Typecheck / lint / build

- `npm run typecheck`: PASS (after `npx next typegen` for the new `/organizations` + `/brands` typed routes).
- `npm run lint`: PASS.
- `npm run build`: PASS — output lists `ƒ /brands`, `ƒ /brands/[slug]`, `ƒ /organizations`, `ƒ /organizations/[slug]`.

## E2E (`npm run test:e2e`, Playwright)

- Result: **23 passed** (existing P7.1 suite: home, about, tools roster/tiebreak). Pre-existing hydration-mismatch console noise in the prize-pool runner only; no P8 failures.
- P8 route posture verified by build + unit/component/route-audit coverage: directories render with filters and resolve to the unavailable state until the proposed RPCs land (never fake rows); profiles return generic not-found for unknown slugs; header/footer expose Discover organizations/brands with labelled controls and focus states.

## Security checks (evidence, not claims)

- Route audits (`routes.test.ts` x2) assert: no `.from("` base reads, no `service_role`, no `@supabase/supabase-js` direct import, no owner/representative/evidence private fields, reader-only data paths, no writes.
- Reader tests assert strict key-sets, https fail-closed URLs, frozen `representative_verified: false`, generic errors, 404-equivalence.
- Component tests assert no false confirmation/availability and no private internals in rendered HTML.
- No migration applied; no service-role use; no broad table access introduced.
