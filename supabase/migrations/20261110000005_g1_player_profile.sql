-- MicroNest Esports G1-2: canonical player profile (D-G1-09).
--
-- Scope (APPROVED D-G1-09 separate vocabularies; D-G1-01/D-G1-02 reused):
--   1. public.player_profiles canonical table, 1:1 with public.app_users.
--   2. Same-transaction creation via SECURITY INVOKER function
--      public.create_player_profile() (app_users ensure + profile INSERT +
--      re-select in one transaction; INVOKER adds zero privilege).
--   3. RLS: owner SELECT + owner INSERT + owner UPDATE only. No owner DELETE
--      policy (deferred pending D-G1-07), no anonymous access, no public
--      access, no cross-user access.
--   4. Explicit least-privilege grants (no DELETE grant: no DELETE policy).
--
-- Explicitly NOT included (later stages own them):
--   - games, player_game_profiles (G1-3).
--   - Public projection RPCs (G1-4 owns them; D-G1-03).
--   - Avatar upload/storage integration (G1-5; avatar_path plumbing only).
--   - Public routes, search/discovery (G1-6).
--   - Consent toggle action, handle-change throttle, deletion flows (G1-7;
--     D-G1-05/D-G1-07/D-G1-08 stay open).
--   - No SECURITY DEFINER helpers (05 section 6 forbids extra definers in G1).
--   - No modification of previous migrations (additive only).
--
-- Why an INVOKER function for creation (02 section 2-3, 07):
--   Two sequential PostgREST requests cannot share one transaction, so the
--   approved "app-user initialization + profile creation succeed or fail
--   together" cannot be expressed from the client library. This function
--   encapsulates the approved mutation atomically (one RPC = one statement =
--   one transaction). SECURITY INVOKER adds zero privilege: caller RLS
--   policies still apply, identity comes only from auth.uid(), no identity
--   parameter is accepted. The server pre-gate (ensure_app_user) is a
--   read-only status check; the recoverable "onboarding required" row it may
--   leave is the normal intermediate state, not unintended partial state.
--
-- Foreign-key behavior: user_id REFERENCES app_users(id) ON DELETE CASCADE.
--   This is the approved referential action (05 section 2). It does NOT decide
--   D-G1-07 (grace vs hard delete): a future grace window would delay the
--   app_users DELETE, not change the cascade mechanics. No account-deletion
--   workflow is implemented here (no DELETE policy, no DELETE grant).
--
-- Country allowlist (APPROVED D-G1-09): optional ISO 3166-1 alpha-2, never
--   ONLINE. Full 249-code standard list enumerated below (source: ISO 3166-1;
--   cross-checked against the datahub.io country-list mirror which carries the
--   same 249 codes). ONLINE is not an ISO code and char(2) rejects it by
--   length in any case; the Zod boundary also refines it away. Game-region
--   values (e.g. ONLINE as a game server) do NOT belong here (G1-3 owns
--   region_code with its per-game vocabulary). Extend via later migration.

