-- Seed known microtools (catalog)
-- idempotent via on conflict

insert into public.tools (slug, name, description, is_active) values
  ('sponsor-sentinel', 'Sponsor Proof-of-Performance Sentinel', 'Automated Twitch VOD proof and sponsor exposure tracking', true),
  ('scrim-matchmaker', 'Cross-Timezone Scrim Matchmaker & Pinger', 'Find scrims across timezones with smart pinging', true),
  ('prize-splitter', 'Prize Pool Splitter & Escrow', 'Split prize pools and manage escrow transparently', true),
  ('vod-clipper', 'VOD Timestamp & Voice-Note Clipper', 'Clip VODs with timestamps and voice notes', true),
  ('roster-sentinel', 'Roster Visa & Contract Sentinel', 'Track visas and contracts for rosters', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;

-- All-access is NOT a row in tools; it is represented by is_all_access = true in entitlements.
-- This keeps authorization logic data-driven without hardcoding tools.
