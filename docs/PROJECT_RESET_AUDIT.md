# Life OS — Project Reset Audit

Architectural audit at the first inflection point. No code changed, nothing deleted, nothing
moved. This document is a judgment, not an action.

Audited: 47 documents under `docs/`, 3 root documents, `src/` (6,794 lines of backend),
`frontend/src` (12,299 lines under `life-office` alone), `prototypes/`, `test/`.

---

## Executive judgment

**The most valuable thing in this repository is not the office. It is the backend.**

`src/kernel`, `src/application`, `src/infrastructure` implement immutable events, projections,
compensating events, provenance, and a rule that AI may only propose typed commands that
server-side validation decides. Those were written months before the manifesto existed.

Read the manifesto's constraints back against them:

| Manifesto demands | Already built |
|---|---|
| "No black boxes — every action openable: what, why, what it assumed" | event log + provenance |
| The Ledger — an audit surface, not a workspace | projections over events |
| "No irreversible act without a question" | AI proposes, validation decides |
| Custody — the system holds it, not you | durable events, not UI state |

**The backend is a custody engine that was mislabelled as a household inventory system.** It
survives the reset almost entirely. The frontend does not.

The inverse is equally true and worth stating plainly: **roughly 12,000 lines of the frontend
were built to answer a question the product no longer asks** — "what does the room look like?"
That work is not waste; it is how we discovered the question was wrong. But it does not ship.

**Headline counts:** KEEP ~9,500 lines (backend + workflow engine + approval + personalities).
ARCHIVE ~9,800 lines (Pixi, pathfinding, sprite craft). DELETE ~1,400 lines (dead prototypes,
superseded duplicates). UNKNOWN ~2,000 lines (character rendering, mobile shell, capability
plugins).

---

## Category definitions used

- **KEEP** — survives the manifesto unchanged or with renaming only. Ships in v2.
- **ARCHIVE** — frozen, buildable, never deleted, not in the build graph. Retrieved if a future
  need matches. Craft we cannot cheaply recreate.
- **DELETE** — actively conflicts with the direction, or is dead weight whose continued presence
  creates confusion or false obligation.
- **UNKNOWN** — cannot be judged until the manifesto is ratified and one open question is
  settled. Each UNKNOWN below names its deciding question.

---

## 1. Architecture (`src/kernel`, `src/application`, `src/infrastructure`, `docs/01-architecture.md`, `docs/decisions.md`)

**Why it existed.** To keep domain concepts independent of replaceable technology — the layered
kernel/application/infrastructure/plugin split, with dependency direction enforced inward.

**Problem it solved.** Preventing AI SDKs, databases, and OAuth from contaminating domain logic;
making history auditable.

**Does the problem still exist?** More than before. Custody is *entirely* a claim about durable,
auditable state. A system that says "I am holding this for you" and cannot prove what it did is
not a product, it is a liability.

**Does the solution survive?** Yes, unchanged. The layering, the event model, the
proposal-validation split, and the compensating-event rule are all directly implied by the
manifesto's "no black boxes" and "no irreversible act without a question."

**Replacement cost.** 4-6 weeks and, more importantly, the design maturity encoded in the ADRs.

**Risk of deleting.** Severe. This is the only part of the project that is already correct.

**→ KEEP.** Rename to reflect what it actually is (see §Repository structure). `docs/decisions.md`
ADR-001 through ADR-003 become foundational principles, not legacy notes.

---

## 2. Workflow Engine (`workflow.ts`, 498 lines)

**Why it existed.** To drive the five-stage Career pipeline: stage order, phases, approvals,
stop/reject, logging.

**Problem it solved.** Turning a mocked multi-step process into deterministic, testable state.

**Does the problem still exist?** Yes — but renamed. "Workflow" is the supply-side word the
mental-model review condemned. The *mechanism* is right: something must own the progression of
held work and know when a human is required.

