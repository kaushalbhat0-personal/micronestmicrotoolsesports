# Organizations feature (P8)

Public organization discovery only. No writes, no ownership, no verification
pipeline in this phase.

- `domain/` — public card/detail contracts for the PROPOSED RPC pair,
  org-type vocabulary, trust states, https link validation, column contract.
- `schemas/` — Zod route/reader input boundaries (no writes).
- `server/organization-reader.ts` — reads exclusively through the proposed
  `search_organizations` / `get_organization_by_slug` RPCs (no migration
  exists). Identity-free, anon-safe, strict key-set mapping, fail closed.

Security: no base-table reads, no service role, no private fields, no silent
team attachment, no recruitment fabrication. See
`docs/product-development/P8-org-brand-discovery/`.
