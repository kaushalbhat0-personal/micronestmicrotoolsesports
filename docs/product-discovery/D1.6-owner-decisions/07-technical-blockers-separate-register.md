# 07 — Technical Blockers Separate Register

Product choices stay in the decision register. The items below need engineering
or environment action, not owner taste — except where noted. None is closed here.

| ID | Required technical action | Needs owner approval? |
|---|---|---|
| F-NEW-01 insert `decided_*` forgery | Forward correction: insert WITH CHECK nullness and/or BEFORE INSERT trigger + RT-04b replay | Correction text: no; scheduling with D1-D12: yes |
| FWD-01/FWD-02 trigger revisions | Future captain/transfer migrations must own their trigger revisions with checks + audit | Design approval when those features are proposed |
| F-A02 audit-write API remainder | Decide: service-role-only + runbook (standing) vs DEFINER helper (new API surface) | YES if helper; runbook: no |
| F-A04 TRUNCATE governance | Runbook entry for owner/service-role truncate; no code can close the engine gap | No |
| Runtime replay RT-01…RT-18 | Approved disposable environment + green evidence per test | Environment authorization: YES |
| F-T13 indexes | Additive CREATE INDEX when query evidence justifies | No |
| F-A05 bootstrap runbook | First-admin procedure doc | No |
| F-A07 cron quality | Additive CHECKs + index | No |
| F-T10/T-T11/T-T12 guards | Small triggers/CHECKs when their parent decisions land | With parent decision |

Standing rule: fail-closed blocks (denied inserts, denied decisions, frozen
columns) remain until the owning decision + migration + replay replace them.
