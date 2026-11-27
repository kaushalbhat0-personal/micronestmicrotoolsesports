# 24 — Directory Availability Review (P14-B3 Phase 2)

Scope: `/players`, `/teams`, `/organizations`, `/brands`, `/organizers`,
`/tournaments`, `/news` versus homepage representation. No database
contracts, migrations or write switches touched; no migrations applied.

## Per-route findings (route code + results components)

| Route | Shell | Empty state | Unavailable state | Fake records |
|---|---|---|---|---|
| `/players` | Live, filters + pagination + skeleton | “No players found” / “No public profiles match…” | `role=alert` “Directory unavailable”, retry link | None — APPROVED RPC reader only |
| `/teams` | Live, filters + pagination + skeleton | “No teams found” + reset | `role=alert` retryable | None — D1 reader, UNAPPLIED RPCs fail safe |
| `/organizations` | Live, filters + skeleton | “No organizations found” | “Organization directory unavailable” | None — PROPOSED RPCs, no migration |
| `/brands` | Live, filters + skeleton | “No brands found” | “Brand directory unavailable” | None — PROPOSED RPCs, no migration |
| `/organizers` | Live, filters + skeleton | “No organizers found” | “Organizer directory unavailable” | None — PROPOSED RPCs, local-only migration |
| `/tournaments` | Live, filters + pagination + skeleton | “No tournaments found” / “No tournaments are listed yet” | `role=alert` “Tournament directory unavailable” | None — PROPOSED RPCs, no migration |
| `/news` | Live, filters + pagination + skeleton | “No stories found” / “No stories are published yet” | `role=alert` “News unavailable” | None — PROPOSED RPCs, no migration |

Invalid filter combinations render explained empty states with reset links on
all seven routes; detail slugs 404-equivalent or intentional unavailable
states (verified `routes.test.ts` per domain + `[slug]/unavailable-state`).

## Homepage representation check

- Discovery pathways (`AudiencePathways`): links all four directories; copy
  says “Consent-first”, “Self-declared”, “declared vacancies” — no population
  or success claims. Accurate.
- Tournament showcase: `role=status` note “No tournaments are listed on this
  preview. The live directory below is the source of truth”; specimens
  labelled “Illustrative specimen — demo data only”; all CTAs → `/tournaments`
  only, no registration handoff. Accurate.
- Editorial guides: lede “provided for reference only. Not active
  journalistic reporting… Published stories appear only in the news
  directory”; cards labelled “Editorial concept — sample template”; all CTAs
  → `/news` directory, no article slugs. Accurate.
- Tools showcase: descriptions verbatim from `TOOL_REGISTRY`; real slugs
  only. Accurate.
- Hero: opt-in language, “nothing is scraped, nothing is verified”,
  dossier labelled “not a real athlete”. Accurate.
- Footer: “routes are live” refers to discovery routes (shells), paired with
  “Publishing, ownership and verification writes, opportunities and mini games
  are planned… News content appears only after editorial acceptance.” Now
  consistent with the rewritten About page. Accurate.

## Verdict

No misrepresentation. The homepage never claims any directory is populated
and never links a fabricated record. The Tier B “directory live, data
pending” reality is stated on the homepage (empty-state notes), the footer
and the About contract page.
