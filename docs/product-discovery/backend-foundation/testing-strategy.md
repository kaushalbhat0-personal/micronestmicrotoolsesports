# Testing Strategy **[Proposed]**

## Lanes (existing, retained)

- **Unit** (`vitest run`, excludes `*.integration.test.ts`): pure services — matching/fit logic, lifecycle transitions, permission predicates, validation schemas, compensation-framing rules.
- **Integration** (`*.integration.test.ts`, embedded-postgres + `pg`, long timeouts): RLS with distinct authenticated users, cross-tenant isolation, lifecycle, ownership transfer, migration replay/safety.

## Mandated cases (must exist before launch)

1. Player cannot edit another player's profile (owner UPDATE denied cross-user).
2. Team member cannot perform owner-only actions (publish/delete as non-captain denied).
3. Recruiter cannot administer the organization (member management + settings denied; vacancy + review allowed).
4. Brand representative cannot act for another brand (cross-brand publish/review denied).
5. Applicants cannot read competing applications (queue isolation both directions).
6. Unverified brands cannot publish public partnership opportunities (triple-gate: brand state, rep state, moderation state — each tested independently).
7. Private contact information never leaks through discovery projections (base-table columns absent from every public view definition + row-level probe as anon and as unrelated user).

## Supporting suites

- Public-projection leakage: view-definition assertions (forbidden column list) + anon/auth probes per entity.
- Application lifecycle: apply → shortlist → accept/decline/withdraw + re-apply after terminal + duplicate-active rejection.
- Ownership transfer: accept-gated, audit-logged, last-owner block; account-deletion blocked while owned entities live.
- Publishing gates: first-listing review, pause/close/fill transitions, expiry sweep behavior.
- Cross-tenant isolation: org A member sees nothing of org B internals (all entity types).
- Migration replay: clean-DB reset applies all files in order (post duplicate-version fix); safety suite runs new migrations against a representative seeded DB (orgs, members, entities, applications) asserting no data loss and guard preservation.
- Advisor-clean gate: security linter run per migration (no new mutable-search_path, no unjustified anon EXECUTE, RLS on every new table).
