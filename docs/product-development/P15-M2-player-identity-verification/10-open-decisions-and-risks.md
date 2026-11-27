# 10 — Open Decisions & Risks

Items requiring **owner approval** before or during M2B. Distinguishes assumptions from verified facts.

## Open decisions (need approval)

| ID | Question | Recommendation | Impact if delayed |
|---|---|---|---|
| D1 | Does **directory-eligible** completeness (IGN+role+region+modes+private BGMI ID) replace D-G1-08 or sit as a stricter discoverability-only gate? | **Resolved for M2B.1:** use D-G1-08 only (no invented mandatory fields; BGMI ID deferred to M2B.2). Stricter set remains a future product decision. | M2B.1 shipped on D-G1-08 |
| D2 | Auto-disable discoverability when required fields cleared, vs reject edits while discoverable? | Auto-disable + audit | Affects update RPCs |
| D3 | Remediation for any already-discoverable incomplete profiles when gate ships? | Pre-flight SQL report; force-off with notice | Data cleanup |
| D4 | Exact BGMI Player ID format (digits-only vs free 4–32)? | Keep 4–32 until confirmed; no invented official regex | Validation UX |
| D5 | Frozen availability vocabulary list? | Confirm catalog; Zod currently shape-only | Edit UI |
| D6 | Public badge channel: separate DEFINER boolean vs break 12-field freeze? | **Separate DEFINER** — do not break freeze | M2B.4/M2B.6 |
| D7 | May owners see full internal reject reasons? | Safe owner summary; full text reviewer-only | UX + privacy |
| D8 | Evidence retention days after reject/withdraw | 30-day delete job unless legal hold | Storage cost |
| D9 | Allow PDF evidence or images-only? | Images-only for player ownership | MIME policy |
| D10 | Reviewer principal: super-admin only vs new role? | Super-admin only for M2 | M2B.4 scope |
| D11 | Ship Discord in first train? | **Defer** | Avoids Auth dashboard coupling |
| D12 | Should `primary_role` null (“flexible”) remain allowed for directory eligibility? | Require explicit role for eligibility | Completeness rules |

## Assumptions (Proposed, not verified externally)

| A1 | BGMI character ID is adequately represented by existing `game_user_id` text 4–32. |
| A2 | One–two screenshots can show IGN + ID for manual review without third-party KYC. |
| A3 | `platform_admins` population is small and ops-managed. |
| A4 | Production Auth remains email/password for M2B.1–4. |

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Completeness gate surprises existing discoverable users | Medium | D3 remediation + release notes |
| Reviewer bottleneck / fake screenshots | Medium | Clear reject reasons; resubmit limits; no official claim copy |
| Service-role misuse in signed URL helpers | High | Centralize mint; requireSuperAdmin; tests |
| Accidental freeze break adding ID to RPCs | High | Key-set regression tests as CI gate |
| Stale badge via caching | Medium | force-dynamic / tag invalidation |
| Discord scope creep blocking verification | Medium | Defer Discord (D11) |
| Private-verification owner DELETE after approval tampers history | Medium | Withdraw RPC controls delete; optional policy tighten |
| Unwired `record_admin_audit` RPC gap | Medium | Ship event table or finish audit writer in M2B.4 |

## Explicit non-goals (reconfirmed)

- Official BGMI / Krafton verification claims
- Discord as required step
- Team roster identity cards in M2
- LMS Supabase access
- Applying migrations during M2A
