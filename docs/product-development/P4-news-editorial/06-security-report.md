# 06 — Content Security Review

## Input boundaries

- All external input (slugs, filters, draft fields, URLs) validated with
  strict Zod schemas (`src/features/news/schemas/article.ts`, single source).
- Route query parsing is fail-soft (`invalid[]` notice); pagination bounded
  (page size 12, max page 84, offset ≤ 1000); hostile input never throws.
- Unknown games fail closed (zero rows / explained empty state); planned
  titles rejected, never coerced.

## Content integrity

- **Slugs**: `/^[a-z0-9]+(?:-[a-z0-9]+)*$/`, 2–100, trimmed + lowercased.
  Invalid → 404 (no existence oracle).
- **External URLs** (source, hero): https-only, no credentials, hostname
  required, length-capped; re-validated at the reader (fail closed) and at
  render (`target="_blank" rel="noopener noreferrer"` + leaves-site notice).
- **Body**: structured blocks only (`paragraph | heading | quote | list`).
  No `html` kind, no `dangerouslySetInnerHTML` anywhere in News (route-audited).
- **Sanitization** (`domain/sanitize.ts`): strips all tags, decodes a small
  entity set, drops control chars, collapses whitespace, caps length —
  applied at validation AND render (defense in depth); React escapes again.
- **Attribution**: original vs sourced distinguished in schema, reader, and
  UI; sourced stories REQUIRE name + URL; original reporting NEVER links out
  as a source.
- **No fabricated content**: directory/detail render projections only; empty
  states never invent stories; no seed rows; no AI generation path.

## Authorization boundary

- Public reads: anon-capable, identity-free, RPC-only (proposed), output-mapped.
- Workspace: session check for the sign-in prompt only; NO author roles
  invented, NO approval permissions assumed, NO public article creation.
- Writes: kill-switched (`NEWS_WRITES_ENABLED = false`); actions return
  `{ ok: false }`; writer module validates then throws
  `NewsWriteDisabledError` before any table touch.
- Secrets: no service-role in browser or route code (route-audited); no base
  table exposure; no raw PostgREST detail to UI (generic domain errors).

## Residual risks (owner decisions)

See 09: author identity, editorial roles, corrections/reporting, image
hosting policy, and RLS review are all open. The write surface stays closed
until they are accepted.
