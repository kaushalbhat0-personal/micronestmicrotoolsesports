# Deployment — Legacy Reference

No active deployment configuration lives here.

- Legacy Vercel cron configuration: `../application/vercel.json`
- Legacy ingestion workflows:
  `../application/.github/workflows/bgmi-tournaments-ingest.yml`
  `../application/.github/workflows/meta-parser-ingest.yml`
- Active greenfield `vercel.json` remains at the repository root with no
  cron jobs. Do not re-enable legacy automation until greenfield routes,
  authentication, and scheduling requirements are defined.
