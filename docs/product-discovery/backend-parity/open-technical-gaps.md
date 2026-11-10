# Open Technical Gaps

1. **History reconstruction (P0-adjacent):** how live reached current schema without 47 history rows — process answer needed before first migration (baseline strategy depends on it). Owner/maintainer input required.
2. **Duplicate version `20251005000001`:** collision handling for future push/repair flows. Needs a maintainer decision, not product.
3. **PG17 vs PG15:** confirm major-version expectations for new RPC work.
4. **Auth live settings:** confirmations, SMTP, OAuth, MFA, hooks, JWT — dashboard read-only review (D-15 input).
5. **D-08/D-09 numbers:** SLA/strikes, caps/note length — still OPEN per owner; fields can be built, values gate launch.
6. **Legacy finder assumption:** "no production users to carry" — confirmed by zero live rows ✓ (assumption now fact for finder tables; re-confirm for any other carried data at migration time).
7. **Seed strategy:** D-13 pending; new-env seed contents undefined.
8. **Storage limits:** MIME/size enforcement values undefined (P1).
9. **Anon-RPC review:** 29 anon-executable definer functions need per-function necessity review before new-domain RPCs copy the pattern.
10. **Notification delivery:** provider choice deferred with D-04; queue schema can proceed regardless.
