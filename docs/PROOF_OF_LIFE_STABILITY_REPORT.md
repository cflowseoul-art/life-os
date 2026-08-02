# Proof of Life — Stability Report

Audit of `core/`, `vitest.config.ts`, `docs/PROOF_OF_LIFE_V1.md` against six guarantees.
Four defects found, all fixed. **19/19 tests pass; `tsc --noEmit` clean.**

## Result

| # | Guarantee | Before | After |
|---|---|---|---|
| 1 | Event has id, time, actor, provenance, **schema version** | ✗ no version, no source | ✓ fixed |
| 2 | Replay produces the same final state | ✓ already true | ✓ now tested |
| 3 | Re-running cannot duplicate handover / Ask / answer / artifact | ✗ handover duplicated | ✓ fixed |
| 4 | Malformed JSONL fails safely, no silent state | ~ raw SyntaxError | ✓ fixed |
| 5 | Ask and option ids stable across restarts | ✓ already true | ✓ now tested |
| 6 | Synchronous execution behind a replaceable boundary | ✗ inlined | ✓ fixed |

## Defects fixed

**D1 — No schema version, no event source (Art. 14, Art. 8).**
`EventEnvelope` carried id/at/actor/capability only. A future reader could not tell
which envelope shape it was reading. Added `SCHEMA_VERSION = 1`, a required
`schemaVersion` field, and a required `source` field naming what caused the write.
A log line whose `schemaVersion` exceeds the reader's is refused rather than guessed at.

**D2 — Re-running `hand-over` created a second hold (Art. 3).**
The same JD handed over twice produced two independent holds and two Asks. Added
`handoverKey()` — a SHA-256 content address over company + role + JD text. An
existing non-withdrawn hold with the same key is returned instead of created, and
the result now reports `duplicate: true`. Verified end to end: two identical
`hand-over` invocations produce **1** `HandedOver` event, 9 total events.

Ask, answer, and artifact were already non-duplicating via replay guards; this is now
pinned by a test that calls `advance()` four extra times and asserts exact event counts.

**D3 — Malformed JSONL threw a bare `SyntaxError` (Art. 8).**
Now `EventLogCorrupt`, naming the file, the 1-indexed line, and the reason. The
deliberate choice recorded in code: a corrupt line is **never skipped**. Silently
dropping an event yields a state that is wrong in a way nobody can see, which is
worse than a crash. A half-written trailing line — the realistic failure — is caught by
required-field validation, not just by JSON parsing.

**D4 — Execution had no replaceable boundary (guarantee 6).**
`handOver()` called `advance()` directly. Introduced `interface Runner` with
`InlineRunner` as the default; `handOver()` and `answer()` now schedule through it.
Tested with a deferring runner: the handover is durable and the state is `held`
with no Ask raised until the queue drains. This is the single seam a daemon or job
queue replaces, and it is now provably the only one.

## Not changed

- No generalisation beyond Career (Art. 15 — the second capability is Phase 5).
- No engine redesign, no UI, no new dependencies.
- `unbackedNumbers`, provenance, and the one-Ask rule were already correct.

## Remaining gaps (unchanged from v1, still true)

- Art. 5 untested — nothing here is irreversible yet.
- Art. 12 / 13 unexercised — no arrival surface exists; a CLI you must invoke
  cannot prove "opening the app is a failure."
- `InlineRunner` means work still advances inside the caller's process. The boundary
  now exists; the daemon behind it does not.
