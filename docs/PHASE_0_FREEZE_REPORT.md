# Phase 0 — Freeze Report

Per `MIGRATION_PLAN_V2.md` Phase 0. Nothing moved, nothing deleted (Art. 18).

## Commits and tag

Two commits, deliberately separate so the tag marks a coherent office-era state:

1. **office-era** — the half-applied vertical migration plus its step documents.
2. **proof-of-life** — `core/`, the constitution, the reset documents, this report.

Annotated tag **`office-era-final`** points at commit 1. Not pushed.

## Office verification

| Command | Result |
|---|---|
| `cd frontend && npm install` | ok |
| `npm run dev` | **starts**, serves http://localhost:5173/ |
| `npm run build` | **fails** — 5 × TS6133 unused locals |

The build failure is the deferred cleanup recorded in `VISUAL_REGRESSION_FIX.md`:
`settleWithinBounds`, `isApplyingPreset`, `notifyManualMove` in `OfficeGame.tsx`;
`applyPreset`, `activePreset` in `LifeOfficeDemo.tsx`. **Not repaired** — the task
forbids it and Art. 19 requires only that archived code stay runnable, which `dev`
satisfies. Recorded in `archive/office/README.md`.

## Classification — read, not moved

| Item | Lines | Class | Reason |
|---|---|---|---|
| `backups/lifeos_before_knowledge_20260722_125819.sql` | 525 | **KEEP** | Pre-knowledge-layer DB snapshot, 2026-07-22. The only copy of that state; Art. 18. Belongs outside git eventually, not deleted. |
| `lifeos_audit.txt` | 479 | **DELETE LATER** | Terminal transcript of a 9-step audit run against a path that no longer exists (`~/Desktop/life-os`). Machine output, not a document. No unique claim survives in it. |
| `lifeos_next_step.txt` | 1600 | **REQUIRES DECISION** | A full context dump (package.json onward) ending in a live commitment: a golden dataset of 30–50 Korean utterances with provisional thresholds. That commitment is real work and is recorded nowhere else. Extract it, then reclassify. |
| `docs/LIFE_OS_SPEC.md` | 862 | **REQUIRES DECISION** | v0.1 living spec, 12 sections including "Agent Model (Future)" and a Design Evolution Log. Predates the manifesto and partially contradicts it. Must be reconciled article by article before Phase 2, or it will be cited as authority against the constitution. |
| `docs/plugins-inventory.md` | 113 | **KEEP** | Household Supplies plugin spec (ADR-014). Describes `src/household-supplies/`, which the audit marked UNKNOWN pending "is Kitchen the second capability?". Keep until that question is answered. |
| `docs/05-slice-01.md` | 369 | **KEEP** | The minimal end-to-end slice proof: Korean text → typed proposal → validation → event append + projection in one transaction → rebuild-equality. This is the same pipeline `core/` now implements. Directly relevant, not legacy. |

No **DUPLICATE** classifications: each file is the only copy of its content.

## Phase 0 exit criteria

| Criterion | Status |
|---|---|
| Vertical office migration stopped where it stands | ✓ not advanced |
| Tagged `office-era-final` | ✓ annotated, unpushed |
| Six unknowns read and classified | ✓ above |
| Office runnable from a clean clone | ✓ via `dev`; `build` fails, documented |

**Blocking Phase 1:** two REQUIRES DECISION items. `LIFE_OS_SPEC.md` is the more
urgent — an unreconciled 862-line spec that predates the constitution is the most
likely source of a future contradiction.
