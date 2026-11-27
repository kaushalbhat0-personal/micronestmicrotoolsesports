-- MicroNest Esports G1-1: grant tightening for public.app_users (D-G1-02).
--
-- The managed platform applies default table privileges wider than the frozen
-- set in 05 §7 (SELECT, INSERT, DELETE to authenticated; no owner UPDATE).
-- RLS already denies every non-policed operation, but the grant surface is
-- reduced here for exact compliance with the approved configuration:
-- authenticated keeps SELECT + INSERT + DELETE only. service_role and the
-- table owner are untouched (authorized administrative boundary).
--
-- No policy, column, or behavior change. G1-2/G1-3 domain migrations adopt
-- the same explicit revoke pattern at creation time.

revoke update, truncate, references, trigger
on table public.app_users
from authenticated;
