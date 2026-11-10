# RLS and Authorization Model (Proposed — No Policies Written)

**[Recommendation]** throughout. This document defines boundaries only. No SQL written or applied in this phase.

## Principles (carried from the existing backend)

- Authorize the **user**, display the **entity**: every write resolves session → membership/representation → permission.
- Public discovery reads **masked projections** (views), never base tables with PII.
- Owner < admin < representative < applicant < public is a ladder, not a single flag.
- Reviewer reads (verification, reports) are super-admin-gated; evidence is never public.
- Append-only where history matters (applications log, audit logs); no client UPDATE/DELETE on those surfaces.
- Last-owner/last-admin removal blocked at the database level.

## Boundaries

| Boundary | Rule sketch |
|---|---|
| Public profile discovery | `anon`+`authenticated` SELECT on public views only, predicated on discoverability flags (`looking_for`/`recruiting`/`open`/`published` + indexing consent where applicable) |
| Private profile info | Owner-only SELECT on base tables (contacts, game IDs, evidence paths, applicant lists) |
| Entity ownership | Owner role: full management incl. transfer/archive; single owner per org (transfer-gated) |
| Entity admins | Admin role: members, teams, vacancies; cannot delete entity or demote owner |
| Recruiters | Proposed scoped role: vacancies + application review only **[Open]** |
| Brand representatives | Verified link required before publishing; draft-only until verified |
| Opportunity publishers | Captain/admin/rep check on the owning entity at publish and at every review action |
| Applicants | Own-row reads/writes; withdraw while active; never see other applicants |
| Platform admins | Queue reads (verification, reports), takedown/publish powers, audit-logged; no direct data edits outside defined RPCs |

## What changes vs legacy

- New-domain tables replace the BGMI-hardcoded finder suite; same masked-view + helper-function shape (`is_team_captain`, `is_org_recruiter`, `is_brand_rep` as narrow `SECURITY DEFINER` functions).
- Organization context (slug → membership check) returns as the canonical pattern for org/team/brand writes — the legacy finder deliberately bypassed it (user-scoped), which must not be copied for entity publishing.
- No new policies, functions, or grants are applied until the domain tables are approved and the live-project parity check passes.
