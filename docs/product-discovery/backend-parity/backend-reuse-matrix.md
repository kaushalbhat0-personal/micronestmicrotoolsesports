# Backend Reuse Matrix (16 domains, approved D-01/D-02/D-11 baseline)

Infrastructure reuse ≠ domain-schema reuse. Finder tables are deliberately **not** migrated (D-11); empty production rows confirm zero migration need.

| # | Domain | Classification | Why |
|---|---|---|---|
| 1 | Auth & identity | REUSE AS-IS | Supabase Auth + `profiles` 1:1 pattern; triggers provision rows. |
| 2 | Player profiles | BUILD NEW | Legacy finder hardcoded BGMI, flat levels; new `PlayerProfile` per D-01. Reuse handle-uniqueness + masked-view patterns. |
| 3 | Game profiles / multi-title | BUILD NEW | `GameTitle` catalogue + per-title `GameProfile`; legacy `game='bgmi'` CHECK must not be copied. |
| 4 | Teams & memberships | BUILD NEW | Independent-or-affiliated teams + roster roles; legacy flat captain model insufficient. Reuse captain-guard + partial-unique patterns. |
| 5 | Organizations & divisions | REUSE WITH ADAPTATION | Keep orgs/membership/audit/owner-guard RPCs; add divisions link + recruiter role (D-02) — requires role CHECK widening + new helper (new migration, later). |
| 6 | Ownership & recruiter perms | REUSE WITH ADAPTATION | Owner-guard + transfer RPCs proven; extend role set and `is_org_recruiter()`. |
| 7 | Brands & representatives | BUILD NEW | No brand objects exist. Reuse org-membership shape + verification-submission pattern. |
| 8 | Opportunities & recruitment | BUILD NEW | Shared engine + per-type extensions; legacy recruitment posts are team-scoped BGMI-only. Reuse status/expiry + partial-unique patterns. |
| 9 | Applications / interest | BUILD NEW | One lifecycle, applicant/captain visibility split; reuse legacy application guards conceptually. |
| 10 | Verification & moderation | REUSE WITH ADAPTATION | Evidence-private + reviewer-queue + report-table patterns proven; new target types (org/brand/opportunity) needed. |
| 11 | News editorial | BUILD NEW | No article objects; reuse editor-via-admin pattern + publish-gated reads. |
| 12 | Tournament discovery | BUILD NEW (editorial MVP) | Legacy BGMI hub is source-synced stats data, wrong shape for editorial listings — KEEP DORMANT, don't repurpose. |
| 13 | Notifications | BUILD NEW | No queue objects; model early per roadmap. |
| 14 | Audit logs | REUSE AS-IS | Both audit tables + append-only/lifecycle triggers fit new domain directly. |
| 15 | Storage & media | REUSE AS-IS | 3 buckets + path-helper policy pattern cover logos/avatars/evidence; add brand paths later by convention. |
| 16 | Admin controls | REUSE AS-IS | `platform_admins` + `is_super_admin()` gate queues and publishing. |

## Keep dormant

Sentinel suite, draft-ban, tie-breaker, payout-tracker, meta-parser, BGMI hub, quota ledgers/RPCs, billing rails (until commercial scope), legacy finder tables + views (reference for patterns; production rows zero).
