# 06 — Known Gaps & Next Steps

## Blockers / gaps

1. ~~Migration not applied~~ — **Applied** to Esports `knniommcyyhbyiwljisk` after CLI token refresh (`db push --linked`).
2. No Playwright coverage for the new settings edit forms in this milestone.
3. Availability suggestions are UI conveniences only (schema remains shape-only).
4. Country input is free-text ISO alpha-2 (existing schema); no full country picker.

## Explicitly deferred (by lock)

- M2B.2 BGMI Player ID UI/storage surfacing  
- Evidence upload / review / badge  
- Discord OAuth  
- Team roster identity cards  
- Stricter completeness fields beyond D-G1-08  

## Recommended next actions

1. Optional: re-run directory/consent integration tests against the live DB.  
2. Start **M2B.2** (private BGMI ID) when ready — do not auto-start from this milestone.  

## Rollback

- App: remove settings sections / actions.  
- DB: restore prior function bodies from `20261111000008` + `20261110000007`; drop `player_profile_is_complete`.  
