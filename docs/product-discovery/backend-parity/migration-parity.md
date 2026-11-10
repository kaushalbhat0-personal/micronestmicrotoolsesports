# Migration Parity Report

## Headline

**Recorded history: 11/58.** Live `schema_migrations` contains only: `20250930000001 initial_schema`, `20250930000002 rls`, `20250930000003 seed_tools`, `20251001000001 sponsor_sentinel_core`, `20251002000001 sentinel_idempotency`, `20251003000001 add_scan_id_to_evidence`, `20251004000001 organization_provider_credentials`, `20251005000001 org_entitlement_provisioning`, `20251121000001 finder_foundation`, `20251122000001 finder_public_view_bio`.

**Live schema: objects from ~all 58 present** (51 tables, 59 functions, 44 triggers, full policy set, widened CHECKs incl. USD/Dodo/IANA — all verified above). The ~47 unrecorded migrations' objects exist without history rows.

## Interpretation (fact + inference labelled)

- **[Fact]** History gap spans 20251006–20251120 plus scattered later files (admin hardening, Dodo, USD, org hardening, meta/BGMI, payout/tie-breaker/draft-ban follow-ups).
- **[Inference, high confidence]** Schema was advanced outside recorded migration history (dashboard SQL editor or untracked applies), or history rows were lost. Either way the repo history alone does not describe how live got here.
- **[Fact]** Spot-checked definitions (policies, CHECKs, triggers, functions) match repo file contents exactly, including `webhook_events_select_member` (present in both `20251001000001` lines 350–351 and live — correcting the earlier audit prose that claimed no client policy).
- **[Fact]** No conflicting definitions found in spot checks; no remote objects without a matching repo migration (one apparent case, `oauth_tokens`, resolved: ALTER-only migration, columns confirmed live).
- **[Fact]** Live data added outside migrations: `tools` 9 rows, `plans` 14, `meta_parser_games` 3 (dota-2 + valorant + lol, matching the ingestion matrix), `bgmi_tournaments` 3, plus production usage rows (evidence, scans, ledgers). These came from app/seeding activity, not schema drift.
- **[Fact]** Known repo hazard confirmed relevant: duplicate version `20251005000001` (two files: org_entitlement_provisioning + scan_concurrency_lock); live history records the name `org_entitlement_provisioning` for that version. Any future `db push`/repair flow must handle the collision explicitly.
- **[Fact]** Engine skew: live Postgres 17 vs repo local PG15 config. No PG15-only syntax was observed in reviewed migrations, but major-version parity should be confirmed before new RPC work.

## Consequences

1. `supabase db reset` from repo is **not proven** to reproduce live; treat the 58 files as design source, not a verified replay log, until a staging reset is tested.
2. First new migration must establish a clean baseline marker; do not attempt to "fill in" the missing 47 history rows.
3. Manual-change discipline going forward: all schema changes via versioned migrations only (feeds D-19/D-08 operational hygiene).
