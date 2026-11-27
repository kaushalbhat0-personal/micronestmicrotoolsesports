# P9 organizer domain

## The organizer is a first-class, independent concept

An organizer is a **publishing identity for tournament discovery**. It is not
automatically a player, an organization, a brand or a tournament. Conflating
these would silently grant authority where none was approved.

## Identity fields

| Field                        | Rule                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `name`                       | 2–80 chars, required                                         |
| `slug`                       | Unique, immutable, lowercase-hyphen 2–80                     |
| `description`                | ≤1000 chars, detail only, nullable                           |
| `region_code`                | BGMI vocabulary at the reader today; other games fail closed |
| `organizer_type`             | `independent \| organization \| professional` (frozen)       |
| `game_keys`                  | 1–8 catalogue keys, multi-title (GIN indexed)                |
| `website_url`                | https-only, no credentials, ≤2000, nullable                  |
| `social_links`               | ≤8 × `{label ≤40, url https}`, nullable                      |
| `trust_state`                | 6-state vocabulary, default `not_submitted`                  |
| `is_public`                  | Public visibility flag (RPC predicate)                       |
| `published_tournament_count` | DERIVED at read time, never stored                           |
| `organization_slug`          | Explicit linkage only, else null (detail only)               |

No logo column exists: no accepted organizer media contract (storage bucket
reservation only). Cards render an initial-letter mark.

## Organizer types

- `independent`: standalone organizer, no organization attachment.
- `organization`: an esports organization that **explicitly** operates
  tournaments. The linkage is opt-in and recorded; it is never inferred from
  a matching name and never grants organization members organizer rights.
- `professional`: a future vetted operator class. The value is frozen so
  filters and cards stay honest, but no professional rows exist until a
  verification + operator policy is approved. Filtering to it today honestly
  returns zero rows.

## Relationship model

1. **Independent organizer** — fully supported in P9 (create → own → publish
   path, pending moderation approval).
2. **Organization operating tournaments** — supported only through explicit
   linkage. The `organization_slug` detail field exists for the approved
   future; until the ownership/consent decision lands it is always null and
   organizations are never silently converted.
3. **Professional operator** — vocabulary reserved, verification undesigned,
   no rows, no badges.

## Trust

Same 6-state vocabulary as P8 (`not_submitted … expired`). Only `confirmed`
renders a confirmation indicator; every other state renders `Unverified` +
the exact state label and note. A published tournament never confirms its
organizer; a confirmed organizer is never implied from a listing.

## What the domain forbids

- No organization member → organizer permission inheritance.
- No self-approved verification.
- No ownership transfer (founding owner immutable, no workflow).
- No recruitment, applicant or payment members.