-- 1. Canonical profile ------------------------------------------------------
create table public.player_profiles (
  user_id uuid primary key references public.app_users (id) on delete cascade,
  handle text not null check (handle ~ '^[a-z0-9_]{3,20}$'),
  display_name text not null check (char_length(display_name) between 1 and 40),
  avatar_path text null check (
    avatar_path is null
    or avatar_path ~ '^[0-9a-f-]{36}/avatar\.(png|jpe?g|webp)$'
  ),
  bio text null check (
    bio is null or char_length(bio) <= 280
  ),
  country_code char(2) null check (
    country_code is null or country_code in (
      'AF','AX','AL','DZ','AS','AD','AO','AI','AQ','AG','AR','AM','AW','AU','AT','AZ',
      'BS','BH','BD','BB','BY','BE','BZ','BJ','BM','BT','BO','BQ','BA','BW','BV','BR','IO','BN','BG','BF','BI',
      'CV','KH','CM','CA','KY','CF','TD','CL','CN','CX','CC','CO','KM','CG','CD','CK','CR','CI','HR','CU','CW','CY','CZ',
      'DK','DJ','DM','DO','EC','EG','SV','GQ','ER','EE','SZ','ET',
      'FK','FO','FJ','FI','FR','GF','PF','TF','GA','GM','GE','DE','GH','GI','GR','GL','GD','GP','GU','GT','GG','GN','GW','GY',
      'HT','HM','VA','HN','HK','HU','IS','IN','ID','IR','IQ','IE','IM','IL','IT',
      'JM','JP','JE','JO','KZ','KE','KI','KP','KR','KW','KG',
      'LA','LV','LB','LS','LR','LY','LI','LT','LU',
      'MO','MG','MW','MY','MV','ML','MT','MH','MQ','MR','MU','YT','MX','FM','MD','MC','MN','ME','MS','MA','MZ','MM',
      'NA','NR','NP','NL','NC','NZ','NI','NE','NG','NU','NF','MK','MP','NO','OM',
      'PK','PW','PS','PA','PG','PY','PE','PH','PN','PL','PT','PR','QA',
      'RE','RO','RU','RW',
      'BL','SH','KN','LC','MF','PM','VC','WS','SM','ST','SA','SN','RS','SC','SL','SG','SX','SK','SI','SB','SO','ZA','GS','SS','ES','LK','SD','SR','SJ','SE','CH','SY',
      'TW','TJ','TZ','TH','TL','TG','TK','TO','TT','TN','TR','TM','TC','TV',
      'UG','UA','AE','GB','US','UM','UY','UZ',
      'VU','VE','VN','VG','VI','WF','EH','YE','ZM','ZW'
    )
  ),
  is_discoverable boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.player_profiles is
  'G1-2 canonical player profile: user_id IS app_users(id), one row per user. See docs/architecture/g1-identity-player-profile/03.';
comment on column public.player_profiles.user_id is
  'PK + FK to app_users(id) ON DELETE CASCADE. Equals auth.uid(). Never caller-supplied.';
comment on column public.player_profiles.handle is
  'Stored lowercase, 3-20 a-z0-9_. Case-insensitive uniqueness via lower(handle) index.';
comment on column public.player_profiles.country_code is
  'Optional ISO 3166-1 alpha-2 (D-G1-09). Never ONLINE. Game-region values belong in player_game_profiles.region_code (G1-3).';
comment on column public.player_profiles.is_discoverable is
  'Explicit consent master switch, private by default false. Toggled only via the dedicated consent action (G1-7).';

-- Case-insensitive handle uniqueness enforced by PostgreSQL (03 section 1,
-- 05 section 1): functional unique index, not application validation alone.
create unique index player_profiles_handle_lower_uniq
  on public.player_profiles (lower(handle));

-- Directory prefilter support (05 section 1): partial btree for RPC use.
-- No public reads in G1-2; the RPCs land in G1-4.
create index player_profiles_discoverable_idx
  on public.player_profiles (is_discoverable)
  where is_discoverable = true;

-- Foundation reuse: single canonical updated_at trigger.
create trigger trg_player_profiles_updated_at
before update on public.player_profiles
for each row execute function public.handle_updated_at();

-- 2. Same-transaction creation ----------------------------------------------
-- Least privilege: SECURITY INVOKER (explicit, matching ensure_app_user).
-- Runs with the caller's RLS; the WITH CHECK policies below still constrain
-- both INSERTs. Identity comes only from auth.uid(); no user_id parameter.
-- Creation forces undiscoverable: is_discoverable is NOT a parameter (DB
-- default false + dedicated consent action in G1-7). avatar_path is NOT a
-- creation parameter either (plumbed via owner UPDATE; upload wiring is G1-5).
-- Returns the caller's own row only (RLS SELECT policy).
create or replace function public.create_player_profile(
  p_handle text,
  p_display_name text,
  p_bio text,
  p_country_code text
)
returns table (
  user_id uuid,
  handle text,
  display_name text,
  avatar_path text,
  bio text,
  country_code char(2),
  is_discoverable boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
volatile
security invoker
set search_path = ''
as $$
  insert into public.app_users (id)
  values (auth.uid())
  on conflict (id) do nothing;
  insert into public.player_profiles (user_id, handle, display_name, bio, country_code)
  values (auth.uid(), p_handle, p_display_name, p_bio, p_country_code);
  select p.user_id, p.handle, p.display_name, p.avatar_path, p.bio, p.country_code, p.is_discoverable, p.created_at, p.updated_at
  from public.player_profiles as p
  where p.user_id = auth.uid();
$$;

comment on function public.create_player_profile(text, text, text, text) is
  'G1-2 atomic profile creation: app_users ensure + player_profiles insert + re-select in one transaction (SECURITY INVOKER, zero added privilege).';

-- Function executability follows the foundation posture: revoke from every
-- API-facing role, then grant the least privilege required.
revoke all on function public.create_player_profile(text, text, text, text) from public;
revoke all on function public.create_player_profile(text, text, text, text) from anon;
grant execute on function public.create_player_profile(text, text, text, text) to authenticated;

-- 3. Row Level Security ------------------------------------------------------
alter table public.player_profiles enable row level security;

-- Owner reads own row only (reads stay allowed when suspended: appeal/export).
create policy "player_profiles owner select"
on public.player_profiles for select to authenticated
using (user_id = auth.uid());

-- Owner creates own row only, when the account is active (suspended guard via
-- inline EXISTS, no DEFINER helper per 05 section 6).
create policy "player_profiles owner insert"
on public.player_profiles for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- Owner updates own row only, when the account is active. Column allowlists
-- (no handle/is_discoverable/user_id in the generic patch) are enforced at
-- the application boundary (07); RLS binds the row, Zod binds the columns.
create policy "player_profiles owner update"
on public.player_profiles for update to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.app_users
    where id = auth.uid() and status = 'active'
  )
);

-- No owner DELETE policy in G1-2 (deferred pending D-G1-07; default-deny is
-- the safe posture; a later migration adds the approved delete path).
-- No anon policies on any operation: anonymous callers reach nothing.
-- No public SELECT policy: public reads arrive in G1-4 as RPCs only (D-G1-03).

-- 4. Explicit grants (foundation lineage: never depend on implicit grants) ----
-- Least privilege for the approved G1-2 operations (SELECT/INSERT/UPDATE via
-- RLS). No DELETE grant (no DELETE policy while D-G1-07 is open). No UPDATE
-- grant widening beyond the owner policy. service_role and the table owner
-- are untouched (authorized administrative boundary).
revoke all on table public.player_profiles from public;
revoke all on table public.player_profiles from anon;
grant select, insert, update on table public.player_profiles to authenticated;
revoke delete, truncate, references, trigger
on table public.player_profiles
from authenticated;
