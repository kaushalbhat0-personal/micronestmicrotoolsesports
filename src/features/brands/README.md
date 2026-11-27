# Brands feature (P8)

Public brand discovery only. A brand is NOT an organization. No
representative verification, no sponsorship writes in this phase.

- `domain/` — public card/detail contracts for the PROPOSED RPC pair,
  industry/partnership/interest vocabularies, column contract.
  `representative_verified` is frozen false.
- `schemas/` — Zod route/reader input boundaries (no writes).
- `server/brand-reader.ts` — reads exclusively through the proposed
  `search_brands` / `get_brand_by_slug` RPCs (no migration exists).
  Identity-free, anon-safe, strict key-set mapping, fail closed.

Security: no base-table reads, no service role, no representative/contact
PII, no availability claims. See
`docs/product-development/P8-org-brand-discovery/`.
