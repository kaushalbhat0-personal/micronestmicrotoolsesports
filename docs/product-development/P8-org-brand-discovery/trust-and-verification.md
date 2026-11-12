# P8 trust and verification

## States

`not_submitted | submitted | under_review | confirmed | rejected | expired`.

- `not_submitted` — no verification request exists.
- `submitted` — information was submitted, not reviewed.
- `under_review` — review in progress, not confirmed.
- `confirmed` — MicroNest review confirmed (only confirming state).
- `rejected` — reviewed, not confirmed.
- `expired` — prior confirmation lapsed.

## Presentation rules (enforced in components + tests)

- Only `confirmed` renders a confirmation indicator (`Confirmed` badge).
- Every other state renders neutral `Unverified` + the exact state label and
  note (e.g. “Submitted — not yet reviewed. This information was submitted
  and has not been reviewed.”).
- Submitted is never styled, worded, or positioned as confirmed.
- Brand pages additionally state: “This profile does not prove that any
  viewer represents this brand.”
- No verification badges are fabricated; `representative_verified` is frozen
  `false` in the brand detail contract.

## Brand representative verification (designed, disabled)

- A brand profile ≠ authority of the viewer.
- A website domain alone is insufficient proof (no approved policy defines
  domain-proof; phishing/subdomain risks unaddressed).
- No self-approved confirmation: no self-serve “claim → auto-confirm” path.
- No private evidence exposure: evidence fields are not in any projection;
  no upload surface exists.
- Privileged transitions (verify/approve/reject, evidence handling) stay
  disabled until authorization + evidence-handling + retention rules are
  approved. The readers cannot write; no writer module exists.

## What P8 implements

Safe public presentation + domain validation (Zod vocabularies, https URL
fail-closed, strict key-sets). All privileged verification actions remain
disabled with `*WriteDisabledError` gates and no route/RPC surface.
