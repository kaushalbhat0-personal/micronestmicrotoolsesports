# P15-M2B.1 — Player Profile Editing & Completeness Enforcement

**Branch:** `new-platform` @ `890e16c` (HEAD unchanged; work uncommitted)  
**Mode:** Implementation complete locally — **no commit / push / deploy**  
**Supabase:** Esports `knniommcyyhbyiwljisk` (migration **applied** via `supabase db push --linked` after token refresh)

## Verdict

**PASS** (implementation + hosted completeness gates)

Profile editing UI, avatar wiring, canonical D-G1-08 completeness, and discoverability gates are implemented. Migration `20261128000001_p15_m2b1_discoverability_completeness.sql` is applied on Esports only.

## Locked decisions preserved

- Discord deferred / optional  
- Completeness + explicit consent for directory visibility  
- Verification separate (not required)  
- BGMI ID deferred to M2B.2  
- Frozen 12-field public projection unchanged  
- Team roster privacy unchanged  

## Completeness rule (canonical)

```
complete =
  handle present
  + display_name non-empty
  + (avatar_path OR non-empty bio)
  + ≥1 game profile
```

Same rule in TypeScript (`getProfileCompleteness`) and SQL (`player_profile_is_complete`).

## Consent behavior

- `is_discoverable` = consent preference (not auto-cleared when incomplete)  
- Enable rejected when incomplete (UI + `set_player_discoverability`)  
- Disable always allowed  
- Public RPCs require consent **and** completeness (after migration)  
- Re-completing restores visibility without forcing a new opt-in if consent stayed true  
- Opt-out is never silently reversed  

## Deliverables

| File | Contents |
|---|---|
| `01-profile-editing-implementation.md` | Edit surfaces and reuse |
| `02-completeness-and-discoverability.md` | Rule + consent model |
| `03-avatar-implementation.md` | Avatar wiring |
| `04-security-and-rls-verification.md` | Boundaries |
| `05-test-evidence.md` | Commands + results |
| `06-known-gaps-and-next-steps.md` | Migration apply + M2B.2 |
