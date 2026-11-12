# Activation migration proposal (DRAFT — NOT A MIGRATION FILE, NOT APPLIED)

Reserved filename (do NOT create until all apply-gates pass):
`supabase/migrations/20261113000004_p12_activation.sql`.

This doc contains the exact proposed DDL. It is kept in the doc — not in
`supabase/migrations/` — because P12 must not implement anything: a file in
that directory could be picked up by `supabase db push` and applied by
mistake. The file is created (verbatim from §2–§4 below) only after the
apply-gates in §0 pass.

## §0 Apply-gates (all must hold before the file is even created)

1. Owner approvals recorded in `owner-approval-record.md` for D-04 (authority),
   D-11 (provisioning power), D-12 (strict default), D-06 (replay + application).
2. D-05 if verification activation is included (publication alone needs D-04 only).
3. Static review of this exact text (see `clause-by-clause-security-review.md`).
4. Authorized disposable replay green for G1 → P9 → P11 → this file, with the
   isolated-identity RLS matrix from P10 §7.

## §1 F-01 — no clause (already complete)

The P11 trust-guard trigger is authority-complete: once `platform_admins`
has rows, moderators can transition `trust_state` and everyone else cannot.
No activation clause needed; none added.

## §2 F-03 bootstrap — `provision_organizer` (proposed DDL)

```sql
-- P12 activation §2 (PROPOSAL ONLY — DO NOT APPLY).
-- Audited admin provisioning. Authority = caller's is_super_admin() status;
-- the supplied owner id is a validated pointer, never authority.

create or replace function public.provision_organizer(
  p_slug text,
  p_name text,
  p_region_code text,
  p_organizer_type text,
  p_game_keys text[],
  p_owner uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (not public.is_super_admin()) then
    raise exception 'organizer provisioning requires moderator authority';
  end if;
  if (p_slug is null or lower(trim(both from p_slug)) !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      or char_length(p_slug) not between 2 and 80) then
    raise exception 'invalid organizer slug';
  end if;
  if (p_name is null or char_length(trim(both from p_name)) not between 2 and 80) then
    raise exception 'invalid organizer name';
  end if;
  if (p_region_code is null or char_length(p_region_code) = 0
      or p_organizer_type is null
      or p_organizer_type not in ('independent', 'organization', 'professional')) then
    raise exception 'invalid organizer classification';
  end if;
  if (p_game_keys is null or array_length(p_game_keys, 1) is null
      or array_length(p_game_keys, 1) > 8) then
    raise exception 'invalid game keys';
  end if;
  if (p_owner is null
      or not exists (select 1 from public.app_users where id = p_owner and status = 'active')) then
    raise exception 'provisioning target must be an active account';
  end if;
  if (exists (select 1 from public.organizers where slug = lower(trim(both from p_slug)))) then
    raise exception 'organizer slug already provisioned';
  end if;
  insert into public.organizers (slug, name, region_code, organizer_type, game_keys, created_by)
  values (lower(trim(both from p_slug)), trim(both from p_name), p_region_code, p_organizer_type, p_game_keys, p_owner)
  returning id into v_id;
  insert into public.organizer_members (organizer_id, user_id, role)
  values (v_id, p_owner, 'owner');
  insert into public.admin_audit_logs (actor_user_id, action, target_type, target_id, after_state)
  values (auth.uid(), 'organizer.provision', 'organizer', v_id,
    jsonb_build_object('slug', lower(trim(both from p_slug)), 'owner_user_id', p_owner));
  return v_id;
end;
$$;

comment on function public.provision_organizer(text, text, text, text, text[], uuid) is
  'P12 activation: audited admin organizer provisioning. In-body is_super_admin check; no table grants; audit row in the same transaction.';

revoke all on function public.provision_organizer(text, text, text, text, text[], uuid) from public;
grant execute on function public.provision_organizer(text, text, text, text, text[], uuid) to authenticated;
```

Notes: `trust_state` defaults to `not_submitted` and the F-01 INSERT branch
passes (no pre-confirmation); the owner-immutability trigger permits exactly
the first owner row; `admin_audit_logs.action` admits `organizer.provision`
(`^[a-z_]+\.[a-z_]+$`).

## §3 Queue policies (proposed DDL — moderator authority required)