**Does the solution survive?** The reducer survives; the vocabulary does not. `STAGES`,
`assignee`, and stage titles are Career-specific and must become capability data rather than
core code.

**Replacement cost.** 1-2 weeks to rewrite, but the *semantics* — what happens on reject, what a
compensating transition looks like — took real thought and would be re-derived at similar cost.

**Risk of deleting.** High. This is the closest thing to a custody engine in the frontend.

**→ KEEP** the reducer and its semantics. **DELETE** the `STAGES` constant as core structure —
it becomes a Career capability manifest.

---

## 3. Workflow State + Reducer + `useWorkflowEngine` (`types.ts` 115, `useWorkflowEngine.ts` 74)

**Why it existed.** Typed state, typed events, one dispatch path, no side effects in the reducer.

**Problem it solved.** Making the run legible and testable.

**Does it survive?** Yes. `WorkflowState` maps almost one-to-one onto the manifesto's three
states: *held* (running), *asking* (awaiting_approval), *kept* (completed). The reducer already
refuses to start on invalid input — the "hand over" boundary, built before we had a name for it.

**Replacement cost.** Days. **Risk of deleting.** Moderate — cheap to rebuild but it is *correct*,
and correctness here was earned by iteration.

**→ KEEP.** Rename states to the manifesto's vocabulary during Phase 2.

---

## 4. Bridge (`adapter/workflowBridge.ts`, ~200 lines)

**Why it existed.** A single one-way writer translating workflow state into pixel state, so the
reducer never learned about rendering.

**Problem it solved.** Keeping the domain clean while a Pixi scene consumed it. Genuinely good
architecture — the direction of dependency was never violated.

**Does the problem still exist?** The *seam* does; the *destination* does not. There will still be
a translation from custody state to whatever surface renders it.

**Does the solution survive?** The pattern survives. The file does not — its entire vocabulary is
desks, paths, and phases.

**Replacement cost.** Days.

**→ ARCHIVE** as a reference implementation of the seam pattern. It is the cleanest example in
the repo of a boundary done right, and worth re-reading when the new surface is built.

---

## 5. Office (`OfficeGame.tsx` 791, `OfficeFloor.tsx`, `EmployeeSprite.tsx`, `layout.ts`, `useOfficeAnimation.ts`)

**Why it existed.** The founding metaphor: make AI collaboration visible as a workplace.

**Problem it solved.** Nothing, in the end. It made *activity* visible while the user needed
*obligation* visible. Three consecutive design documents converged on this independently.

**Does the problem still exist?** No. "Where is everyone" was never a question a user asked.

**Does the solution survive?** No. Rooms, desks, floors, and furniture are explicitly foreclosed
by the manifesto and by §VI of the product vision.

**Replacement cost.** Irrelevant — we would not rebuild it.

**Risk of deleting.** Low technically, **high emotionally**. This is the most-loved artifact in
the project and deleting it will feel like erasing the last six months. That is exactly why it
goes to ARCHIVE and not to DELETE: it should remain buildable and viewable forever.

**→ ARCHIVE** `OfficeGame.tsx` and the composed scene.
**→ DELETE** `OfficeFloor.tsx`, `EmployeeSprite.tsx`, `layout.ts`, `useOfficeAnimation.ts` — the
pre-Pixi emoji implementation, already superseded and dead in the build.

---

## 6. Pixi (`@pixi/react`, `game/` 4,281 lines + 25 sprite PNGs)

**Why it existed.** A canvas renderer for characters, chosen because Claude Office used it.

**Problem it solved.** Rendering animated characters at 60fps.

**Does the problem still exist?** **Unknown, and this is the single most consequential open
question in the audit.** The manifesto forbids "theater" and locomotion but keeps agent identity
and attribution. Whether identity is expressed as an animated portrait (needs a canvas or at
least Lottie/SVG) or as a static avatar with a presence ring (needs neither) is undecided.

**Replacement cost if removed and later needed.** 2-3 weeks plus the art.

