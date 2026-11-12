# 03 — Change Classification (P14-D8)

## 1. Ready for integration (staged)

- All `src/**` platform implementation (Teams, G1 players, auth login/logout, directories, workspace writers with switches)
- `supabase/migrations/*.sql` (24 active files)
- `e2e/**` specs + helpers
- `docs/**` product-development / discovery / architecture / marketing / audits / development-environment evidence
- `.cursor/rules/**`, `.cursor/mcp.json` (Esports ref + `${env:STITCH_API_KEY}` placeholder only)
- `AGENTS.md`, `.vercelignore`, `.agents/skills.md`, README / package / eslint / tsconfig / site shell updates
- Staged legacy archive renames into `legacy/` (1299)

## 2. Historical archive/reference

- Staged `legacy/**` renames from `ref/legacy-project/**` (preserve history; no new-platform imports)

## 3. Generated but required

- `src/types/database.ts` (updated types used by app)

## 4. Local-only configuration (excluded)

- `.vercel/` project link cache (gitignored)
- `supabase/.temp/` (gitignored)
- IDE/local caches

## 5. Secret / sensitive (excluded)

- `.env` and variants (gitignored)
- No service-role values, tokens, or cookies staged
- LMS secrets: none included

## 6. Temporary / test artifacts (excluded)

- `test-results/`, `playwright-report/` (gitignored; from SSO-blocked preview Playwright attempt)
- Temp credential files from D7 (already wiped)

## 7. Unrelated / incomplete

- None discarded; incomplete experiments not identified beyond normal gated-off feature writers (organizer/tournament/moderation/news remain `false`)

## LMS / secret notes

LMS ref appears only in **documentation warnings** instructing agents never to use it — not as credentials.
