# Office — frozen

The PixiJS office prototype. **Frozen. Not maintained. Not imported.**

Retired by `docs/PROJECT_RESET_AUDIT.md`; replaced by `core/` (see
`docs/PROOF_OF_LIFE_V1.md`). Kept because Art. 19 forbids deleting it and because
the sprite, pathfinding, and bubble work would cost ~4 weeks to recreate.

## Frozen at

| | |
|---|---|
| Tag | `office-era-final` (annotated) |
| Commit | see `git rev-parse office-era-final` |
| Branch at freeze | `recovery/mobile-ui-20260802` |
| Code location | still in place at `frontend/` — **not yet physically moved here** |

The code has not been relocated: Art. 18 forbids removing it before its
replacement ships (Phase 4), and moving it now would break the tag's usefulness
as a runnable point. This README is the freeze record; the move is a Phase 2
restructuring step.

## Install

```bash
cd frontend && npm install
```

## Run

```bash
cd frontend && npm run dev
```

## URL

http://localhost:5173/

## Known incomplete state

**The office is mid-migration and will not render correctly.** It was frozen
where it stood rather than finished, per `MIGRATION_PLAN_V2.md` Phase 0.

- The vertical layout migration is half-applied. Canvas, props, walls, and the
  navigation grid are on the 512×1536 portrait map (Steps 1-2); the desk seats
  the sprites actually use were migrated, but Step 3 was never started.
- `npm run build` **fails**: five TS6133 unused-local errors in `OfficeGame.tsx`
  and `LifeOfficeDemo.tsx`, left by the pan regression fix and the job-input
  cleanup. `npm run dev` still starts, because Vite dev does not typecheck.
- Right-pan behaviour was reverted to commit `221ecb1` and never visually
  verified — no browser check was ever completed on this branch.
- Character portraits/agent identity work was never started.

None of this will be repaired. It is recorded so that a future reader does not
mistake a frozen half-migration for a bug they introduced.

## Prohibition

**Live code must not import from `archive/office/` or from `frontend/`.**
`core/` has no dependency on either and must acquire none (Art. 19). Archived
code stays buildable and runnable; it does not stay connected.
