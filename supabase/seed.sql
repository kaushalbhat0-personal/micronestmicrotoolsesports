-- Local seed for development — run via `supabase db reset`
-- This file is for local development only; production uses migrations.

-- Ensure tools exist (duplicate of migration for local)
insert into public.tools (slug, name, description, is_active) values
  ('sponsor-sentinel', 'Sponsor Proof-of-Performance Sentinel', 'Automated Twitch VOD proof and sponsor exposure tracking', true),
  ('scrim-matchmaker', 'Cross-Timezone Scrim Matchmaker & Pinger', 'Find scrims across timezones with smart pinging', false),
  ('prize-splitter', 'Prize Pool Splitter & Escrow', 'Split prize pools and manage escrow transparently', true),
  ('draft-ban', 'Draft & Ban', 'Professional match draft room — run vetoes and lock official records', true),
  ('vod-clipper', 'VOD Timestamp & Voice-Note Clipper', 'Clip VODs with timestamps and voice notes', false),
  ('roster-sentinel', 'Roster Visa & Contract Sentinel', 'Track visas and contracts for rosters', false)
on conflict (slug) do nothing;
