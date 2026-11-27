# 02 — Approved Owner Decisions (P14-D2)

**Status:** A1–A6 are **APPROVED** by explicit owner instruction in the P14-D2 brief.  
**Rule:** Do not reinterpret or expand these decisions.

---

## Lock record

| ID | Title | APPROVED wording (verbatim intent) | Implementation consequence |
| --- | --- | --- | --- |
| **A1** | Captain permissions | Owner and captain may edit team profile/settings. Only owner may manage leadership. Co-captain has no administrative privileges initially. | `update_team_settings` authZ = owner **or** active `role=captain`. No co-captain admin. Leadership appoint/revoke RPCs deferred (owner-only when later built). |
| **A2** | Ownership transfer | Deferred. Owners cannot abandon their team or remove themselves in a way that leaves the team without an owner. | No transfer RPC in P14-D3. Deny owner self-removal / leave that would orphan `owner_user_id`. `owner_user_id` remains RESTRICT + immutable on direct UPDATE. |
| **A3** | Roster privacy | Public team profiles expose aggregate roster counts only. Individual identities are visible only to authorized team members in the private workspace. | Public RPCs: `member_count` only. Workspace roster SELECT for owner/active members of that team. No public handles/user ids. |
| **A4** | Initial captain membership | Team creation atomically creates an active captain membership for the owner. `teams.owner_user_id` remains authoritative. | `create_team` transaction: insert team + insert `team_members` (`role=captain`, `membership_status=active`, `user_id=auth.uid()`). Authority for ownership checks uses `owner_user_id`, not the roster row alone. |
| **A5** | Verified email | Team creation requires an active account and verified email. | `create_team` requires `app_users.status=active` and `auth.users.email_confirmed_at IS NOT NULL` for `auth.uid()`. |
| **A6** | Migration strategy | Supersede unapplied historical D1 migrations with a clean P14 Teams migration set. | D1 teams files `02`/`03`/`04` archived out of `supabase/migrations/`. New P14 Teams SQL authored in P14-D3. |

---

## Explicitly not approved by this lock

- Ownership transfer workflow (deferred by A2).  
- Leadership appoint/revoke UI/RPC (A1 allows owner-only management later; not in foundation write set).  
- Recruitment / applications / invitations.  
- Public roster identities.  
- Expanding co-captain privileges.  
- B-series / C-series product options beyond what A1–A6 imply.

---

## Freeze note for P14-D3

Schema and RPCs in `04-schema-and-rpc-contract.md` implement **only** this lock plus the P14-D1 minimum table set already aligned with A6.
