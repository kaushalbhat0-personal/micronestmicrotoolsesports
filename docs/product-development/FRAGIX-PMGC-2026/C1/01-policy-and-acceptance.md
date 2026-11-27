# 01 — Policy and acceptance

## 1. Profile creation and sharing

- Any eligible registered player can create and maintain their profile.
- Players may download the existing Share Kit PNG **without** verification.
- Players may share their public profile URL **without** verification.
- Unverified / pending / rejected / withdrawn / ID-mismatch profiles must **not** be shown as ownership-reviewed.
- Existing public-profile privacy boundaries remain: non-consented / incomplete profiles stay non-public per current G1 rules (`is_discoverable` + completeness for public resolution).

## 2. Registry discoverability

A player appears in the public FRAGIX **player registry** (directory search results) only when **all** are true:

1. Profile satisfies existing completeness requirements (`player_profile_is_complete`).
2. Player has explicitly enabled discoverability (`is_discoverable = true`).
3. BGMI ownership verification is **approved**.
4. Current BGMI Player ID still matches the immutable approved claim.

Otherwise they must **not** appear in registry results.

**Consent:** Keep `is_discoverable` as a stored preference. Registry eligibility is a **computed** gate on top of consent. Do not erase consent on reject / withdraw / ID mismatch.

## 3. Share-card and badge status

| State | PNG download | Reviewed badge on PNG / profile |
| --- | --- | --- |
| Unverified / none | Allowed | Hidden |
| Pending | Allowed | Hidden |
| Rejected | Allowed | Hidden |
| Withdrawn | Allowed | Hidden |
| ID mismatch | Allowed | Hidden |
| Approved + live ID matches claim | Allowed | Shown (“BGMI ownership evidence reviewed”) |

Never put private BGMI Player IDs, evidence, Storage paths, reviewer IDs, or internal notes in PNGs or public pages.

## 4. Acceptance criteria (testable)

| # | Criterion | Target |
| --- | --- | --- |
| AC1 | Unverified player can download PNG | Pass |
| AC2 | Unverified player can share public profile URL (URL resolves for recipients when privacy gates otherwise allow) | Pass |
| AC3 | Unverified player does **not** appear in public player registry | Pass |
| AC4 | Approved + complete + opted-in + ID match **does** appear in registry | Pass |
| AC5 | ID mismatch removes registry discoverability **and** reviewed badge immediately | Pass |
| AC6 | PNG / public profile never reveal private verification information | Pass |
| AC7 | Existing player sharing remains operational | Pass |

## 5. Constraints

- Reuse profile, verification, Share Kit.
- No new player tool; no RLS/evidence weakening; no G1 column widening; no unnecessary migrations; no extra PII.
- Preserve uncommitted work; no commit/push/deploy without authorization.
