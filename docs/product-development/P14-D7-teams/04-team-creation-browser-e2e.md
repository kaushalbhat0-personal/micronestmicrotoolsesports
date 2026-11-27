# 04 — Team Creation Browser E2E (P14-D7)

Preview: `dpl_Dg6uV5ib84rjBdeMiaavHuxzt5hC`  
Role: verified active **owner** (cookie session).

## `/teams/new`

| Step | Expected | Actual |
| --- | --- | --- |
| Form render | Accessible labeled fields | PASS (name, slug, game, region, levels, description, checkboxes) |
| Empty submit | HTML validation blocks | PASS (focus moves to required Team name) |
| Create public team | Success feedback | PASS — status **“Team created.”** |
| Slug | `p14d7-public-20261113005330` | PASS |
| Public directory | Appears in `/teams?query=p14d7-public` | PASS — “Showing 1 public team” |
| Public detail | `/teams/{slug}` | PASS — name/about; roster identities withheld |
| Workspace | Owner membership | PASS — “Owner — you manage this team” |
| Creation audit | Exactly one `team.created` | PASS |

## Private team

Created via authenticated `create_team` RPC (`is_public=false`, slug `p14d7-private-20261113005330`):

| Check | Result |
| --- | --- |
| Anon `search_teams` | **0** hits for private slug |
| Anon `get_team_by_slug` | **0** rows |

(Browser private create form path not separately repeated after public create; privacy verified via RPC + same writer.)

## Duplicate slug

Owner `create_team` with existing public slug → HTTP **409** / `slug conflict` — PASS.

## Form labels / a11y (smoke)

Labeled inputs, required attributes, status role for success, focus-visible styles present on controls.
