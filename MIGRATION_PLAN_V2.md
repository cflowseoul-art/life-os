# MIGRATION_PLAN_V2.md

From the office prototype to Life OS v2. Companion to `docs/PROJECT_RESET_AUDIT.md`.

**Governing rule: freeze first, move second, delete last.** Nothing is deleted until its
replacement runs. This is not caution for its own sake — it is the specific defense against the
failure mode where working code is removed before its replacement is proven and the team ends up
with neither.

---

## Phase 0 — Freeze

*Goal: stop the bleeding and make the current state permanently retrievable.*

- **Stop the vertical office migration where it stands.** It is mid-flight: canvas and props are
  portrait, `gameStore`/`workflowBridge` are not, and Step 3 was never started. Finishing it
  produces a scene the product no longer wants. Do not revert it either — freeze it as-is.
- Tag the current commit `office-era-final`. This is the retrievable point for everything.
- Triage the four unknowns: `backups/`, `lifeos_audit.txt`, `lifeos_next_step.txt`,
  `LIFE_OS_SPEC.md`, `plugins-inventory.md`, `05-slice-01.md`. Read them; they predate the office
  and may hold live commitments. **Nothing moves until this is done.**
- Verify the office still builds and runs, and record how to run it in one paragraph. A frozen
  artifact nobody can start is a deleted artifact with extra steps.

**Exit criterion:** tagged, triaged, and a fresh clone can run the office in under five minutes.

**Explicitly not in this phase:** deletion, restructuring, and any new code.

---

## Phase 1 — Manifesto

*Goal: ratify the constitution and answer the questions that block everything downstream.*

- Ratify `LIFE_OS_MANIFESTO.md`. Until it is ratified it is one opinion among four documents;
  after ratification it is the thing every later decision is checked against.
- Write `docs/principles/` — the derived, checkable laws: the one law (does this take something
  off the user's mind?), the never-exists list, the ADRs promoted from `decisions.md`, and the
  findings rescued from archived work (bubble ≤28 chars and in-voice; one ambient beat per 20s;
  fabricated specificity is a trust violation).
- **Answer the four open questions** from the audit. Faces, Kitchen, notification-vs-ledger, and
  the triage results. These are cheap to answer now and expensive to answer after Phase 3.
- Run the twenty-sentences test from the mental-model review. It costs an afternoon and it either
  confirms the turn/custody primitive or kills it before anything is built on top.

**Exit criterion:** a ratified manifesto, a principles directory, four answered questions.

**Risk if skipped:** every Phase 2 naming decision gets re-litigated, which is how the office
happened.

---

## Phase 2 — Core Engine

*Goal: the custody engine exists and is provably correct, with no UI at all.*

- Restructure per the audit: `core/{events,custody,capabilities,infrastructure}`,
  `surfaces/`, `archive/office/`. Moves only — no rewrites in the same commits, so the diff stays
  reviewable.
- Promote the reducer out of the frontend into `core/custody/`. Rename its states to the
  manifesto's vocabulary: **held / asking / kept**. Strip Career specifics into
  `core/capabilities/career/`.
- Promote approval from a workflow branch to a first-class concept: **the Ask**. Typed, durable,
  attributable, one at a time. This is the atomic unit of the product and deserves to be the
  best-tested thing in the repo.
- Generalise `JobContext` → `Handover`: typed, validated in the engine, refused if incomplete.
- Wire the engine to the existing event log so every hold, ask, and answer is an immutable event
  with provenance. **This is what makes the Ledger possible and the manifesto's "no black boxes"
  literally true rather than aspirational.**
- Tests: the inventory suite stays; add coverage for the custody state machine and the Ask.

**Exit criterion:** a Career run executes end-to-end headless, emitting a complete, auditable
event trail, with zero UI.

**Why headless first:** the office was built UI-first and the model was never validated
independently. Inverting that order is the single most important process change in this plan.

---

## Phase 3 — Interaction Model

*Goal: decide what an Ask actually is, in the smallest possible form.*

- Design and build **one Ask**, on a phone. Not a screen — an interruption: the question, the
  context needed to answer it, two actions, one haptic. Nothing else.
- Design the **Ledger** as an audit surface: what is held, what was done, and why. Read-only.
  Explicitly not a workspace, explicitly not a home screen.
- Build the **handover** input: one field, no classification, no team picker.
- Kill criterion, stated in advance: if a person who has never seen Life OS cannot answer an Ask
  correctly with no explanation, the interaction model is wrong and Phase 4 does not start.

**Exit criterion:** three surfaces exist; a real Career run produces a real Ask on a real phone.

**Explicitly not in this phase:** agent portraits, animation, ambient life, eight domains,
notifications infrastructure.

---

## Phase 4 — First Production Screen

*Goal: one capability, all the way through, good enough to use daily.*

- Career end to end: hand over a JD → work is held → asks arrive when judgment is needed → the
  artifact is kept and retrievable.
- Attribution on every part of the output — the trust mechanism, not a nice-to-have.
- Real numbers only. Any figure an agent states is drawn from actual work or omitted.
- Delivery: the Ask arrives without the app being opened. If this is not possible in Phase 4,
  say so plainly rather than shipping a thing you must remember to check — that is the product's
  central claim and it should not be quietly deferred.
- **Only now:** delete what the audit marked DELETE. The replacement is running; the risk is gone.

**Exit criterion:** the author uses it for a real job application without opening the repo.

**This is the first phase that produces something a user could want.** Phases 0-3 produce
correctness; this produces value.

---

## Phase 5 — Future Capabilities

*Goal: prove the model is domain-neutral by attacking it with its worst case.*

- Add a second capability as **data plus domain logic only** — no new interaction patterns. If it
  requires a new pattern, the pattern was wrong and that is a Phase 3 defect surfacing late.
- Build the second capability from the *hardest* domain available, not the easiest. Kitchen or
  Health, not Travel. Travel is project-shaped like Career and will falsely confirm the model.
  Health has no artifact and never completes — if custody survives Health, it survives anything.
- Watch for the meal-plan graveyard: output that is beautiful, correct, and never acted on. If
  the second capability produces artifacts nobody adopts, the model needs an *adopted* state
  before a third capability is added.
- Revisit the archive deliberately, once: does anything frozen in `archive/office/` now have a
  home? Portrait rendering and ambient-life budgeting are the two candidates.

**Exit criterion:** two capabilities, structurally identical, no special-cased surface code.

---

## What this plan refuses to do

- **No parallel v2 build while v1 runs.** The office is frozen, not maintained.
- **No deletion before Phase 4.** Stated three times because it is the rule most likely to be
  broken during Phase 2's restructuring.
- **No new domains before two work.** Eight teams on a home screen was structure invented ahead
  of demand; adding domains is the most tempting and least useful thing available at every phase.
- **No UI in Phase 2.** The temptation to "just see something" is exactly how UI-first happened
  the first time.

---

## Honest accounting

This plan discards roughly 9,800 lines of working frontend to an archive and deletes about 1,400
more. It keeps the backend nearly whole, along with the workflow reducer, approval semantics,
agent voice, and the resume pipeline.

The office was not a mistake — it was how we discovered that visible activity is not visible
obligation, which is the insight the entire manifesto rests on. It cost six months and it bought
the one idea the product needed. That is a reasonable price, and it is worth writing down so that
the next six months are spent on a question we have actually validated.
