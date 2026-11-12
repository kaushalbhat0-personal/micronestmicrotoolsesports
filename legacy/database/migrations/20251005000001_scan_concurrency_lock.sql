-- Concurrency safety: at most one active Check per campaign
-- Prevent duplicate expensive discovery/evaluation via partial unique index.
-- Stale handling: scans stuck in pending/running >10min are expired to failed before acquiring.
-- This index is the atomic guard; inserts violating it indicate already running.

create unique index if not exists scans_campaign_active_unique
  on public.scans (campaign_id)
  where status in ('pending', 'running');

-- Helper RPC for atomic stale cleanup (optional, but we also do client-side update before insert)
-- Keep index as primary guard; RPC not required but documented.

comment on index scans_campaign_active_unique is 'Concurrency lock: at most one pending/running scan per campaign';
