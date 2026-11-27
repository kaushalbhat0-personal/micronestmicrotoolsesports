# 05 — UI / UX & Accessibility

**Target:** WCAG 2.2 AA  
**Method:** Code inspection of shells, directories, tools, auth/onboarding (no live redesign).

## What works (preserve) — VERIFIED

- Distinct Arena brand: Oswald display, Geist body, crimson accent, paper/arena surfaces (`globals.css`, marketing hero).
- Mobile-first patterns on tools and directories (`sm:` grids, wrapping actions).
- Touch-conscious targets on auth/header/tools (frequent `min-h-[44px]`).
- Labelled filter forms; shareable GET URLs for directories/tools.
- Tools: `aria-invalid`, `aria-describedby`, `role="alert"`, `aria-live` for results.
- Honest empty/unavailable copy for tournaments/news shells (no fake listings).
- Header: Discover menu + auth account menu with keyboard-oriented controls (P14 acceptance).

## Problems by severity

### P1 — First-time clarity without human help

| Issue | Classification | Evidence / impact |
|---|---|---|
| After signup, profile can be “complete” but thin (no availability, no avatar UX) | PARTIAL | Onboarding vs settings gap → weak directory presence |
| Team create soft-gate messaging vs hard email_confirmed_at | PARTIAL | Can confuse if Auth config drifts (P14-D14 Auth UNVERIFIED) |
| Tools reset on refresh with little “save locally?” cue | PARTIAL | Tiebreak snapshots help in-session only |
| No “Share / Download image” CTA anywhere | MISSING | Blocks self-serve distribution |

**Screens needing redesign attention (not redesigned here):**  
`/settings/profile` (completeness loop), `/teams/new` gate education, tool result panels (export zone), player/team public profiles (share strip).

### P2 — Design-system consistency

| Issue | Classification |
|---|---|
| `components/ui` is Button-only; forms reinvent inputs | PARTIAL |
| Player cards use Arena sharp language; team cards use softer rounded white cards | PARTIAL (visual drift) |
| Marketing vs app density inconsistency | PARTIAL |

### P3 — Accessibility gaps to verify in browser

| Issue | Classification | Notes |
|---|---|---|
| Contrast of slate chips on paper | UNKNOWN | Needs computed contrast check |
| Focus order in complex tiebreak grids | PARTIAL | Labels exist; dense tables risky on mobile |
| Screen-reader announcement of dynamic standings | PARTIAL | `aria-live` present; verbosity untested |
| Reduced motion | VERIFIED token | `prefers-reduced-motion` in CSS; motion budget otherwise light |

## Form usability — VERIFIED / PARTIAL

- Signup/login: clear validation, password mismatch alert, frictionless copy.
- Onboarding: required handle; country code free text — risk of invalid codes without guided picker (**PARTIAL**).
- Tools: strong inline validation except prize over-allocation throw (**PARTIAL**).

## Performance / complexity — PARTIAL

- Homepage is static composition (good).
- Directory pages stream results (good pattern).
- No heavy client chart libraries (good).
- Share Kit must avoid large dependencies if possible (prefer canvas/DOM serialize carefully).

## Finding — F-UX-01 (self-serve loop)

- Evidence: strong create flows; weak “broadcast identity/results” flows.
- User impact: users finish a task then stall.
- Business impact: utility does not become acquisition.
- Complexity: medium. Risk: low. Action: add share/download as first-class result state on tools + profiles.

## Finding — F-UX-02 (visual system drift)

- Evidence: player vs team card styling divergence; thin UI primitive set.
- User impact: less “one product” feel.
- Business impact: weaker brand recall in screenshots/shares.
- Complexity: medium. Risk: low. Action: align share-card templates to Arena tokens before expanding UI library.
