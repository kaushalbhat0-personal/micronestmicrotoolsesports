# 09 — Prioritized Roadmap

## Scoring lens (qualitative)

User value · Acquisition/distribution · Repeat engagement · Monetization · Effort · Security/ops risk · PMGC timing.

## Smallest valuable first release — **P15-M1 Share Kit v1**

**Goal:** Turn existing utility into shareable branded artifacts without schema/RLS changes.

| Work item | Effort | Risk | PMGC | Rationale |
|---|---|---|---|---|
| Prize / Roster / Tie-Break download PNG + watermark + copy polish | M | L | High | Immediate organizer/community distribution |
| Inline fix for prize over-allocation errors | L | L | Med | Trust |
| Player LFT PNG from public projection + profile URL | M | L | High | Player-generated growth |
| Team recruiting PNG (boolean + public fields) | M | L | High | Team-generated growth |
| Neutral “BGMI Season Toolkit” landing linking tools + directories | L | L | High | Campaign entry without official IP |
| Optional `?ref=` on watermark links | L | L | Med | Later attribution |

**Out of scope for M1:** server share tokens, open-slot tables, verification, billing, official PMGC data, SEO indexing policy change.

**Success signals (qualitative, not fabricated metrics):** users download cards; shared images visibly include MicroNest mark; support burden stays near zero.

---

## Sequence after M1

### P15-M2 — Profile completeness loop (frontend + existing APIs)

| Item | Effort | Risk | Why next |
|---|---|---|---|
| Settings: edit game profile (IGN/role/modes/region) | M | L | Richer cards/directory |
| Availability capture UI | M | L | Matching signal already in schema |
| Avatar upload UI wiring | M | M (storage) | Share pride |
| Directory filter: availability (if RPC allows / extend carefully) | M–H | M | May need RPC review → treat as gated |

### P15-M3 — Tool retention (still mostly client)

| Item | Effort | Risk |
|---|---|---|
| `localStorage` presets / last scenario restore | L–M | L |
| BGMI roster templates (4+2, etc.) | L | L |
| CSV download surfaced in UI | L | L |
| Generic educational format pages | M | L (copy accuracy) |

### P15-M4 — Recruitment v1 (schema — authorization milestone)

| Item | Effort | Risk |
|---|---|---|
| Open-slot posts table + RLS + RPCs | H | H |
| Mount recruitment UI; applications workflow | H | H |
| Recruiting filter on `/teams` | M | M |
| Rate limits + abuse controls | M | M |

**BLOCKED** until explicit security authorization.

### P15-M5 — Monetization experiments

Only after M1–M3 prove repeat use:

- Premium card themes / featured placement (never “verified”).
- Organizer digital packs (PDF bundles).
- Productized sponsor slots if inventory exists.

### Parallel ops (not a feature milestone)

| Item | Status |
|---|---|
| Production Auth dashboard certification | OPEN / UNVERIFIED |
| Confirm tournaments/organizers migration apply posture in prod | UNKNOWN → verify |
| Decide whether to relax `noindex` for selected marketing/tool pages | Product decision |

---

## Explicitly deferred

- Mini Games.
- Server-side share token platform (until abuse design ready).
- Public roster identity exposure.
- Player verification marketplace.
- News/brands/organizations DB build-out as growth-critical path (helpful later, not M1).
- Legacy billing revival without new-platform entitlement design.
- Official PMGC branding/data integration.

## Ranking summary (top 5)

1. Share Kit v1 (tools + LFT + recruiting PNGs) — best acquisition/effort ratio.
2. Prize validation UX fix — cheap trust.
3. Season toolkit landing — PMGC timing.
4. Profile completeness (availability/avatar/game edit) — better shares + matching.
5. Client presets/templates — repeat engagement.

Do **not** attempt M4 recruitment schema in the same release as Share Kit.
