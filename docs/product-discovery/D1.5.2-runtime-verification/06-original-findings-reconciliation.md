# 06 — Original Findings Reconciliation (D1.5 → D1.5.1 → D1.5.2)

Evidence levels: STATIC = SQL-text + unit assertions (no live PG);
REPLAY = disposable-database execution (pending for all rows).

| ID | D1.5 severity | D1.5.1 claim | D1.5.2 independent verdict |
|---|---|---|---|
| F-T01 ownership takeover | Critical | FIXED (static) | **FIXED (static)** — grants + trigger verified; replay RT-01/02 pending |
| F-T02 applicant forgery | Critical | FIXED (static) | **FIXED (static) for UPDATE** — replay RT-03/04/05 pending; INSERT half open as F-NEW-01 |
| F-NEW-01 insert-time decided forgery | — (new) | — | **NOT FIXED (Medium)** — documented, forward fix specified, RT-04b |
| F-A01 suspended super-admin | High | FIXED (static) | **FIXED (static)** — join + fail-closed verified; replay RT-06 pending |
| F-T03 suspended writes | High | FIXED (static) | **FIXED (static)** — 6/6 policies verified; replay RT-07/08 pending |
| F-T04 arbitrary insert | High | FIXED by denial | **FIXED by denial (static)** — drop + revoke verified; replay RT-09 pending |
| F-T06 LIKE escaping | Medium | FIXED | **FIXED (static + pure-unit)** — chain order verified vs G1; replay RT-13 pending |
| F-A02 audit boundary | Medium | PARTIALLY | **PARTIALLY** — confirmed: no helper, honest comments, revokes; procedural half open |
| F-A03 comments | Medium | FIXED | **FIXED** — verified text |
| F-A04 TRUNCATE | Medium | PARTIALLY | **PARTIALLY** — revokes verified; engine limit stands, documented |
| F-A06 trigger hardening | Low | FIXED | **FIXED** — verified text |
| F-T05 captain path | — | BLOCKED | **BLOCKED** (unchanged) |
| F-T07 lifecycle/expiry | — | BLOCKED | **BLOCKED** (unchanged) |
| F-T08 PII scope | — | BLOCKED | **BLOCKED** (unchanged) |
| F-T09 retention/avail | — | BLOCKED | **BLOCKED** (unchanged) |
| F-T10 game-key equality | Low | BLOCKED | **BLOCKED** (unchanged) |
| F-T11 owner-row delete | Low | BLOCKED | **BLOCKED** (unchanged) |
| F-T12 org guard | Low | BLOCKED | **BLOCKED** (unchanged) |
| F-T13 indexes | Low | BLOCKED | **BLOCKED** (unchanged) |
| F-A05 bootstrap runbook | Low | BLOCKED | **BLOCKED** (unchanged) |
| F-A07 cron quality | Low | BLOCKED | **BLOCKED** (unchanged) |

No D1.5.1 claim was overturned; one gap the prior phases missed (F-NEW-01) is
added. Nothing marked FIXED has runtime proof — the column states the honest
level explicitly.
