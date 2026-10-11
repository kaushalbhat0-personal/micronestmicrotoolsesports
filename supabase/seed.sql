-- Local seed for development — run via `supabase db reset`
-- This file is for local development only; production uses migrations.

-- Ensure tools exist (duplicate of migration for local)
insert into public.tools (slug, name, description, is_active) values
  ('sponsor-sentinel', 'Sponsor Proof-of-Performance Sentinel', 'Automated Twitch VOD proof and sponsor exposure tracking', true),
  ('prize-splitter', 'Prize Pool Splitter & Escrow', 'Split prize pools and manage escrow transparently', true),
  ('draft-ban', 'Draft & Ban', 'Professional match draft room — run vetoes and lock official records', true),
  ('tie-breaker', 'Tie-Breaker Resolver', 'Official standings for tied competitions — explained, locked, shareable', true)
on conflict (slug) do nothing;
