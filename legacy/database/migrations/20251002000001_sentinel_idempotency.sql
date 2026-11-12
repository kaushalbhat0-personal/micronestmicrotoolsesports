-- Sentinel idempotency hardening (RCCF-04)
-- Evidence dedupe must be deterministic; DB constraint is stronger than app check-then-insert.

create unique index if not exists evidence_idempotency_unique
  on public.evidence(organization_id, deliverable_id, platform, source, source_id, observed_at);

-- Scans are executions; no unique idempotency needed — retries create new scan rows.
-- webhook_events already has unique(provider, external_event_id) — sufficient.
