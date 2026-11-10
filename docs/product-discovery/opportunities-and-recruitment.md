# Opportunities and Recruitment

## The shared-vs-specific question

**[Recommendation]** Build one opportunity engine with per-type field profiles — not nine separate systems, and not one generic form that produces poor domain semantics.

Shared core (every opportunity): publisher (team/org/brand + acting user), owner entity, target audience (players / teams / staff / partners), role/opportunity type, game(s), description, requirements, application method (in-platform interest vs external link), status (`draft`/`open`/`paused`/`closed`/`filled`/`expired`), expiry, visibility, moderation state, duplicate key.

Per-type extensions **[Recommendation]**:
- Player recruitment: role needed, slots, level window, tryout required, availability required.
- Team recruitment (org signing a team): division, roster size expectations, current achievements (free text, self-reported).
- Staff (coach/manager/analyst/other): employment type, experience, responsibilities. **[Open: paid vs voluntary flag]**
- Brand partnership/sponsorship: opportunity class (sponsorship, partnership, paid vacancy, trial), compensation framing (ranges or explicit unpaid — never blank-promising), deliverables summary, duration.
- Other esports opportunities: open category with mandatory moderator review.

## Lifecycle

**[Recommendation]** `draft → open → paused ⇄ open → closed/filled/expired`; applications `applied → shortlisted → accepted/declined`, withdrawable while active. One active application per applicant per opportunity (partial-unique guard, proven legacy pattern). Terminal states allow re-application. Expiry auto-transitions via scheduled sweep (no silent term changes — edits after applications create an audit note).

## Publisher, owner, target

- Publisher: the team/org/brand entity. Owner: that entity's administrators. Target: who may apply (player, team via captain, staff applicant, partner entity).
- **[Recommendation]** Cross-type applications (e.g. a team answering a player vacancy) are rejected by type check with a clear message, not silently accepted.

## Application vs interest

**[Recommendation]** One lifecycle engine, two intensities: Interest (one-click + optional note; for brand/partnership exploration) and Application (structured answers per type). Both produce the same review queue; the publisher chooses which to enable.

## Moderation and duplicates

- **[Recommendation]** First opportunity from a new publisher requires review; established publishers publish instantly with post-moderation + reports.
- Duplicate handling: warn on same publisher + same role/team + overlapping window; require explicit confirmation; never hard-block (genuine re-hiring exists).
- Fake listings and misleading sponsorship claims: reportable categories with fast takedown path (see `trust-and-moderation.md`).

## Out of scope for the engine

Payments, escrow, contracts, chat threads, and automated matching scores. The engine ends at `accepted` + handoff of the publisher's stated contact method.
