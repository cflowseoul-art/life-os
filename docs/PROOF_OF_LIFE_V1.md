# Proof of Life OS — v1

The smallest implementation that proves the Constitution. One capability, one Ask, one Ledger.

**Status: built, running, tested.** 11 constitutional tests pass; `tsc --noEmit` clean; a full
Career handover completes end to end across four separate processes.

---

## What was built

```
core/
  events/types.ts             the vocabulary — events, observations, asks, artifacts
  events/log.ts               append-only JSONL. no update, no delete.
  custody/engine.ts           hold / ask / keep. the only module that writes.
  capabilities/career/        data, domain logic, copy. proposes; never writes.
  cli.ts                      hand-over | ask | answer | ledger
  proof.test.ts               the Constitution as executable checks
```

~700 lines total. No new dependencies. Existing `src/` untouched (Art. 18 — nothing deleted
before its replacement runs).

---

## The flow, actually executed

Four separate `tsx` invocations. Each is a cold process with no shared memory — which is itself
the Art. 3 proof.

```
$ hand-over --company "" --role "Data Analyst" --jd inbox/jd.md
회사가 비어 있습니다.                                    ← refused. nothing written to disk.

$ hand-over --company "OpenAI" --role "Data Analyst" --jd inbox/jd.md
맡았습니다.

$ ask
이력서 첫 문단에서 무엇을 앞세울까요?
  OpenAI · Data Analyst
  공고에서 확인한 요건 5개
  · SQL · Python · Dashboard · Experiment · Product Analytics
  [req-1] SQL
  [req-2] Python

$ answer req-2
                                                        ← no output. Art. 2.
$ ask
                                                        ← no output. nothing needs the user.
$ ledger
OpenAI · Data Analyst — kept
    · SQL  (handover.jdText:6)      ...
    OpenAI · Data Analyst — 강조 순서
      1. Python  ← req-2
      2. SQL  ← req-1  ...
```

Nine events on disk. The "요건 5개" is five bullets actually parsed from the file the user handed
over — not a placeholder.

---

## Decisions, each against an article

**A terminal, not a screen.** `MIGRATION_PLAN_V2` Phase 2 requires the engine to run headless
with zero UI, and states why: the office was built UI-first and its model was never validated
independently. The CLI is the thinnest thing that can exercise handover → ask → ledger without
becoming an interaction design decision. Phase 3 decides what an Ask looks like; this proves what
an Ask *is*.

**JSONL on disk, not a database.** *Art. 14* — the log is readable with `cat` and meaningful with
Life OS deleted. *Art. 3* — `appendFileSync` returns after the bytes are written, so a handover is
acknowledged only once it is durable. Postgres would satisfy both, but adds infrastructure the
proof does not need.

**State is replayed on every call, never cached.** *Art. 3* — there is no in-memory source of
truth to lose. *Art. 11* — the Ledger is the same projection the engine uses, so it cannot drift
from what the engine believes.

**The capability proposes; the engine decides.** *Art. 7* — `career/index.ts` returns typed
values and writes nothing. A model would sit exactly there, and nothing downstream would change,
because the engine already refuses to trust it.

**Art. 9 is enforced in code, not in review.** `unbackedNumbers()` extracts every integer from a
proposed artifact and rejects any the capability cannot source. A rejected proposal becomes a
recorded `ProposalRejected` event rather than silence. This is the article most likely to be
violated by a future model, so it is the one given a machine check.

**Observations are quotes with line numbers.** *Art. 10* — `source`, `acquiredAt`, and
`confidence` are required fields on the type, so a fact without provenance cannot be constructed.
`handover.jdText:6` can be re-checked by hand against the file.

**One Ask, system-wide.** *Art. 4* — `outstandingAsk()` scans all holds, and `advance()` refuses
to raise a second. Two simultaneous handovers produce one Ask; the other waits.

**The Ask is a value question.** *Art. 6* — "what should lead your résumé?" is about what the user
wants to be known for. The system could rank by keyword frequency; it deliberately does not.

**`ask` prints nothing when nothing is needed.** *Art. 2* — the empty output is the product
working. Also *Art. 1*: there is no command that reports progress, because no article permits one.

**No `run`, `job`, `mission`, `workflow`, `team`, or `pipeline`** appears in any user-facing
string. *Art. 16*. The directory is `capabilities/`, not `teams/`.

---

## What was deliberately not built

Each would have been easy, and each is forbidden or unnecessary:

| Not built | Why |
|---|---|
| Status / progress command | Art. 1, 2 — no article permits it |
| A daemon that works in the background | Not needed to prove the model; `advance()` is the seam it would call |
| Notifications | Art. 12 — needs a delivery surface, which is Phase 3 |
| Any agent identity, name, or voice | Not required to prove custody. Art. 17 — no concept without need |
| A second capability | Phase 5. Art. 15 will be tested there, not asserted here |
| Model integration | Art. 7's seam exists; filling it changes nothing structural |
| Export command | The log file *is* the export (Art. 14) |
| Undo UI | `withdraw()` exists and is tested; a surface for it is Phase 3 |

---

## The eleven checks

| Article | Check |
|---|---|
| 3 Custody | incomplete handover refused, **and no file created** |
| 3 Custody | a new engine over the same log sees the Ask — survives restart |
| 4 The Ask | carries its own facts; options are named, never OK/Cancel |
| 4 The Ask | two handovers produce exactly one outstanding Ask |
| 4 The Ask | an unoffered answer is refused |
| 8 Transparency | every artifact section traces to a recorded observation |
| 9 Trust | a fabricated "7개" is detected as unsourceable |
| 9 Trust | the Ask states 3 when three bullets exist |
| 10 Provenance | every fact matches `handover.jdText:<line>`, has a time and confidence |
| 14 Durability | events parse as plain JSON with no model present |
| 18 Deletion | withdrawal appends one event; history length grows, state changes |

---

## Honest gaps

**The engine advances synchronously inside `handOver()`.** Real held work is asynchronous and
will need a scheduler. The seam is `advance(holdId)`, which is already idempotent by replay — but
"the system works while you are elsewhere" is asserted by the architecture, not yet demonstrated.

**Art. 5 (Approval and Irreversibility) is untested** because nothing here is irreversible.
Writing an artifact to the log is reversible by compensating event. The first outward action —
sending, spending — is when that article gets exercised, and it should get a test the day it
lands.

**Art. 12 and 13 are unexercised.** No notification, no arrival. The claim that "opening the app
is a failure" cannot be proven by a CLI you must invoke. This is the largest thing Phase 3 must
settle, and I do not want it recorded as proven when it is not.

**One config line was changed** — `vitest.config.ts` now includes `core/**/*.test.ts`. Without it
the constitutional tests do not run.

---

## How to run it

```bash
export LIFE_OS_LOG=.life-os/events.jsonl
npx tsx core/cli.ts hand-over --company "OpenAI" --role "Data Analyst" \
                              --jd prototypes/resume-tailoring/inbox/jd.md
npx tsx core/cli.ts ask
npx tsx core/cli.ts answer req-2
npx tsx core/cli.ts ledger
npx vitest run core/proof.test.ts
```
