-- MicroNest — Meta-Parser publication boundary (RCCF-META-PARSER-FACTS-IMPL-01)
--
-- Option C (status-gated publication): `ingested` = staging/non-public,
-- `complete` = published/readable. Readers predicate on
--   status = 'complete' AND content_hash <> ''
-- so the delete → chunked-insert replacement window is never observable.
--
-- This migration is ADDITIVE ONLY:
-- - one composite index for the Facts read pattern (patch-scoped + enum filters);
-- - no table changes, no RLS changes, no data rewrites, no new write policies.
-- Existing status values are reused; no new status is introduced.
--
-- DO NOT APPLY AUTOMATICALLY. Apply via the standard migration workflow.
-- After applying, run the verification queries in section 10 of the IMPL-01
-- report (5 patches complete/revision-1/real-hash, 5,756 changes, 0 orphans).

-- ── Facts read pattern ─────────────────────────────────────────────
-- listChanges(patchId, { entity_type?, change_type? }) with
-- ORDER BY stable_key. Existing `meta_parser_changes_patch_idx (patch_id)`
-- covers unfiltered patch reads; the composite covers the enum-filtered
-- reads without scanning the whole patch set.
create index if not exists meta_parser_changes_patch_filter_idx
  on public.meta_parser_changes(patch_id, entity_type, change_type);

-- entity_normalized filtering reuses the existing
-- meta_parser_changes_entity_idx (game_slug, entity_normalized) plus the
-- patch_id predicate above; no additional index until EXPLAIN on real
-- filter combos proves a need. No speculative indexes.
