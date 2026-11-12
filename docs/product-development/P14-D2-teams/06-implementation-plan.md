# 06 — Implementation Plan (P14-D2 → P14-D3)

**This phase:** contracts + cutover prep only.  
**Next phase (P14-D3):** author SQL + wire create/settings behind existing kill switch.

---

## Sequence

1. **Owner:** reload Cursor MCPs; complete Supabase OAuth on `knniommcyyhbyiwljisk` (read-only).  
2. **Re-confirm** remote ledger (read-only) vs cutover doc.  
3. **Author** P14 Teams migrations per `04-schema-and-rpc-contract.md` (order in `03`).  
4. **Retarget** static SQL tests from archived D1 paths to new P14 files.  
5. **Disposable DB apply** + runtime JWT battery (`05`).  
6. **App wiring:** `/teams/new` → `createTeamAction` → `create_team` RPC; settings → `update_team_settings`. Keep `WORKSPACE_WRITES_ENABLED=false` until battery green.  
7. **Flip kill switch** only with explicit owner authorization after green tests.  
8. **Do not** implement transfer, leave/remove, appoint captain, recruitment in D3.  
9. **Revise P13 push plan** separately: drop D1 02–04; re-home F-A01 before P9/P11.

---

## Non-goals for P14-D3

- Ownership transfer (A2 deferred)  
- Membership administration beyond create seed  
- Recruitment / applications  
- Public roster identities  
- Write-switch enablement without test gate  
- LMS access / Docker / legacy imports  

---

## Acceptance for D3 start

- [x] A1–A6 locked (`02`)  
- [x] D1 teams 02–04 archived (`03`)  
- [x] Schema/RPC contract frozen (`04`)  
- [x] Security cases enumerated (`05`)  
- [ ] Supabase MCP live reconnect (user)  
- [ ] No expansion of decisions
