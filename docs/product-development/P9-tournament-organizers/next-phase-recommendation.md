# P9 next-phase recommendation

## Recommended P10 — Moderation + verification boundary, then gated launch

1. **Decide P9-04/P9-05** (moderation authority + verification policy) with
   retention/SLA in writing.
2. **Replay 05 + 06** against a disposable database: syntax, triggers,
   RLS matrix (anon/authenticated/owner/non-member/cross-organizer/forged),
   RPC shapes, key-set assertions. Fix forward in new migrations only.
3. **Build the gated minimum**: report intake (insert-only reporter pattern),
   reviewer queue (moderator-gated reads), verification evidence handling
   (private bucket contract), then flip the lifecycle transitions one at a
   time — submit first, publish only after the queue is staffed.
4. **Backfill** historical denormalized organizer refs to `organizer_id`
   where ownership is proven; leave the rest denormalized and honestly
   unlinked.
5. **Decide P9-02/P9-03** (organization linkage, professional class) before
   any badge or linkage UI beyond today's null-safe rendering.
6. **Marketing follow-up**: homepage roadmap still lists organized play as
   future — reword only after liveness, never before.

## What NOT to do next

- Do not enable writes without the replay run.
- Do not invent a report button before the queue exists.
- Do not convert organizations into organizers silently.
- Do not add media uploads, payments, brackets or scoring to the organizer
  surface — those are separate products with separate threat models.