```sql
-- P12 activation §3 (PROPOSAL ONLY — DO NOT APPLY).

-- Reports: reporters (active accounts) may file exactly an open, unattributed
-- report as themselves. No reporter update path (no status gaming, no edits).
create policy "moderation_reports reporter insert"
on public.moderation_reports for insert to authenticated
with check (
  reporter_id = auth.uid()
  and status = 'open'
  and resolution is null and reason is null and reviewer_id is null and decided_at is null
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

create policy "moderation_reports moderator select"
on public.moderation_reports for select to authenticated
using (public.is_super_admin());

create policy "moderation_reports moderator update"
on public.moderation_reports for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Verification cases: owner/admin may open exactly a fresh submission for
-- their own organizer as themselves. Review is moderator-only.
create policy "verification_cases owner insert"
on public.verification_cases for insert to authenticated
with check (
  submitted_by = auth.uid()
  and status = 'submitted'
  and reviewer_id is null and decided_at is null
  and exists (
    select 1 from public.organizer_members m
    where m.organizer_id = verification_cases.organizer_id
      and m.user_id = auth.uid() and m.role in ('owner', 'admin')
  )
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

create policy "verification_cases moderator select"
on public.verification_cases for select to authenticated
using (public.is_super_admin());

create policy "verification_cases moderator update"
on public.verification_cases for update to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

-- Decisions: moderators insert as themselves; moderators read all; organizer
-- members read decisions for their own organizer's tournaments (reasons
-- visible to the affected organizer, reviewer identity stays in the row but
-- is never rendered to organizers by the app boundary).
create policy "moderation_decisions moderator insert"
on public.moderation_decisions for insert to authenticated
with check (
  public.is_super_admin()
  and reviewer_id = auth.uid()
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

create policy "moderation_decisions moderator select"
on public.moderation_decisions for select to authenticated
using (public.is_super_admin());

create policy "moderation_decisions member select"
on public.moderation_decisions for select to authenticated
using (
  exists (
    select 1 from public.tournaments t
    join public.organizer_members m on m.organizer_id = t.organizer_id
    where t.id = moderation_decisions.tournament_id and m.user_id = auth.uid()
  )
);
```

No DELETE policy on any queue table. No reporter update policy. No policy on
`organizer_members` (the no-direct-insert posture is preserved: membership
writes happen only inside `provision_organizer`).

## §4 Lifecycle activation — moderator-gated transitions (proposed DDL)

```sql
-- P12 activation §4 (PROPOSAL ONLY — DO NOT APPLY).
-- Replaces public.enforce_tournament_lifecycle() (P9 file 06) with moderator
-- branches gated on is_super_admin(). CREATE OR REPLACE keeps the existing
-- triggers bound (same function name). Adds security invoker + empty search
-- path (P11 hardening convention). F-02 freeze trigger untouched.

create or replace function public.enforce_tournament_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (TG_OP = 'UPDATE') then
    if (NEW.slug is distinct from OLD.slug) then
      raise exception 'tournaments.slug is immutable';
    end if;
    if (NEW.game_key is distinct from OLD.game_key) then
      raise exception 'tournaments.game_key is immutable';
    end if;
    if (NEW.organizer_id is distinct from OLD.organizer_id) then
      raise exception 'tournaments.organizer_id is immutable: create a new listing instead';
    end if;
    if (NEW.created_by is distinct from OLD.created_by) then
      raise exception 'tournaments.created_by is immutable';
    end if;
  end if;

  if (NEW.lifecycle not in ('draft', 'submitted', 'published', 'unpublished', 'archived')) then
    raise exception 'unknown tournament lifecycle %', NEW.lifecycle;
  end if;

  if (TG_OP = 'INSERT') then
    if (NEW.lifecycle <> 'draft') then
      raise exception 'tournaments must be created as drafts';
    end if;
    return NEW;
  end if;

  if (NEW.lifecycle = OLD.lifecycle) then
    return NEW;
  end if;

  if (OLD.lifecycle = 'draft' and NEW.lifecycle = 'submitted') then
    return NEW;
  end if;
  if (OLD.lifecycle = 'published' and NEW.lifecycle = 'unpublished') then
    return NEW;
  end if;

  -- Moderator-reserved transitions: permitted ONLY for platform admins.
  -- Ordinary members, anonymous callers, and suspended accounts raise here.
  if (OLD.lifecycle = 'submitted' and NEW.lifecycle = 'published') then
    if (public.is_super_admin()) then return NEW; end if;
    raise exception 'publishing a submitted tournament requires approved moderator authority';
  end if;
  if (OLD.lifecycle = 'submitted' and NEW.lifecycle = 'draft') then
    if (public.is_super_admin()) then return NEW; end if;
    raise exception 'returning a submission requires approved moderator authority';
  end if;
  if (OLD.lifecycle = 'unpublished' and NEW.lifecycle = 'published') then
    if (public.is_super_admin()) then return NEW; end if;
    raise exception 're-publication requires approved moderator authority';
  end if;
  if (NEW.lifecycle = 'archived') then
    if (public.is_super_admin()) then return NEW; end if;
    raise exception 'archival requires an approved retention rule and moderator authority';
  end if;

  raise exception 'tournament lifecycle transition % → % is not permitted', OLD.lifecycle, NEW.lifecycle;
end;
$$;
```

Restore path: re-applying the P9 file-06 `CREATE OR REPLACE` body restores
the fully-blocked posture (kept verbatim in `20261112000006_p9_tournament_link.sql`).

## §5 Explicitly excluded (the file must not contain)

Unrestricted organizer/member creation grants or policies; any
`trust_state`-setting path outside `is_super_admin()`; any
draft→published path for non-moderators; any narrowing of the F-02 freeze
list; any public/anonymous queue access; any cross-organizer write policy;
any evidence column, bucket, or upload; any service-role usage; any P3
reader recreation; any G1–P9 object modification outside the §4 function
replacement.
