# P10 deferred decisions

Explicitly NOT decided, NOT approved, and NOT built in P10. Each names its
blocking question and the earliest phase that may take it.

1. **Moderation authority + operating parameters** (P10-04): approver is
   proposed (`platform_admins`), but SLA, queue retention duration,
   visibility rule, and takedown power are open. Earliest: P11 (proposal) →
   owner approval → migration.
2. **Verification evidence policy** (P10-05): evidence types are declared,
   but handling, storage location, access control, retention duration, and
   approver workflow are open. No evidence intake until approved.
3. **Rejection-reason storage + decision audit tables** (P10-06): shapes are
   specified (`ModerationAuditEntry`, `VerificationAuditEntry`); DDL, RLS,
   and uniqueness constraints await the moderation migration.
4. **Archival retention duration** (P10-07): no-delete posture proposed; how
   long unpublished/archived rows persist is open.
5. **Media + evidence uploads** (P10-08): deferred entirely (ownership,
   scoping, moderation, retention all open).
6. **Organizer directory filter** (P10-09): additive `p_organizer_slug`
   approved in principle; not implemented.
7. **F-01 column guard** (`trust_state`/`is_public` freeze trigger or
   column-grant narrowing): specified, not applied.
8. **F-02 published-row edit rule** (strict freeze vs reviewed-diff): options
   documented, choice + enforcement open.
9. **F-03 founding-owner insert path**: specified, not migrated.
10. **Organization linkage flow** (P10-02): dual-consent model proposed;
    initiating side, UX, and admin tooling open.
11. **Professional operator bar** (P10-03): deferred with the vocabulary
    frozen.
12. **Report rate limiting + duplicate collapsing**: specified, not built
    (nothing to abuse while intake is disabled).
13. **Runtime verification itself**: blocked under current constraints;
    requires separate authorization for a disposable replay.
