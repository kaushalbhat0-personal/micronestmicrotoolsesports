# 03 — Main transition (P14-A, 2026-11-12)

## Method chosen: fast-forward (ancestry permitted it)

- `origin/main` (`bdece4d`) was a strict ancestor of `new-platform`
  (`01893ae`): 5 ahead, 0 behind (§01.6). No divergence, no force-push,
  no protection bypass. Worktree never switched (refspec push).

## Operations (all accepted by server, none destructive)

1. `git push origin new-platform:main`
   → `bdece4d..01893ae  new-platform -> main` (fast-forward).
2. `git push origin new-platform:new-platform`
   → `* [new branch] new-platform -> new-platform` (rollback/reference).

No force flag used. No rejection encountered (branch protection, if any,
permits this update). Local `main` (`caff7a2`) was already contained in the
pushed history — nothing lost; local `main` ref intentionally left
untouched (no checkout switch with a dirty tree).

## Remote verification (`git ls-remote origin` + post-fetch `branch -r -v`)

| Ref | SHA | Content |
| --- | --- | ------- |
| `origin/main` | `01893ae5b0275979649edb754e4dd9ea6cbaebb7` | new-platform release commit |
| `origin/new-platform` | `01893ae5b0275979649edb754e4dd9ea6cbaebb7` | identical — rollback/reference |
| `origin/legacy-archive` | `bdece4db981a42719f74286ae6a9dbc15f68cd18` | previous legacy main, byte-identical |
| `origin/master` | `b6ffe27…` | untouched |

## No legacy reintroduction

Promoted tree = new-platform tree (§01.9): greenfield root, `ref/` holds
only the reference archive, no legacy runtime imports possible (verified in
Phase 4). `new-platform` local branch NOT deleted; `legacy-archive` local +
remote retained.
