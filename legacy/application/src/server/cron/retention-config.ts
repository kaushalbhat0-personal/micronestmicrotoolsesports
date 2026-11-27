/**
 * Retention policy constants — deterministic server-side.
 * No client input influences these.
 * 07C audit: HOT <30d, RETENTION-CANDIDATE 30-90d, deletable >90d for scans/evidence/evaluations; webhook 30d.
 */

export const SCANS_RETENTION_DAYS = 90;
export const EVIDENCE_RETENTION_DAYS = 90;
export const EVALUATIONS_RETENTION_DAYS = 90;
export const WEBHOOK_RETENTION_DAYS = 30;

export const RETENTION_BATCH_SIZE = 500;
