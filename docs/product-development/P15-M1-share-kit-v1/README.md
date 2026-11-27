# P15-M1 — Share Kit v1

**Branch:** `new-platform` @ `890e16c` (unchanged HEAD; implementation uncommitted)  
**Mode:** Implementation complete locally — **no commit / push / deploy**

## Verdict

**CONDITIONAL PASS — Share Kit v1 implemented; P15-M1-V browser acceptance complete.**

Client-side branded PNG exports for tools, public player profiles, and public teams; prize over-allocation inline recovery; tools roster CSV download; neutral `/campaigns/bgmi-season` landing. Database, RLS, RPCs, Auth, and projections unchanged. Visual evidence under `evidence/`; see `06-visual-acceptance.md`.

## Deliverables

| File | Contents |
|---|---|
| `01-implementation-summary.md` | Features, files, dependencies, approach |
| `02-share-card-design.md` | Visual system and dimensions |
| `03-security-and-privacy-verification.md` | Boundary confirmation |
| `04-test-and-build-results.md` | Gate results |
| `05-known-limitations.md` | Deferred / known gaps |
| `06-visual-acceptance.md` | P15-M1-V browser matrix, evidence, defects, verdict |
| `evidence/` | Screenshots + sample 1080² PNGs |

## Quick links

- Tools: PNG on Prize / Roster / Tie-Break runners  
- Players: `/players/[handle]` → Download player profile PNG  
- Teams: `/teams/[slug]` → Download team/recruitment PNG  
- Landing: `/campaigns/bgmi-season` (`noindex`)