**→ ARCHIVE** the renderer. **→ UNKNOWN** the dependency itself, decided by: *do agents have
faces that move?* Until that question is answered, `pixi.js` and `@pixi/react` stay in
`package.json` but out of the build graph.

---

## 7. Pathfinding + Navigation Grid + Path Smoothing + Collision (`systems/`, ~2,100 lines)

**Why it existed.** Agents needed to walk across a room without clipping desks or each other.

**Problem it solved.** "How does a character cross a room."

**Does the problem still exist?** **No. We deleted the room.** Both the product vision and the
mental-model review reached this independently: locomotion encodes nothing about whose turn it
is.

**Does the solution survive?** No.

**Replacement cost.** 3-4 weeks. A* with smoothing, dynamic obstacles, and collision avoidance is
non-trivial and this implementation is good.

**Risk of deleting.** Low product risk, real craft loss.

**→ ARCHIVE, intact and buildable.** This is the clearest ARCHIVE case in the repo: excellent
code solving a problem the product no longer has. Do not delete it — spatial reasoning may return
in a form nobody has predicted, and rewriting it from scratch would cost a month.

---

## 8. Camera (`adapter/camera-presets.ts`, `react-zoom-pan-pinch`)

**Why it existed.** A 1280×1024 canvas did not fit a 390px phone, so we needed pan, zoom, clamps,
and team presets.

**Problem it solved.** A problem created entirely by the office metaphor.

**Does the problem still exist?** No. Bounded cards cannot overflow, which is the point made in
product vision §7 — the clipping, corridor-width, and camera-clamp problems were all symptoms of
an unbounded world.

**Replacement cost.** Days. **Risk of deleting.** Low.

**→ DELETE.** Unlike pathfinding, this has no reusable core — it is clamp arithmetic specific to
a canvas that will not exist. It also caused two of the three regressions this project has
suffered.

---

## 9. Approval Flow (`ApprovalPanel.tsx`, approval branches in `workflow.ts`)

**Why it existed.** Destructive or judgment-requiring actions must not auto-execute — a
`CLAUDE.md` non-negotiable.

**Problem it solved.** The only point where the human's judgment enters the system.

**Does the problem still exist?** It is now **the entire product.** The manifesto's atomic unit is
"a question worth asking." Approval is not a feature of Life OS; it is Life OS.

**Does the solution survive?** The semantics survive completely — request, approve, reject,
reject-as-revision. The *presentation* (a panel in a side overlay) does not survive at all.

**Replacement cost.** The logic, days. The *earned understanding* that rejection is revision
rather than error — that came from design work and would be lost.

**Risk of deleting.** Critical. Nothing in the repo is more aligned with the manifesto.

**→ KEEP,** and promote: approval semantics move from a workflow branch to a first-class core
concept, `the Ask`.

---

## 10. Coffee System (`adapter/coffeeIdle.ts`, ~230 lines)

**Why it existed.** To make idle agents feel alive.

**Problem it solved.** The dead-office problem: four capsules sitting motionless.

**Does the problem still exist?** Partially. "Alive" is still a stated goal. But the manifesto
forbids theater — "agents performing labor for the user's entertainment" is named explicitly.
Coffee is, precisely, an agent performing non-labor for entertainment.

**Does the solution survive?** The *implementation* (a 500ms wall-clock loop walking a sprite to a
machine) does not. The *instinct* — that ambient life needs a strict global budget so it never
becomes noise — is a genuine design finding worth preserving in writing.

**Replacement cost.** Days. **Risk of deleting.** Low.

**→ ARCHIVE the code, KEEP the finding.** The one-beat-per-20-seconds global budget rule is
recorded as a principle; the walking implementation is frozen.

---

## 11. Speech Bubble (`shared/drawBubble.ts`, bubble expiry in `gameStore.ts`)

**Why it existed.** Agents needed to say what they were doing.

**Problem it solved.** It was, in the end, doing *all* the communicative work while the office
obstructed it — as noted in the AI Studio critique.

