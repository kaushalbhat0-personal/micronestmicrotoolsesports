# Workflows — Greenfield review decision

No active GitHub workflows in the greenfield workspace.

Legacy ingestion workflows were tied to the old application and its
ingestion endpoints:

- `bgmi-tournaments-ingest.yml` — daily POST to
  `/api/ingest/bgmi-tournaments` using `APP_URL` and `CRON_SECRET` secrets.
- `meta-parser-ingest.yml` — daily POST to `/api/ingest/meta-parser`
  using `APP_URL` and `CRON_SECRET` secrets.

Decision: deactivate by archiving. Full contents preserved as reference at:

- `ref/legacy-platform/.github/workflows/bgmi-tournaments-ingest.yml`
- `ref/legacy-platform/.github/workflows/meta-parser-ingest.yml`

Do not re-enable until greenfield ingestion routes, authentication, and
scheduling requirements are defined. When re-introducing automation,
define new workflows here with explicit ownership and observability.
