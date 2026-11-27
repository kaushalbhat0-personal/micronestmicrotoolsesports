-- P15-M2B.4 hotfix: decide RPC used bare decision_id variable which collided
-- with player_bgmi_ownership_cases.decision_id ("column reference is ambiguous").
-- Replace function body only. Esports knniommcyyhbyiwljisk only.

create or replace function public.decide_player_bgmi_ownership_case(
  p_case_id uuid,
  p_decision text,
  p_internal_reason text,
  p_player_facing_message text default null
)
returns public.player_bgmi_ownership_cases
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  live_id text;
  ev_count integer;
  case_row public.player_bgmi_ownership_cases;
  v_decision_id uuid;
  reason_clean text;
  facing_clean text;
  audit_action text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_super_admin() then
    raise exception 'forbidden';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision';
  end if;

  reason_clean := btrim(coalesce(p_internal_reason, ''));
  if char_length(reason_clean) < 5 or char_length(reason_clean) > 500 then
    raise exception 'internal reason invalid';
  end if;

  if p_decision = 'rejected' then
    facing_clean := btrim(coalesce(p_player_facing_message, ''));
    if char_length(facing_clean) < 5 or char_length(facing_clean) > 280 then
      raise exception 'player facing message required';
    end if;
  else
    facing_clean := null;
  end if;

  select * into case_row
  from public.player_bgmi_ownership_cases c
  where c.id = p_case_id
  for update;

  if case_row.id is null then
    raise exception 'case not found';
  end if;

  if case_row.player_id = uid then
    raise exception 'cannot review own case';
  end if;

  if case_row.status <> 'pending_review' then
    raise exception 'case not pending';
  end if;

  if case_row.identity_mismatch or case_row.claimed_game_user_id is null then
    raise exception 'case not eligible';
  end if;

  select count(*)::integer into ev_count
  from public.player_bgmi_ownership_evidence e
  where e.case_id = p_case_id and e.player_id = case_row.player_id;

  if ev_count < 1 or ev_count > 2 then
    raise exception 'evidence count invalid';
  end if;

  if p_decision = 'approved' then
    select pgp.game_user_id into live_id
    from public.player_game_profiles pgp
    where pgp.player_user_id = case_row.player_id
      and pgp.game_key = 'bgmi';

    if live_id is null or live_id is distinct from case_row.claimed_game_user_id then
      raise exception 'identity mismatch';
    end if;
  end if;

  insert into public.player_bgmi_ownership_decisions (
    case_id,
    player_id,
    reviewer_id,
    decision,
    internal_reason,
    player_facing_message
  ) values (
    p_case_id,
    case_row.player_id,
    uid,
    p_decision,
    reason_clean,
    facing_clean
  )
  returning id into v_decision_id;

  perform set_config('micronest.bgmi_ownership_allow_decide', '1', true);

  update public.player_bgmi_ownership_cases c
    set status = p_decision,
        decision_id = v_decision_id,
        decided_at = now(),
        player_facing_message = facing_clean,
        identity_mismatch = false
    where c.id = p_case_id
      and c.status = 'pending_review'
    returning * into case_row;

  if case_row.id is null then
    raise exception 'concurrent decision conflict';
  end if;

  audit_action := case
    when p_decision = 'approved' then 'bgmi_ownership.approve'
    else 'bgmi_ownership.reject'
  end;

  insert into public.admin_audit_logs (
    actor_user_id,
    action,
    target_type,
    target_id,
    reason,
    after_state
  ) values (
    uid,
    audit_action,
    'bgmi_ownership_case',
    p_case_id,
    reason_clean,
    jsonb_build_object(
      'decision', p_decision,
      'player_id', case_row.player_id,
      'decision_id', v_decision_id,
      'evidence_count', ev_count
    )
  );

  return case_row;
end;
$$;

comment on function public.decide_player_bgmi_ownership_case(uuid, text, text, text) is
  'P15-M2B.4: super-admin approve/reject with row lock, self-review ban, identity match on approve, atomic admin_audit_logs insert.';
