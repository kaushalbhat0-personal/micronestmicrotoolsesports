# Discovery Experience

**[Recommendation]** Four finders share one UX language (filters → cards → public profile → vacancy → interest) but query different entities. Useful filters beat exhaustive filters; every filter must earn its place against real recruitment questions.

## Shared rules (all finders)

- **[Recommendation]** Searchable only when explicitly discoverable (`looking_for` / `recruiting` / `open` / `published` flags). Non-consenting entities never appear.
- **[Recommendation]** Public views are masked projections (no user ids, contacts, evidence, applicant lists). Reuse the legacy masked-view concept.
- **[Recommendation]** Unknown filter values are ignored, never error pages; filters are shareable GET params.
- **[Recommendation]** Honest empty states (real counts, how to broaden) and no-result states (which filter caused zero hits). No fake "recommended" filler.
- **[Recommendation]** No scores, percentages, or ratings anywhere. Fit explanation is a factual list (role match, region match, level window, tryout, verification source labelled self-reported vs verified).
- **[Confirmed]** Profile completeness is a private nudge (checklist on own profile), never a public shaming badge.

## Player Finder

- Searchable **[Recommendation]**: text (handle/display), game/title, role, region, availability, level window, looking-for, open-to-tryout, verification state, language.
- Sorting **[Recommendation]**: recently active, most complete, alphabetical. No "best" ranking.
- Public info: handle, display, avatar, region, roles, availability, level window (labelled self-reported), game identities (IGN + masked game ID), bio, verification badge.
- Privacy: game ID masked by construction; full ID only ever visible to self; evidence never public.
- Verification indicator: `verified` (account-control evidence reviewed) vs `unverified`, with method explanation. Never implies skill.
- SEO **[Recommendation]**: finder index + opt-in public profiles indexable; applicant-only pages `noindex`.

## Team Finder

- Searchable: text (name/slug), game, region, level window, recruiting-only (default on), independent-vs-org-owned, open-roles count.
- Sorting: recently active, most open roles, alphabetical.
- Public info: name, logo, game, region, level window, description, recruiting flag, open vacancies. Roster internals member-only ("roster private" fallback, legacy pattern).
- Empty state: "No teams recruiting for X right now — broaden region or role."

## Organization Finder

- Searchable **[Recommendation]**: text, game divisions, region, hiring-now flag, team count, verification (ownership-verified).
- Sorting: hiring-now first, then alphabetical/recent.
- Public info: name, logo, description, divisions (game + team links), open vacancies, verification badge, historical involvement summary (factual, sourced).
- Privacy: member lists and applicant data never public; only designated contact method shown.

## Brand Finder

- Searchable: text, industry/category, target (players/teams/orgs), active-opportunities flag, verification state.
- Sorting: active opportunities first, then alphabetical.
- Public info: brand profile, category, description, verification state (profile vs representative vs opportunity each badged separately), active opportunities, factual history. **[Risk]** An unverified brand with no opportunities must look exactly like that — never imply sponsorship activity.
- No-result state must distinguish "no brands match" from "no active opportunities" — they are different answers.

## Verification indicators (shared)

**[Recommendation]** Three independent badges, never merged: identity/account verification (this account controls this game ID / domain), representative verification (this user may act for this entity), opportunity verification (this listing passed moderation). Each shows method + date. Absence of a badge is neutral information, not suspicion.
