# FRAGIX-C1 — Corrected Product Requirements (Locked)

**Status:** Requirements locked · **C1A–C1C** product delivery **PASS** · **C1D** ops audit **COMPLETE**  
**Branch:** `new-platform` @ `890e16c`  
**Supersedes:** Prior FRAGIX audit wording that implied verification was needed to create/share identity cards.

## Core policy (authoritative)

| Capability | Verification required? |
| --- | --- |
| Create / maintain player profile | **No** |
| Download shareable PNG | **No** |
| Share public profile URL | **No** |
| Appear in public FRAGIX **player registry** (directory search) | **Yes** (plus completeness + explicit discoverability + live ID matches claim) |
| Display ownership-reviewed badge (profile / PNG) | **Yes** (approved + currently valid only) |

Verification failure, withdrawal, rejection, or ID mismatch must **block registry discovery** and **hide the reviewed badge**. Do **not** silently clear `is_discoverable` consent.

## Two campaign benefits (messaging)

1. Create and share your competitive identity (card + URL) — **no verification required**.
2. Get BGMI ownership reviewed to become discoverable in the FRAGIX player registry.

Never imply verification is mandatory to create or share a card.

## Docs in this pack

| File | Purpose |
| --- | --- |
| `01-policy-and-acceptance.md` | Full policy + AC matrix |
| `02-current-vs-target-gap.md` | Pre-C1A gap analysis |
| `03-implementation-notes.md` | Original implementation sketch |
| `04-c1a-registry-eligibility.md` | **C1A delivery:** helper, search gate, tests, migration status |
| `05-c1b-brand-migration.md` | **C1B delivery:** FRAGIX surfaces, share kit, evidence, gates |
| `06-c1c-campaign-landing.md` | **C1C delivery:** identity-first `/campaigns/bgmi-season` |
| `07-c1d-reviewer-operations.md` | **C1D:** live admin counts + review lifecycle audit |
| `08-c1d-analytics-policy.md` | **C1D:** privacy-conscious event model (not implemented) |
| `09-c1d-legal-and-brand-readiness.md` | **C1D:** facts vs counsel questions |
| `10-c1d-campaign-operations.md` | **C1D:** publishing, support, incident, first-100 plan |
| `evidence/` | C1B + C1C visual QA screenshots |

## Implementation / audit verdicts

| Milestone | Verdict |
| --- | --- |
| C1A registry ownership gate | **PASS** (migration `00006` applied on Esports hosted) |
| C1B brand surface migration | **PASS** |
| C1C identity-first campaign landing | **PASS** |
| C1D campaign operations readiness | **CONDITIONALLY READY** (reviewer grant done; legal/analytics still open) |

### C1D overall campaign readiness

**CONDITIONALLY READY** for a **controlled** soft launch that emphasizes create + share.

Reviewer ops: durable super-admin **provisioned** (2026-11-28) for the owner-specified account — see `07-c1d-reviewer-operations.md`. Legal/analytics owner decisions remain open before paid push.

Live Esports check after grant: `platform_admins = 1`, `active_super_admin_count = 1`.

## Explicit non-actions (C1A–C1D)

- No hosted migration apply without authorization (C1A already authorized + applied).
- No commit / push / deploy unless explicitly requested.
- C1D: **no** privilege grants, **no** analytics SDK, **no** app/DB changes, **no** LMS access.
