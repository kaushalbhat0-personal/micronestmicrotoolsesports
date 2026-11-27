# 06 — PMGC Opportunity Assessment

## Framing

PMGC 2026 and India’s participation are a **time-sensitive attention window**, not a license to invent tournament facts or use official branding.

**UNKNOWN / external verification required (do not treat as product facts):**

- Exact dates, stages, formats, scoring, and qualification rules for PMGC 2026.
- Official participant lists, logos, and trademark usage rights.
- Any claim that MicroNest tools reproduce official PMGC scoring.

Until verified from primary sources, product copy must stay educational/generic (“BGMI tournament formats”, “qualification scenarios”) and avoid official marks/player imagery without permission.

---

## Opportunity thesis

Use MicroNest’s existing strengths — client tools + opt-in discovery + shareable identities — to become the **utility layer people open during the season**, then carry MicroNest watermarks into Discord/WhatsApp/Instagram.

Operator preference for asynchronous work favors:

- Self-serve share cards.
- SEO/educational pages that do not require live ops staffing.
- Avoidance of manually moderated recruitment marketplaces in the event window.

---

## Feature buckets

### 1) Deliverable with existing functionality — VERIFIED capability exists

| Idea | Notes |
|---|---|
| Point players/teams to `/tools/tiebreak-qualifier`, prize pool, roster | Live tools |
| Point creators to `/players` / `/teams` directories | Live discovery |
| Frictionless signup → profile for seasonal LFT presence | Live onboarding |
| Honest empty tournament shells (no fake PMGC bracket) | Live posture |

### 2) Small frontend changes — recommended for window

| Idea | Classification | Schema? |
|---|---|---|
| Seasonal landing `/campaigns/bgmi-season` (or similar) linking tools + directories | MISSING page | No |
| Tool result PNG + watermark | MISSING | No |
| Player LFT PNG from public fields | MISSING | No |
| Team recruiting PNG | MISSING | No |
| Tie-break “explain this ranking” expanded copy | PARTIAL | No |
| Generic format education articles as static MDX/pages | MISSING | No |
| `?ref=` attribution on share CTAs | MISSING | No |

### 3) Backend / schema changes — avoid for event-critical path

| Idea | Why deferred |
|---|---|
| Official bracket ingestion | High ops + rights + accuracy risk |
| Open-slot recruitment marketplace | Migration + authz + moderation burden |
| Verified player badges for “PMGC participants” | Conflicts with verification policy; abuse risk |
| Server-stored share tokens at scale | Needs RLS + rate limits before season rush |

### 4) Too risky / unnecessary for the window

| Idea | Reason |
|---|---|
| Official PMGC branding / logos / player photos | Legal / rights |
| Claiming “official qualifier calculator” | Accuracy + trust risk |
| Aggressive outreach CRM | Against operator preference |
| Fabricated engagement metrics | Explicitly forbidden |

---

## Realistic campaign package (recommended)

**Name (working):** “BGMI Season Toolkit” (neutral — not “Official PMGC”).

1. Landing: pathways to Tie-Break, Prize Pool, Roster, Players, Teams.
2. Share Kit v1 outputs with MicroNest watermark.
3. Optional SEO pages for generic queries (“BGMI prize pool split”, “esports tie break explained”) — **marketing routes only** until product `noindex` policy is revisited.
4. Community content: encourage user-generated standings graphics with disclosure footer.

## Timing relevance vs roadmap

Share Kit + landing can ship without waiting for Auth dashboard certification, but production Auth confirmation status remains **UNVERIFIED** (P14-D14) and should be closed before large paid acquisition.

## Finding — F-PMGC-01

- Evidence: tools + discovery live; share/PNG/landing absent; official data UNKNOWN.
- User impact: seasonal users lack a single campaign entry + shareable artifacts.
- Business impact: missed asynchronous acquisition window.
- Complexity: low–medium for frontend package. Risk: medium if copy overclaims. Action: neutral toolkit landing + Share Kit; verify external facts separately.
