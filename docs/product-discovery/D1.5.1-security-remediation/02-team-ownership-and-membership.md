# 02 — Team Ownership & Membership (F-T01 / F-T03 / F-T04)

## Design

Two independent enforcement layers, both product-neutral:

1. **Privilege layer (grants):** `M3 §D` revokes table-wide UPDATE on `teams`
   and re-grants only the eight app-editable columns
   (`name, description, current_level, target_level, recruiting, is_public,
   region_code, updated_at`). Protected: `id, owner_user_id, created_by,
   game_key, slug, organization_id, created_at`. Direct `team_members` INSERT
   is revoked entirely (`M3 §F`).
2. **Integrity layer (triggers):** `enforce_teams_immutable_columns()` rejects
   any UPDATE touching a protected column, even if grants widen later
   (`M3 §D`). RLS row gates (`owner/creator/member`, captain + active) are
   unchanged — they decide *which rows*, grants/triggers decide *which columns*.

No ownership-transfer feature exists after this change: the write path is
blocked, not redirected. `organization_id` gains no authority (still in no RLS
expression; still inert).

## Why denial for membership creation (F-T04)

Any PostgREST-writable insert rule expressible today either allows arbitrary
injection (captain-gated) or rogue self-joins (self-gated). Both invent consent
semantics without approval, so both are refused per the stop condition. The
dropped policy + revoked grant make direct inserts fail closed; the table
comment records the placeholder: a future DEFINER RPC
(invite-accept or application-accept) after the owner approves the flow.

## Active-account consistency (F-T03)

Recreated with the standard inline guard (same expression G1 uses):
`team_members` update/delete, `recruitment_posts` insert/update/delete.
Reads intentionally unchanged (G1 parity: suspended users keep read access).

## Files

- SQL: `supabase/migrations/20261112000003_d1_security_remediation.sql` §§D,F,G.
- Tests: `src/features/teams/tests/team-security-boundary.test.ts`
  ("F-T01", "F-T03", "F-T04" blocks).
