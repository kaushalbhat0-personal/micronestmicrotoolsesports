# 09 — Remaining Owner Decisions + Next Phase

## Decisions for owners (publishing stays disabled until ALL are accepted)

1. **Author identity** — display-name-only today. Decide: sign-in provider,
   author profiles, byline rules. Do NOT invent author permissions meanwhile.
2. **Editorial authorization** — who may draft / review / approve / schedule /
   publish / unpublish / archive. No roles assumed in P4.
3. **Content model acceptance** — approve or revise `04-content-model.md`
   (tables, RPC pair, visibility predicate), then `postgres-rls` review.
4. **Database policies** — RLS + grants + slug/game immutability, then
   migration + remote application by the authorized owner flow.
5. **Content security extras** — hero-image hosting policy (allowlist?
   storage bucket?), link policy, corrections flow, reporting flow.
6. **Source policy** — which outlets may be sourced, quotation limits,
   update/correction display rules.
7. **AI policy** — P4 generates no article text. Any future AI assistance
   needs an explicit editorial workflow + disclosure rule.
8. **Scheduling semantics** — timezone handling for `scheduled_for` /
   `published_at`, embargo behavior.
9. **Revisions** — snapshot shape for `news_article_revisions`, retention,
   who may view history.
10. **Sitemap/indexing** — news currently `noindex` (directory posture);
    decide when story URLs may be indexed and added to the sitemap.

## Next phase recommendation

**Phase A (no owner writes needed):** editorial QA of the reading experience
with clearly-labelled local fixtures behind a dev-only flag (never committed
as production content); accessibility + responsive pass on real devices.

**Phase B (after decisions 1–4):** accept the content model, migrate, verify
RPCs against the reader contract with database authorization tests, then
enable workspace persistence behind session-derived operations (flip the
kill switch + update gate tests).

**Phase C (after decision 5–7):** corrections/reporting, image policy, and —
ONLY with a separate safety + editorial review — any ingestion assistance.
Never automated crawling + publishing without that review.
