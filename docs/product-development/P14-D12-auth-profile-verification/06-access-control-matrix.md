# 06 — Access Control Matrix (P14-D12)

Application helpers: `src/features/player-profile/domain/access-policy.ts`.
Database RPCs/RLS remain authoritative.

| Capability | Anonymous | `not_started` | `incomplete` | `complete` | Future `verified` |
|---|---|---|---|---|---|
| Browse public content | Yes | Yes | Yes | Yes | Yes |
| Sign up / log in | Yes | — | — | — | — |
| Complete own profile | — | Yes | Yes | Edit via settings | Edit |
| Opt into discoverability | — | No (need profile) | Soft yes* | Soft yes* | Soft yes* |
| Create team (UI soft gate) | No | Blocked → onboarding | Blocked → onboarding | Allowed in UI | Allowed |
| Create team (DB `create_team`) | No | Hard gate: active + `email_confirmed_at` | Same | Same | Same |
| Claim “verified” identity | No | No | No | **No** | Only after admin review |
| Frozen 12-col projection | Read via RPCs | Unchanged | Unchanged | Unchanged | Still no verification fields |

\* Discoverability remains an explicit owner consent toggle
(`set_player_discoverability`). It is **not** a verification badge.
D-G1-10 email-confirmation enforcement on discoverability remains a separate
approved follow-up and was **not** applied in this task (no migration).

## Security boundaries preserved

- Teams mutation RPCs / grants unchanged.
- No RLS weakening.
- Soft UI gate on `/teams/new` does not replace RPC checks.
- Write switches unchanged (`WORKSPACE_WRITES_ENABLED=true`; others false).
