-- Tournament Roster & Slot Builder — Launch catalog (RCCF-ROSTER-SLOT-IMPLEMENTATION-01)
-- Tool row only, no paid plans: V1 is Unlimited Free (stateless client-side
-- parse/clean/slot/copy, no persistence), following the Prize Pool Splitter
-- Free-unlimited precedent. Free access is granted via the generic
-- claimFreeTool dispatch + ensureFreeRosterBuilderGrant (source='free').
-- All Access covers roster-builder automatically via has_tool_access
-- (is_all_access branch) + the TOOLS registry — no extra wiring.
-- Additive; does not modify earlier catalog or launch migrations. Idempotent
-- via ON CONFLICT. Not applied here — applied via the normal migration flow.

insert into public.tools (slug, name, description, is_active) values
  ('roster-builder', 'Tournament Roster & Slot Builder', 'Paste messy registrations — clean duplicates, flag shared players, assign slots', true)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  is_active = excluded.is_active;
