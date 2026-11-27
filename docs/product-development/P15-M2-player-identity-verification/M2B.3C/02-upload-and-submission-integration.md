# 02 — Upload and Submission Integration

## Actions (`settings/profile/actions.ts`)

| Action | Backend |
|---|---|
| `createBgmiOwnershipDraftAction` | `createBgmiOwnershipDraftCase` |
| `uploadBgmiOwnershipEvidenceAction` | `uploadBgmiOwnershipEvidence` (sharp sanitize) |
| `submitBgmiOwnershipCaseAction` | `submit_player_bgmi_ownership_case` RPC |
| `withdrawBgmiOwnershipCaseAction` | `withdrawBgmiOwnershipCase` |
| `mintBgmiOwnershipPreviewUrlAction` | 60s signed URL after owner authz |

## Guarantees

- Session-derived identity only
- No client-supplied `claimed_game_user_id`
- No client status writes (RPC + RLS)
- Client MIME checks are UX-only
- Partial upload failures cleaned by M2B.3B compensation
- Signed URL query strings not logged
