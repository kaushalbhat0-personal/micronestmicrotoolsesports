-- P13-A activation migration (approved scope only).
--
-- Status: LOCAL PROPOSAL ONLY — NOT applied remotely. Owner approvals D-01,
-- D-04, D-06, D-07, D-08, D-11, D-12, D-13, D-14 recorded 2026-11-12 in
-- docs/product-development/P12-owner-authorization/owner-approval-record.md.
--
-- Scope (approved only):
--   §2 provision_organizer (D-11) — audited admin provisioning.
--   §3 queue policies for reports + decisions (D-04/D-07) — reporter insert,
--       moderator select/update, decision insert/select, member decision
--       visibility. verification_cases gets NO policies: D-05 is DEFERRED,
--       so the verification workflow stays inert.
--   §4 lifecycle replacement (D-04/D-07/D-12) — moderator-gated transitions
--       with F-02 reviewed-snapshot enforcement (version bump on submit,
--       validator on every privileged transition).
--
-- Explicitly EXCLUDED (deferred decisions): D-05 verification activation and
-- case policies; D-02 organization linkage; D-09 media/evidence; D-10 filter;
-- any table GRANT to API roles; any P3 reader change; any F-02 weakening.
-- The three write switches are application constants and stay OFF — no
-- migration flips them.
--
-- Dependencies (apply order): G1 -> D1 -> P9 (05,06) -> P11 (01,02,03) ->
-- P13-A 04 (snapshot support) -> this file. Additive only: the single
-- replacement is public.enforce_tournament_lifecycle (rollback = re-apply
-- P9 file 06 body verbatim); everything else is new objects.
--
-- Rollback: drop the §3 policies; drop provision_organizer; re-apply the P9
-- file-06 lifecycle body. Snapshot columns/functions (file 04) roll back
-- separately per that file's notes.

-- §2 Provisioning (D-11) -------------------------------------------------------
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
  'P13-A D-11: audited admin organizer provisioning. In-body is_super_admin check; owner id is a validated pointer, never authority; audit row in the same transaction.';

revoke all on function public.provision_organizer(text, text, text, text, text[], uuid) from public;
grant execute on function public.provision_organizer(text, text, text, text, text[], uuid) to authenticated;

-- §3 Queue policies — reports + decisions only (D-04/D-07; D-05 deferred) -----
-- Reporters (active accounts) file exactly an open, unattributed report as
-- themselves. No reporter UPDATE/DELETE: filed reports are immutable to
-- reporters (no status gaming, no edits).
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

-- Decisions: moderators insert as themselves (reviewer_id forced to the
-- session — forged reviewer identity is unrepresentable); moderators read
-- all; organizer members read decisions for their own organizer's
-- tournaments (reasons visible to the affected organizer; reviewer identity
-- is never rendered to organizers by the app boundary). No DELETE anywhere.
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

-- §4 Lifecycle replacement with reviewed-snapshot enforcement ------------------
-- Replaces P9 file-06 enforce_tournament_lifecycle. Identical for all
-- non-privileged paths (same messages, same fall-through raise). Moderator
-- branches now permit is_super_admin() callers AND require a version-bound
-- decision; publish/republish additionally require the exact snapshot hash.
-- draft->submitted bumps submission_version (trigger overwrites any caller
-- value — members cannot forge versions).
create or replace function public.enforce_tournament_lifecycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_hash text;
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
    NEW.submission_version := OLD.submission_version + 1;
    return NEW;
  end if;
  if (OLD.lifecycle = 'published' and NEW.lifecycle = 'unpublished') then
    -- P9 behavior preserved exactly: organizer-reachable unpublish needs no
    -- decision row (row-level membership is enforced by RLS). Moderator
    -- unpublish likewise needs no decision; archival always does (below).
    return NEW;
  end if;

  -- Moderator-reserved transitions: authority + version-bound decision, with
  -- snapshot-hash equality for publish/republish (content reviewed = content
  -- published). Stale, concurrent-edit, self-review, and inactive-reviewer
  -- approvals all fail inside the validator.
  if (OLD.lifecycle = 'submitted' and NEW.lifecycle = 'published') then
    if (not public.is_super_admin()) then
      raise exception 'publishing a submitted tournament requires approved moderator authority';
    end if;
    v_hash := public.tournament_content_hash(NEW.title, NEW.game_key, NEW.region_code, NEW.format, NEW.starts_at, NEW.ends_at, NEW.timezone, NEW.entry_fee_minor, NEW.prize_pool_minor, NEW.currency, NEW.description, NEW.organizer_kind, NEW.organizer_name, NEW.organizer_slug, NEW.organizer_id, NEW.registration_url, NEW.contact_instructions, NEW.registration_closes_at, NEW.eligibility);
    if (not public.tournament_review_approval_valid(NEW.id, 'publish', NEW.submission_version, v_hash, NEW.organizer_id)) then
      raise exception 'publishing requires a current reviewed-snapshot approval: content changed after review or no valid approval exists';
    end if;
    return NEW;
  end if;
  if (OLD.lifecycle = 'submitted' and NEW.lifecycle = 'draft') then
    if (not public.is_super_admin()) then
      raise exception 'returning a submission requires approved moderator authority';
    end if;
    if (not public.tournament_review_approval_valid(NEW.id, 'return_to_draft', NEW.submission_version, '', NEW.organizer_id)) then
      raise exception 'returning a submission requires a recorded decision with reason';
    end if;
    return NEW;
  end if;
  if (OLD.lifecycle = 'unpublished' and NEW.lifecycle = 'published') then
    if (not public.is_super_admin()) then
      raise exception 're-publication requires approved moderator authority';
    end if;
    v_hash := public.tournament_content_hash(NEW.title, NEW.game_key, NEW.region_code, NEW.format, NEW.starts_at, NEW.ends_at, NEW.timezone, NEW.entry_fee_minor, NEW.prize_pool_minor, NEW.currency, NEW.description, NEW.organizer_kind, NEW.organizer_name, NEW.organizer_slug, NEW.organizer_id, NEW.registration_url, NEW.contact_instructions, NEW.registration_closes_at, NEW.eligibility);
    if (not public.tournament_review_approval_valid(NEW.id, 'republish', NEW.submission_version, v_hash, NEW.organizer_id)) then
      raise exception 're-publication requires a current reviewed-snapshot approval';
    end if;
    return NEW;
  end if;
  if (NEW.lifecycle = 'archived') then
    if (not public.is_super_admin()) then
      raise exception 'archival requires an approved retention rule and moderator authority';
    end if;
    if (not public.tournament_review_approval_valid(NEW.id, 'archive', NEW.submission_version, '', NEW.organizer_id)) then
      raise exception 'archival requires a recorded decision with reason';
    end if;
    return NEW;
  end if;

  raise exception 'tournament lifecycle transition % → % is not permitted', OLD.lifecycle, NEW.lifecycle;
end;
$$;

comment on function public.enforce_tournament_lifecycle() is
  'P13-A activation: P9 transitions preserved; moderator branches gated on is_super_admin + version-bound decisions; publish/republish additionally hash-bound to the reviewed snapshot; draft->submitted bumps submission_version.';
