# 04 — D-G1-10 Decision Brief (email-confirmation gate for discoverability)

Status: **APPROVED — Option A (require verified email before public
discoverability), product-owner approval dated 2026-11-11.** Synchronized
into `10-open-decisions.md` (APPROVED section + CLOSED stage-gate entry)
and `11-decision-freeze.md` (nine approvals) in G1-8A.1. Enforcement is
G1-8B implementation scope; no code, migration, or configuration was
changed by this synchronization.

## 1. Exact original wording (verbatim, not paraphrased)

Source: `docs/architecture/g1-identity-player-profile/10-open-decisions.md`
§ D-G1-10 (lines 76–81):

> ## D-G1-10 — Email-confirmation gate for discoverability (U1)
> - Question: Require verified email before `is_discoverable` can be enabled?
> - Options: (a) Require (recommended before public). (b) Allow unverified (dev only).
> - Recommendation: (a) before public onboarding; (b) acceptable during closed development.
> - Impact: `setDiscoverability` server check (`email_confirmed_at`), no schema change.
> - User approval required: Yes (product/security).

Stage-gate classification (verbatim):

> D-G1-10 (email-confirmation gate for discoverability): open. Required
> before public onboarding; closed-development behaviour (allow unverified)
> acceptable until then.

(`10` § "Remaining open decisions — stage gates"; `11` §6:
"D-G1-10 email-confirmation gate — open; gate: before public onboarding.";
`11` §7: "Public onboarding requires D-G1-07/D-G1-10 + `site_url`/allowlist.")

## 2. Current approval status (G1-8A.1)

**APPROVED — Option A, product-owner approval dated 2026-11-11.**
Synchronized into the frozen architecture (`10` APPROVED section with
implementation consequences; `11` nine-approval freeze record). The
mechanism stays as specified: a server-side `email_confirmed_at` check with
no schema change. What remains is G1-8B enforcement implementation plus
dashboard verification of the Auth confirmation/redirect settings
(UNVERIFIED remotely — see `01-auth-configuration.md`).

Approved behavior (authoritative, eight points):

1. Users may register with an unverified email.
2. Users may establish an authenticated session where Supabase Auth permits it.
3. Users may create and maintain a private player profile, subject to existing identity and profile security rules.
4. An unverified user must not enable public player discoverability.
5. Email verification is a prerequisite for enabling `is_discoverable`.
6. The rule must be enforced server-side and cannot depend solely on frontend controls.
7. Existing public directory RPCs must continue to return only approved, consented public projections.
8. Verification must not be represented as player skill verification, identity verification or professional trust verification.

Email confirmation is therefore NOT a requirement to block private profile
creation — bootstrap, canonical/game-profile CRUD, avatars, and settings
remain available to unverified sessions exactly as today.

## 3. Implications (current verified behavior vs each dependent flow)

Verified baseline: no `email_confirmed_at` reference exists in any migration,
function body, or `src/` file (grep zero matches; both G1-4 RPC bodies and
both G1-7 DEFINER bodies inspected). Auth-level confirmation settings are
UNVERIFIED remotely.

| Flow | If (a) Require (recommended) | If (b) Allow unverified |
|---|---|---|
| Public registration | Signup completes; session may exist but discovery stays locked until the user confirms the email. Needs confirmation UX + resend. | Signup → immediate eligibility for discovery once profile is complete. Lowest friction, highest spam/impersonation exposure. |
| Application identity bootstrap (`ensure_app_user`) | Unchanged (bootstrap is identity anchoring, not publication). Suspended-gate pattern is reused; confirmation is NOT added to bootstrap — only to the discoverability toggle. | Unchanged. |
| Player-profile creation | Unchanged (private by construction, forced undiscoverable). Creation never implies verification. | Unchanged. |
| Session establishment | An unconfirmed session can exist and use private features but cannot publish. Requires the app to distinguish "signed in" from "allowed to publish" in onboarding copy. | No distinction needed. |
| Duplicate registration | Confirmation does not deduplicate (one email = one Auth user already). Typo-emails fail confirmation and can never publish — accepted, self-cleaning. | Typo/throwaway emails can publish immediately; directory quality depends entirely on post-hoc moderation (D-08, open). |
| Account recovery | Recovery presupposes control of the mailbox, so a confirmed-mailbox rule composes cleanly with recovery: a user who can recover can (re-)confirm. Exact recovery redirect must be allowlisted (UNVERIFIED today). | Recovery still works, but an attacker with a throwaway mailbox gets a publishable account with no confirmation step at all. |
| Email changes, if supported | No email-change flow exists in G1. If one is ever added: changing the email must reset discoverability eligibility until the new address is confirmed (otherwise the gate is bypassed by confirming once, then swapping). No schema change — same server check reads the fresh claim. | No constraint; swaps are invisible. |

Security consequences: (a) converts the public directory from
self-declared-anyone to mailbox-verified publishers with no schema change,
no RLS change, and no projection change; it does not verify game-account
ownership (that is D-G1-04 Option C territory, separately deferred). (b)
preserves the current posture where anyone who can receive an OTP-less
session can publish — acceptable only behind closed development.

## 4. Options and consequences

- **Option A — Require verified email before `is_discoverable` (recommended
  before public).** `setDiscoverability` (and any future publish path)
  asserts a fresh confirmed-email signal and rejects unconfirmed callers
  with the existing generic error shape; no schema change; no RLS change;
  no projection change. Cost: confirmation + resend UX, support load for
  undelivered mail, onboarding copy distinguishing signed-in vs publishable.
- **Option B — Allow unverified (dev only).** Ship public onboarding without
  the check. Cost: throwaway-mailbox publishing, directory spam, handle
  squatting at scale, and no mailbox accountability for harassment — with
  moderation (D-08) still open and no rate limits yet implemented.

## 5. Explicit product-owner question

**D-G1-10: for public onboarding, do you approve (a) requiring a verified
email before `is_discoverable` can be enabled — enforced by a server-side
confirmed-email check in the discoverability path with no schema change —
or (b) allowing unverified emails to publish, accepting throwaway-mailbox
publishing and moderation-by-reaction as the public posture?**

**Recorded answer (2026-11-11): (a) Require verified email before public
discoverability — APPROVED** with the eight-point behavior above. This
question is closed and must not be re-asked.
