-- 07B: Per-scan attribution — add scan_id to evidence and evaluations
-- Enables exact per-scan evidence/evaluation queries vs campaign-level aggregation.

alter table public.evidence add column if not exists scan_id uuid references public.scans(id) on delete restrict;
alter table public.evaluations add column if not exists scan_id uuid references public.scans(id) on delete restrict;

create index if not exists evidence_scan_id_idx on public.evidence(scan_id);
create index if not exists evaluations_scan_id_idx on public.evaluations(scan_id);

-- Existing rows will have scan_id = null (historical scans before this migration). New scans will populate it.
-- No backfill required for correctness; UI will correctly show empty for historical scans.

-- Optional: Add scan_id to evidence_idempotency_unique is already on (organization_id, deliverable_id, platform, source, source_id, observed_at)
-- Including scan_id would allow same external content observed in different scans to be distinct rows, which is desired (each scan creates new evidence).
-- Current unique does NOT include scan_id, so re-observing same content at same observed_at in a different scan would be considered duplicate.
-- To allow per-scan distinct evidence, we keep current unique as is (prevents duplicate within same observed_at), but per-scan evidence is expected to have different observed_at (now) so it will be distinct.
-- No change to unique constraint needed for MVP.

comment on column public.evidence.scan_id is 'Scan that generated this evidence — enables exact per-scan attribution (07B)';
comment on column public.evaluations.scan_id is 'Denormalized scan_id for direct per-scan evaluation queries (07B)';
