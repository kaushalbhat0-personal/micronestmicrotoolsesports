# F-03 founding-owner bootstrap authorization

## Model: admin-provisioned organizer (recommended, not approved, not built)

Only a platform admin may create an organizer and its founding owner row,
through one audited database function. There is no public endpoint, no
claim token, no INSERT policy, and no INSERT grant that any authenticated
role can use directly.

## Authorization design

- **Who may provision:** callers satisfying `public.is_super_admin()`
  (platform_admins membership AND active `app_users` row), checked
  **inside** the function body. The EXECUTE grant is deliberately broad
  (`authenticated`) so the check — not the grant — is the authority; a
  leaked grant grants nothing.
- **Target-user identification:** the admin supplies the approved owner's
  identifier (user id); the function verifies it resolves to an **active**
  `app_users` row at call time. Suspended, missing, or anonymous identities
  abort the call. The caller-supplied value is treated as an **untrusted
  pointer**, never as authority: authority comes solely from the caller's
  own `is_super_admin()` status.
- **Ownership binding:** the function inserts `organizers.created_by =
  owner_id` and the single `organizer_members` owner row
  `(organizer_id, owner_id, 'owner')` in the same transaction. The P9
  immutability triggers (slug/`created_by`, owner-row freeze, no second
  owner) apply to these rows exactly as to any other — provisioning cannot
  mint transferable or multi-owner structures.
- **Duplicate prevention:** the unique `slug` and the owner-immutability
  trigger reject double-provisioning naturally (second owner insert raises);
  the function additionally checks for an existing organizer with the same
  slug and raises a clean error before writing. Replay of the same call is
  therefore safe: at most one organizer and one owner row can ever result,
  and repeats fail closed.
- **Audit:** the function inserts one `admin_audit_logs` row
  (`actor_user_id` = caller from `auth.uid()`, `action` =
  `'organizer.provision'`, `target_type = 'organizer'`, `target_id` = new
  organizer id, `after_state` = `{slug, owner_user_id}`) in the same
  transaction — provisioning without an audit row is unrepresentable.
  (`admin_audit_logs` action format `^[a-z_]+\.[a-z_]+$` admits
  `organizer.provision`.)
- **Failures:** any validation failure (unknown/suspended owner, duplicate
  slug, bad input shape) raises before any write; the transaction rolls
  back atomically — no partial organizer, no orphan owner row, no audit row
  without its organizer.
- **Recovery:** mistaken provisioning is corrected by a future transfer
  workflow (out of scope) or not at all in v1; the organizer can always be
  hidden (`is_public = false` by an owner/admin) and the audit row explains
  who did what. Admin compromise is contained by platform_admins membership
  controls (see `moderator-governance.md`).
- **Revocation/transfer:** no transfer path exists in v1 by design. Ownership
  transfer requires its own future decision + workflow; until then the only
  safe revocation is admin removal of a bad actor's *access* (suspend the
  `app_users` row — RLS active-checks fail closed everywhere), never
  rewriting ownership history.

## Proposed database design (exact; doc-contained, NOT a migration file)

```sql
-- PROPOSAL ONLY — DO NOT APPLY. Full DDL lives in
-- activation-migration-proposal.md §2. Shape summary:
-- public.provision_organizer(p_slug, p_name, p_region, p_type, p_games, p_owner)
--   RETURNS uuid
--   LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
--   Body: require is_super_admin(); validate slug/type/region/games;
--   require p_owner -> active app_users; duplicate-slug check;
--   INSERT organizers (created_by = p_owner) + owner member row +
--   admin_audit_logs row; RETURN organizer id.
-- Grants: REVOKE ALL ON FUNCTION ... FROM PUBLIC; GRANT EXECUTE TO authenticated.
-- No table GRANT. No RLS policy. RLS bypass happens only inside the
-- function, after the authority check, in one transaction.
```

## Hard prohibitions (pinned by test)

- No unrestricted INSERT grant on `organizers` or `organizer_members`.
- No public self-claim path (no claim endpoint, token, or open policy).
- No caller-supplied owner identity trusted as authority (session-derived
  caller check is the only authority; the supplied id is a validated pointer).
- No service-role shortcut (DEFINER function with in-body check, not a
  privileged client).