**Does the problem still exist?** Yes. Agent voice is retained by the manifesto (attribution,
personality, the Ask spoken in the agent's own words).

**Does the solution survive?** The renderer is canvas-specific and tied to the UNKNOWN in §6. The
*expiry mechanism* is a small correct idea. The 28-character constraint is a genuine finding.

**→ ARCHIVE** `drawBubble.ts` / `drawArm.ts` / `iconMap.ts` (craft).
**→ KEEP** the constraints as principles: short, in-voice, auto-expiring, never raw model output.

---

## 12. Job Context (`JobContext`, `isJobContextValid`, `EMPTY_JOB_CONTEXT`)

**Why it existed.** The workflow must not start on empty input; the reducer enforces it, not just
a disabled button.

**Problem it solved.** Explicit user intent before any work begins — a `CLAUDE.md`
non-negotiable ("only explicit user statements may change household state").

**Does the problem still exist?** Yes, and it generalises perfectly. "Hand over" requires a
well-formed handover, validated server-side.

**Does the solution survive?** Yes — as the first instance of a general pattern. Career needs
company/role/JD; Kitchen will need something else. The *shape* (typed context, validated in the
reducer, refused if incomplete) is the reusable part.

**Replacement cost.** Days. **Risk of deleting.** Moderate — losing the "validate in the reducer,
not the button" discipline would be a real regression in rigor.

**→ KEEP** as the prototype of `Handover`. The three Career-specific fields become capability data.

---

## 13. Agent Personalities (names, roles, voices, `STAGE_LINES` message table)

**Why it existed.** To give the five Career agents identity and role-specific progress language.

**Problem it solved.** Generic "업무중..." told the user nothing; role-specific lines make the work
legible.

**Does the problem still exist?** Yes. Attribution is named in the mental-model review as one of
three surviving ideas and elevated by the manifesto to a founding constraint — provenance is what
separates this from a chatbot.

**Does the solution survive?** Yes, with one correction already flagged: the message table's "5개"
and "3개" counts are fabricated decoration. Under the manifesto, **fabricated specificity is a
trust violation**, not a copywriting choice. Every number an agent says must be real or absent.

**Replacement cost.** Low mechanically, high in craft — this copy is good and in a specific voice.

**→ KEEP** names, roles, and voice. **→ DELETE** the fabricated counts.

---

## 14. Documents (47 files under `docs/`)

Assessed as five groups:

| Group | Files | Judgment |
|---|---|---|
| **Foundational** — `00-context`, `01-architecture`, `02-event-model`, `03-ai-contract`, `04-mvp`, `decisions.md`, `CLAUDE.md` | 7 | **KEEP.** Still true. `03-ai-contract` (AI proposes, never writes) is a manifesto principle already. |
| **Product direction** — `LIFE_OS_MANIFESTO`, `LIFE_OS_MENTAL_MODEL_REVIEW`, `LIFE_OS_PRODUCT_VISION` | 3 | **KEEP.** The manifesto is the constitution; the review is its reasoning; the vision is superseded in structure but its artifact-as-hero and attribution arguments are load-bearing. |
| **Superseded design** — `AI_STUDIO_VISION`, `VERTICAL_OFFICE_LAYOUT_PLAN`, `MIGRATION_VISUAL_PLAN` | 3 | **ARCHIVE.** Wrong conclusions, valuable reasoning. The Studio doc's own refutation is instructive. |
| **Migration logs** — `VISUAL_MIGRATION_STEP*` (18 files), `VERTICAL_OFFICE_STEP*`, `JOB_CONTEXT_*`, `COFFEE_IDLE_STEP1`, `SPEECH_BUBBLE_STEP1`, `WORK_DESTINATION_FIX`, `WORKFLOW_BUBBLE_MESSAGES`, `VISUAL_REGRESSION_*` | ~30 | **ARCHIVE, compressed.** Individually near-worthless; collectively they are the honest record of how a six-month wrong turn happened. Compress to one `office-era/POSTMORTEM.md` plus the raw files frozen beneath it. |
| **Uncategorised** — `LIFE_OS_SPEC`, `plugins-inventory`, `05-slice-01`, `JD_ARCHIVE_CHANGE`, `lifeos_audit.txt`, `lifeos_next_step.txt` | 6 | **UNKNOWN.** Not read in this audit; they predate the office era and may contain live commitments. Must be read before Phase 2. |

**The documentation itself is a finding.** 47 documents for one unshipped screen is a symptom:
we were writing specifications for work whose premise was never validated. Phase 0 should cap
active docs at a number we can actually hold.

---

## 15. Design Files / Migration Notes / Prototype Pages / Legacy Code

| Item | Judgment | Reason |
|---|---|---|
| `LifeOfficeDemo.tsx` (~470 lines) | **DELETE** | The only page in the app; entirely office + overlay shell. Nothing in it survives the interaction model. |
| `life-office.css` (668 lines) | **ARCHIVE** | The mobile shell (`lo-shell`, sheet, tab bar, FAB) is genuinely competent responsive work and may inform the Ask surface. The office half is dead. |
| `prototypes/resume-tailoring/` | **KEEP** | Real capability: roles, templates, source data, inbox/output. This is Career's actual substance and is independent of any UI. |
| `frontend/src/api/resume-api.ts`, `life-os-api.ts` | **KEEP** | The runtime seam to real work. |
| `useResumeProgress.ts` | **KEEP** | Backend run → state. Directly reusable as "held work reports progress." |
| `test/` (inventory suite) | **KEEP** | The only tests in the repo. They test backend behavior that survives. |
| `src/household-supplies/` (832 lines) | **UNKNOWN** | A complete second capability. Decided by: *is Kitchen the second team?* If yes, it is a head start; if no, it is an orphan. |
| `backups/`, `lifeos_audit.txt`, `lifeos_next_step.txt` | **UNKNOWN** | Not inspected. Must be triaged before restructuring — they may contain the only copy of something. |

---

## 16. Every folder under `frontend/src/components/life-office`

| Folder / file | Lines | Judgment | Note |
|---|---|---|---|
| `adapter/gameStore.ts` | ~380 | ARCHIVE | Store shape is Pixi-specific; the bubble-expiry idea is KEEP as principle |
| `adapter/workflowBridge.ts` | ~200 | ARCHIVE | Reference for the seam pattern (§4) |
| `adapter/constants.ts` | ~130 | DELETE | Pure coordinates; also holds two contradictory sources of desk truth |
| `adapter/camera-presets.ts` | ~200 | DELETE | §8 |
| `adapter/coffeeIdle.ts` | ~230 | ARCHIVE | §10 |
| `adapter/types.ts` | ~260 | ARCHIVE | Agent phases are locomotion vocabulary |
| `adapter/useOfficeTextures.ts` | ~60 | ARCHIVE | Sprite loading |
| `adapter/stubs.ts` | ~150 | DELETE | Scaffolding for a migration that is being abandoned |
| `game/` (19 files) | 4,281 | ARCHIVE | The whole scene |
| `game/shared/` (3) | 215 | ARCHIVE | Highest-craft-per-line code in the repo |
| `game/city/` (3) | 593 | ARCHIVE | Sky/building renderer — beautiful, unrelated to the product |
| `game/whiteboard/` (14) | 1,817 | ARCHIVE | 12 display modes; a product in its own right that no user asked for |
| `systems/` (7) | 2,116 | ARCHIVE | §7 |
| `workflow.ts` | 498 | **KEEP** | §2 |
| `types.ts` | 115 | **KEEP** | §3 |
| `useWorkflowEngine.ts` | 74 | **KEEP** | §3 |
| `useResumeProgress.ts` | ~60 | **KEEP** | Real runtime |
| `ApprovalPanel.tsx` | 59 | **KEEP** (logic) | §9 — semantics keep, presentation goes |
| `StageList.tsx`, `EventLog.tsx` | 73 | ARCHIVE | Correct components for the wrong hierarchy |
| `OfficeFloor.tsx`, `EmployeeSprite.tsx`, `layout.ts`, `useOfficeAnimation.ts` | ~410 | **DELETE** | Dead pre-Pixi implementation, superseded twice |

---

## Repository structure for v2

```
docs/
  manifesto/          the constitution. 1-2 files. changes almost never.
  principles/         laws derived from it + ADRs. every PR is checked against these.
  research/           open questions, actively being answered. must shrink.
  archive/
    office-era/       POSTMORTEM.md + 30 frozen migration docs

core/                 (was src/) — the custody engine. no UI vocabulary anywhere.
  events/             immutable log, projections, compensating events
  custody/            NEW: hold / ask / answer. the reducer promoted out of the frontend.
  capabilities/       career/, kitchen/ — manifests + domain logic. NOT "teams".
  infrastructure/     replaceable adapters

surfaces/             (was frontend/) — named for what they do, not what they are
  ask/                the interruption. the product's atomic unit.
  ledger/             the audit surface. verification, never work.
  handover/           the one input.
  shell/              shared primitives

archive/
  office/             frozen, buildable, excluded from the build graph
```

**Why this shape, and not a conventional one:**

**1. The three verbs are directories.** `handover/`, `custody/`, `ask/` are the manifesto's own
words. When a new engineer opens the repo, the product's thesis is legible from `ls`. A structure
named `components/`, `pages/`, `utils/` describes React; this describes Life OS. The office was
built inside a structure that described a rendering library, and it drifted for six months
without the structure ever objecting.

**2. `archive/` is top-level, not hidden.** Freezing work in a visible, buildable directory is
what makes deletion emotionally possible. The office is not being erased; it is being retired
with honors, and anyone can still run it. A `.old` suffix or a deleted branch would make the same
decision feel like loss instead of a decision.

**3. `capabilities/`, never `teams/`.** The mental-model review established that Team is
organisational structure leaking into the interface. Naming the directory `teams/` guarantees it
reappears in the navigation within a year, because directory names become nouns and nouns become
screens. `capabilities/` describes what the system can do, which is the honest framing.

**4. `surfaces/` instead of `frontend/`.** The manifesto states that opening the app is a failure.
"Frontend" implies a front to arrive at. "Surfaces" implies places the system touches you —
lock screen, notification, ledger — which is the actual delivery model.

**5. `core/` has no UI vocabulary and no framework import, enforced.** The existing
kernel/application/infrastructure discipline already achieves this; the rename makes the rule
self-describing rather than something you learn from `CLAUDE.md`.

**6. `research/` must shrink over time.** 47 documents for one unshipped screen was the
diagnosable symptom. Making research a directory with an explicit shrink expectation is a
structural check on the failure mode we actually experienced.

---

## Open questions blocking UNKNOWN items

Each UNKNOWN above resolves from one of these. They should be answered in Phase 1, not later.

1. **Do agents have faces that move?** → decides Pixi, sprites, `drawBubble`, portrait rendering.
2. **Is Kitchen the second capability?** → decides `household-supplies`.
3. **Does the Ask arrive as a notification, or is it collected in the Ledger?** → decides whether
   the mobile shell CSS has a future.
4. **What is in `backups/`, `lifeos_audit.txt`, `lifeos_next_step.txt`, `LIFE_OS_SPEC.md`?** →
   pure triage, but must precede any restructuring.

---

## The one recommendation

**Do not delete anything in Phase 0.** Freeze first, move second, delete last — and only after
the replacement runs. The vertical office migration should be stopped where it stands rather
than finished; it is half-complete, and completing it would produce a scene the product no longer
wants.

The migration plan is in `MIGRATION_PLAN_V2.md`.
