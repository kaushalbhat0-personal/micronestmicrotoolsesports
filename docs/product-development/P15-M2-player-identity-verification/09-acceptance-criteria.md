# 09 — Acceptance Criteria (for future M2B)

Use as exit gates per work package. Architecture milestone M2A does not implement these.

## A. Functional

| ID | Criterion |
|---|---|
| F1 | Owner can edit IGN, role, region, play modes, availability, display name, bio, country |
| F2 | Owner can set/update private BGMI Player ID (`game_user_id`) |
| F3 | Owner can upload/replace/remove public avatar via existing bucket rules |
| F4 | Completeness UI lists missing directory-eligible fields truthfully |
| F5 | Discoverability enable fails when incomplete; disable always works |
| F6 | Discoverability opt-out removes public visibility without requiring badge |
| F7 | Badge not required for directory listing |
| F8 | Owner can submit ≤2 private evidence images and withdraw |
| F9 | Reviewer can approve/reject with required internal reason on reject |
| F10 | Public profile may show minimal “BGMI ownership evidence reviewed” only when approved |
| F11 | Discord never blocks signup, completeness, or discoverability |
| F12 | Share Kit player/team PNGs never include evidence or BGMI ID |

## B. Security

| ID | Criterion |
|---|---|
| S1 | Frozen 12 public projection columns unchanged (unless owner explicitly breaks freeze) |
| S2 | `game_user_id` absent from public RPCs, directory HTML data props, Share inputs |
| S3 | Evidence download IDOR tests pass (cross-user deny) |
| S4 | Non-super-admin cannot approve/reject |
| S5 | Self-approval denied |
| S6 | Direct table status updates denied for authenticated |
| S7 | Signed URLs expire; not embedded in public HTML |
| S8 | MIME/size enforcement rejects hostile uploads |
| S9 | Approval cleared on BGMI ID change and on withdraw |
| S10 | Service role never exposed to client |
| S11 | Team captain cannot read members’ evidence or BGMI IDs |
| S12 | Audit events exist for review decisions |

## C. UX / copy

| ID | Criterion |
|---|---|
| U1 | No “official BGMI verification” / Krafton endorsement language |
| U2 | Completeness ≠ verified in all owner-facing copy |
| U3 | Private ID field labeled as private / not shown publicly |
| U4 | Rejection messaging does not leak other users’ data |
| U5 | Mobile-usable settings + evidence upload (44px targets) |
| U6 | WCAG AA contrast on new forms |

## D. Operational

| ID | Criterion |
|---|---|
| O1 | Migrations reversible or paired with down/rollback notes |
| O2 | No LMS project usage |
| O3 | Types regenerated for new tables when implemented |
| O4 | Playwright coverage for enable-discoverability gate + evidence deny paths |
