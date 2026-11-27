# 09 — Open Decisions and Risks

## Owner decisions (block or shape 3B)

| ID | Decision | Recommendation | Impact if deferred |
|---|---|---|---|
| D1 | Keep PDF in bucket allowlist vs tighten MIME for `private-verification` | App-reject PDF now; tighten bucket in a later authorized migration | Low if app enforces |
| D2 | Allow evidence replace while `pending_review` vs freeze until withdraw | Allow replace with audit + bump `updated_at` **or** freeze — pick one | Threat T14 |
| D3 | Auto-withdraw / flag when live `game_user_id` ≠ snapshot | Flag for reviewer; optional auto-withdraw | Reviewer error risk |
| D4 | Delete Storage objects on withdraw vs short forensic TTL | Delete-on-withdraw for privacy | Retention vs privacy |
| D5 | Account-deletion cascade path confirmation | Hard-delete cases + objects with auth user | Orphans / GDPR gap |
| D6 | Require re-encode before `pending_review` (CPU cost) | **Yes** essential | Security residual if skipped |
| D7 | Draft state exposed in UI vs single-shot submit | Single-shot submit simpler for v1 | UX complexity |
| D8 | Signed URL TTL (60 vs 300s) | 120s default | Leak window |

## Assumptions (not fully verified externally)

- Esports linked project remains `knniommcyyhbyiwljisk` for all 3B work.
- `is_super_admin()` and `platform_admins` remain the reviewer gate for M2B.4.
- No other product already stores PII in `private-verification` under conflicting path schemes (objects not inventoried for privacy).
- Avatar “MIME-only” gap will not be copied into evidence upload code.

## Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Implementer copies avatar validator without magic bytes | High | 3B must use new hardened module; security tests |
| Owner DELETE bait-and-switch while pending | Medium | D2 policy + tests |
| Service role used for all Storage ops “for convenience” | High | Prefer user JWT for owner; document mint-only service role |
| Accidental public projection of verification fields | High | Freeze 12-field rule; PR checklist |
| Applying migration to wrong Supabase project | Critical | Linked ref check; never LMS |
| Scope creep into approve/reject in 3B | Medium | Hard stop: 3A/3B/3C exclude decisions |

## Explicitly out of M2B.3A

- Code, migrations, Storage policy edits, production config.
- Discord.
- Public badge grant.
- Reviewer console.
