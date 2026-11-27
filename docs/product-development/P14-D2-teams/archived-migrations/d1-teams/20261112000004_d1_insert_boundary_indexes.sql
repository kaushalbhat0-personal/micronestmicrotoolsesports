-- MicroNest Esports D1.6.1: F-NEW-01 insert boundary + F-T13 read-path indexes
-- (local only, NOT applied).
--
-- Additive corrective migration after 20261112000003. Existing files
-- (000001/000002/000003) are UNCHANGED. Follows the repo convention of additive
-- correction (cf. 20261111000009 over ...000008).
--
-- F-NEW-01 (D1.5.2 finding, Medium): the M2 applicant-insert policy constrained
-- status/applicant/active but not decision metadata, so an applicant could
-- INSERT with forged decided_by/decided_at on a row whose status is 'applied'.
-- Creation is never a decision: require both null at INSERT. The M3 withdraw
-- trigger already enforces null on UPDATE; this closes the creation half.
-- Captain decisions remain unimplemented (D1-D3/D1-D12 BLOCKED); service-role
-- writes bypass RLS by engine design and stay governed by the app layer.
--
-- F-T13: secondary btree indexes for member/post/application/report lookups.
-- Read-path performance only: no behavior, RLS, grant, or constraint change.
--
-- Explicitly NOT included (BLOCKED, see D1.6.1 docs 06/08): availability
-- GIN/caps (D1-D8), game_key equality trigger (D1-D2/F-T10), organization
-- guards (D1-D4/F-T12), owner-row delete guard (D1-D10/F-T11), report
-- retention change (D1-D9), lifecycle automation (D1-D12), cron CHECKs (F-A07).

-- F-NEW-01: decision metadata null at creation --------------------------------
drop policy if exists "applications applicant insert" on public.applications;

create policy "applications applicant insert"
on public.applications for insert to authenticated
with check (
  applicant_user_id = auth.uid()
  and status = 'applied'
  and decided_by is null
  and decided_at is null
  and exists (select 1 from public.app_users where id = auth.uid() and status = 'active')
);

-- F-T13: read-path indexes ----------------------------------------------------
create index if not exists team_members_user_id_idx
  on public.team_members (user_id);
create index if not exists recruitment_posts_team_id_status_idx
  on public.recruitment_posts (team_id, status);
create index if not exists applications_post_id_idx
  on public.applications (post_id);
create index if not exists applications_applicant_idx
  on public.applications (applicant_user_id);
create index if not exists reports_reporter_idx
  on public.reports (reporter_user_id);
create index if not exists reports_target_idx
  on public.reports (target_type, target_id);
