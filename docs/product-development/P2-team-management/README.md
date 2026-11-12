# P2 — Team Management Workspace

Status: implemented (complete owner experience; persistence gated by design).

## What shipped

The authenticated Team Management Workspace: managed-team listing with
per-team management basis, team overview, owner/captain settings surface,
and roster presentation — plus the validation-complete creation/editing
contracts and a kill-switched server-operation layer. All reads are
session-scoped; all writes are disabled behind `WORKSPACE_WRITES_ENABLED`
with no fake success anywhere.

## Map

| Doc | Contents |
| --- | --- |
| `01-routes-components.md` | Route and component inventory |
| `02-workspace-design.md` | Owner workspace design (access, basis, states) |
| `03-creation-editing-contracts.md` | Team creation and editing contracts |
| `04-roster-permissions.md` | Roster interface and permission boundaries |
| `05-server-integration-plan.md` | Server integration plan (readiness sequence) |
| `06-security-report.md` | Security report |
| `07-test-evidence.md` | Test evidence (static vs runtime distinguished) |
| `08-remaining-decisions.md` | Remaining owner decisions + next phase |

## Headline verdicts

- **Functional:** workspace shells, basis badges, permission notes, locked
  vs editable field presentation, roster cards, sign-in/empty/unavailable
  states, validation layers, static audits.
- **Disabled by kill switch:** team creation insert, settings update
  (validated, then `WorkspaceDisabledError`; zero table touches proven).
- **Unavailable by design:** member add/remove, captain assignment,
  application-driven joins, ownership transfer, org authority — no
  controls, no RPCs invented.
- **Database integration:** code-complete, **not live** — D1 migrations
  remain local and unapplied per phase policy.
- **G1/P1:** unchanged. Full suite green (459 passed).
