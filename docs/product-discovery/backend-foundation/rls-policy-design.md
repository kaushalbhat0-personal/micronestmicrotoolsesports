# RLS Policy Design (intent only — no SQL written) **[Proposed]**

Each bullet names table, command, role, and condition in prose. Implementation translates these 1:1 later.

## Helpers (new, narrow SECURITY DEFINER, fixed search_path, least-privilege EXECUTE)

- `is_team_captain(team)` / `is_team_member(team)` — membership-role checks.
- `is_org_recruiter(org)` — new role check (D-02); existing `is_org_member/admin/owner` reused untouched.
- `is_brand_rep(brand)` + `is_brand_admin(brand)` — representation + scope checks.
- `is_opportunity_publisher(opportunity)` — resolves publisher entity → corresponding role check.
- `can_apply(opportunity)` — open + approved + target-type match + no active application (cheap pre-check; enforcement stays in constraints).

## Policy intent per domain

- **Public views** (`public_players`, `public_teams`, `public_organizations`, `public_brands`, `open_opportunities`): SELECT to `anon, authenticated` with consent/published predicates baked into the view; minimal columns by construction (no contacts, ids, evidence, links, applicant data).
- **Owner tables** (player/game profiles, team/org/brand bases): SELECT/INSERT/UPDATE/DELETE to `authenticated` where row-owner = `auth.uid()` (or captain/admin/owner/rep via helpers for entity rows); INSERT requires self-owned foreign keys.
- **Membership tables:** SELECT to members/self; INSERT/UPDATE/DELETE to owner/admin (org), captain (team), admin-scope rep (brand); leave-self DELETE allowed; last-owner/admin guards via triggers.
- **Opportunities:** world SELECT only through the open-approved view; base-table SELECT to publisher-side roles + moderators; INSERT/UPDATE/DELETE to publisher roles on the owning entity with the brand triple-gate as WITH CHECK condition.
- **Applications:** SELECT to applicant OR publisher-side roles OR moderators; INSERT applicant-only with active-guard; UPDATE split (applicant→withdrawn only; publisher→shortlisted/accepted/declined only); no DELETE (withdraw is terminal-visible).
- **Verification/reports/strikes:** owner INSERT (+pending-only DELETE for submissions), no owner UPDATE; moderator SELECT + service-role triage writes; reporter sees own reports only.
- **News/tournaments:** published SELECT to all; drafts to editors; editor = admin-scoped capability checked via `is_super_admin()` or editor grant table (implementation choice — editor grant table recommended for least privilege).
- **Notifications:** owner SELECT + mark-read UPDATE; system INSERT via service-role only.
- **Audit:** member/admin-scoped SELECT; no client writes anywhere.

## Anti-patterns explicitly excluded

No `anon` INSERT/UPDATE/DELETE; no merged badge flag; no applicant-list readability; no client-writable verified fields; no copied broad anon EXECUTE on new RPCs (per-function necessity review, default `authenticated`-only); RLS on every new table before any app code reads it (advisor-clean gate per migration).
