# Phase 0.5 — KnowledgeFact Foundation

# Summary

**Objective.** Replace the kernel's `Observation` type with `KnowledgeFact`: a
department-owned `type`/`value` pair plus a required `author` that is distinct
from the event's actor. This is groundwork. It adds no feature and changes no
user-facing behaviour.

**Commit.** `4523d77` — *refactor(kernel): Observation becomes KnowledgeFact*

**Branch.** `recovery/mobile-ui-20260802`

**Overall result.** Complete. 21 files, +1097 / −173. Persisted schema version
3. Core typecheck clean. 100 tests: 97 pass, 3 fail — all three failed
identically before this work and are documented under *Remaining Technical
Debt*.

---

# KnowledgeFact

```ts
type Author =
  | { kind: "representative"; userId?: string }
  | { kind: "employee"; employeeId: string }
  | { kind: "system" }
  | { kind: "external"; name: string }
  | { kind: "unattributed" };

type KnowledgeFact<TType extends string = string, TValue = unknown> = {
  id: string;
  type: TType;
  value: TValue;
  source: string;
  author: Author;
  acquiredAt: string;
  confidence: number;
  derivedFrom?: string[];
};
```

**`id`** — stable within its hold. Referenced by `AskOption.derivedFrom` and
`ArtifactSection.derivedFrom`, which is how Art. 8 traceability works.

**`type`** — the department's vocabulary. The kernel never reads it. There is
deliberately no global enum: a shared vocabulary would put Career (or Home, or
Finance) back inside the kernel, which is the coupling this phase exists to
prevent.

**`value`** — the department's shape, discriminated by `type`. Opaque to the
kernel.

**`source`** — where the evidence came from, precise enough to re-check by hand:
`handover.jdText:12`, `receipt:3`, `거래내역 9행`.

**`author`** — who asserts the fact is true.

**`acquiredAt`** — when the fact entered the company.

**`confidence`** — how strongly the cited source supports *this exact stored
value*. Not importance, not usefulness, not general truth. A direct statement
from a source of record is `1`. A system or employee inference is always below
`1`. For an externally reported claim, `1` means "the source did report this",
not "this is objectively true".

**`derivedFrom`** — fact ids this was derived or inferred from. Absent for
direct facts. Carried and tested, but nothing populates it yet.

## actor vs author vs source

Three distinct questions that were previously two, and are easy to re-collapse:

| Field | Lives on | Answers |
|---|---|---|
| `actor` | `EventEnvelope` | Who caused this event to be written |
| `author` | `KnowledgeFact` | Who asserts this fact is true |
| `source` | `KnowledgeFact` | Where the evidence came from |

They differ routinely. A runner importing something the representative said last
month has `actor` = the runner, `author` = the representative, `source` = the
original utterance. Substituting actor for author would attribute the
representative's own statement to the machinery that filed it.

`Actor` cannot serve as `Author`: its `capability` variant names a *department*,
not a person, and any employee may author a fact.

## Why Observation was removed

`Observation` carried a single prose `statement: string`. It had nowhere to put
structured data, so departments encoded structure into Korean sentences and
parsed it back out with regular expressions — `우유 1L · 2개 · 3,000원` split on
`" · "`, `선호 · X` matched by regex, `[추론] X` read by string prefix.

Those prefixes were type fields in disguise. Finance's `[관찰]` / `[추론]`
distinction is the observation-vs-inference separation `AI_COMPANY_ARCHITECTURE`
§5 requires, and it was surviving as a naming convention inside a sentence.

`Observation` also had no author. Authorship existed on the envelope and was
discarded at projection, so every fact became anonymous the moment it was read.

---

# Migration

**Schema version 2 → 3.** One bump for both changes.

**Read-time upcast, never a rewrite.** `core/events/migrate.ts` exports
`upcast(envelope)`, wired into both read paths: `EventLog.read()` (file) and
`toEnvelope()` (Postgres). A stored shape therefore means the same thing
whichever adapter loaded it. Nothing on disk or in the table is modified — Art.
18 forbids editing history to correct a shape, and a rewrite would destroy the
only record of what was actually known at the time.

**The mapping.** A legacy `ObservationRecorded` event becomes
`KnowledgeFactRecorded` with:

| Legacy | Becomes |
|---|---|
| `observation.statement` | `value`, verbatim |
| — | `type: "unstructured"` |
| — | `author: { kind: "unattributed" }` |
| `observation.id` / `source` / `acquiredAt` / `confidence` | preserved exactly |

`upcast` is idempotent: a current-shape event passes through untouched, and the
envelope keeps its recorded `schemaVersion`, so it continues to report which
version actually wrote it.

## Compatibility decisions

**Legacy prose is not parsed by the kernel.** The statement is preserved as an
opaque string. Only the department that wrote a sentence knows what it meant, so
each department reads its own legacy prose in a clearly-marked `── Legacy ──`
block in its `facts.ts`. Every consumer above that block sees typed facts
regardless of when they were written.

**Both storage adapters share one upcast function.** A second implementation
would drift.

## Intentionally not migrated

**The author is never inferred.** The envelope's `actor` is available at upcast
time and is deliberately not borrowed. Inferring an author would fabricate
exactly the provenance the field exists to guarantee. Legacy facts stay
`unattributed` permanently. This is asserted by test.

**Prose is not back-parsed into typed values at migration time.** Parsing at the
boundary would bake one department's guess into the kernel and make the result
indistinguishable from a fact that was recorded correctly.

**`Artifact` is unchanged.** Finance also encodes `[관찰]` into artifact section
headings, and `core/reports/templates.ts` parses those by prefix. That is the
same defect on a different type and is out of this phase's scope.

---

# Kernel Changes

```
BEFORE                          AFTER

kernel                          kernel
  Observation                     KnowledgeFact<type, value>   ← opaque
    statement: string             Author                        ← required
                                      │
                                      │ transports, never inspects
                                      ▼
                                department  (capabilities/<dept>/facts.ts)
                                  owns the type vocabulary
                                  owns the value shapes
                                  narrows on read  (asHomeFact, …)
                                  formats for display  (display)
                                      │
                                      │ hands over written text
                                      ▼
                                surface  (desk-api → React)
                                  receives DeskFact { text, … }
                                  no type, no value, nothing to switch on
```

1. **`Observation` → `KnowledgeFact`** in `core/events/types.ts`, generic over
   `type` and `value` so departments can declare discriminated unions that
   remain assignable to the kernel's transport type.

2. **`Author` added** as its own type. `Actor` is unchanged — it answers a
   different question.

3. **Event renamed.** `ObservationRecorded` → `KnowledgeFactRecorded`, payload
   `observation` → `fact`.

4. **`Hold.observations` → `Hold.facts`** in `core/custody/engine.ts`.

5. **`SCHEMA_VERSION` 2 → 3**, with the change recorded in a comment beside the
   constant.

6. **`core/events/migrate.ts` added** — the only place that knows an older shape
   exists.

7. **Work-order coupling removed.** `core/company/work-order.ts` previously
   moved an order `assigned → working` on the first recorded observation.
   Recording a fact no longer advances anything: knowing something is not
   starting something, and there is no work-start event that would justify
   telling the representative otherwise. `working` remains reachable when the
   representative answers an Ask.

8. **Department fact formatting is registered, not switched on.**
   `ReportTemplate` gained `displayFact(fact) => string`, implemented by
   delegating to the department's own `facts.ts`. The desk asks for a line; it
   never formats one.

---

# Department Changes

Each department gained a `facts.ts` owning its vocabulary, its narrowing
function, its display function, and its legacy reader.

## Career

*Changed.* New `capabilities/career/facts.ts` declaring one fact type,
`jd_requirement`, with `value: { statement }`. `observe()` emits typed facts.
Author is `{ kind: "external", name: "채용공고" }` — the posting asserts its own
requirements; confidence `1` means the posting says this.

*Deleted.* Nothing. Career's legacy prose *was* the requirement statement, so it
reads back with no parsing at all.

*Simpler.* Marginally. Career is the department that benefits least from this
phase, because it had the least structure to lose. The union mechanism is now in
place for Career Knowledge to extend.

**Not added:** `skill`, `achievement`, `experience`, `application`. Types with
no writer and no reader are speculative vocabulary, not memory. They belong to
Career Knowledge, which is a later phase.

## Home

*Changed.* Four fact types — `purchase`, `discount`, `depletion`, `preference`.
Quantity, unit, and amount are fields rather than words in a sentence. Receipt
facts are authored `{ kind: "external", name: "영수증" }`; depletions and
preferences `{ kind: "representative" }`, because only an explicit statement may
change household state.

*Deleted.* Every prose writer, and three of four readers. `memory.ts` lost 81
lines and gained 43.

*Simpler.* `purchases()`, `depletions()`, and `preferences()` are now one-line
maps over typed facts. `inventory()` reads purchase facts directly, so a
discount can no longer be mistaken for stock by a parser that misread a
sentence — previously prevented only by a `parts[1] === "할인"` check.

## Finance

*Changed.* Three fact types — `observation`, `inference`, `unavailable`. The
`[관찰]` / `[추론]` distinction moved from a string prefix into the type field.
Observations are authored by the ledger (`external`), inferences by the company
(`system`).

*Deleted.* The `[${kind}] ${text}` serializer. The bracket labels survive as
*display* strings, which is what they always should have been.

*Simpler.* §5's rule — an inference is recorded as an inference and never
laundered into an observation — is now enforced by the data rather than by a
naming convention.

**Behaviour change, deliberate.** Inferences now carry
`INFERENCE_CONFIDENCE = 0.5` rather than `1`, because the confidence rule
requires an inference to sit below 1. A consequence: the screen already had a
`confidence < 1 → "미루어 본 것"` branch that could never fire, and it now fires
for Finance inferences. Existing code, newly reachable.

---

# Deleted Logic

| Removed | Location | Why unnecessary |
|---|---|---|
| `` `${name} · ${qty}${unit} · ${amount}원` `` serializer | `home/index.ts` | Quantity and amount are fields now |
| `` `${word} · 소진` `` serializer | `home-runner.ts` | `depletion` fact type |
| `` `선호 · ${about}` `` serializer | `home-runner.ts` | `preference` fact type |
| `.split(" · ")` + `parts.length !== 3` guard | `home/memory.ts` | Reads `value.name` / `value.quantity` |
| `/^(.+) · 소진$/` | `home/memory.ts` | Narrows on `type === "depletion"` |
| `/^선호 · (.+)$/` | `home/memory.ts` | Narrows on `type === "preference"` |
| `.split(" · ")` + `count === "할인"` guard | `home-runner.ts` `inventory()` | Discounts are a separate type |
| `` `[${kind}] ${text}` `` serializer | `finance-runner.ts` | `observation` / `inference` types |
| `event.observation.statement` reads (11 sites) | across `core/` | Typed access or `displayFact()` |
| Fact-triggered work-order transition | `work-order.ts` | Recording a fact is not progress |

The parsers were not rewritten — they were **deleted**, because the data they
were reconstructing is now present in the fact. What survives is one legacy
reader per department, reached only for `type: "unstructured"`, and nothing
writes those shapes any more.

---

# Tests

100 tests total: **97 pass, 3 fail.** All three failures pre-date this work.
New file `core/knowledge-fact.test.ts` (15 tests); `core/proof.test.ts` updated
and extended.

**Kernel** — *pass.* Legacy facts load without data loss; legacy authors remain
`unattributed` while the envelope actor is visibly not borrowed; the file on
disk is byte-identical after a read; upcast is idempotent; typed facts preserve
actor, author, source, confidence and `derivedFrom` across a round trip; author
is never `unattributed` for a fact the company wrote itself; kernel sources
contain no department vocabulary (asserted by scanning
`events/types.ts`, `events/log.ts`, `events/migrate.ts`, `custody/engine.ts`).

**Career** — *3 pre-existing failures*, one root cause; see below. All other
Career assertions pass, including the actor-vs-author separation.

**Home** — *pass.* Inventory correct from typed facts and from legacy prose;
discounts excluded from stock in both shapes; a stated preference is recorded
and read back with a `representative` author; legacy preferences and depletions
read correctly; a foreign department's fact narrows to `null` rather than being
coerced.

**Finance** — *pass.* Observation/inference distinction correct in typed facts
and in legacy bracket prose; untagged legacy prose maps to `unavailable`;
`INFERENCE_CONFIDENCE < 1`.

**UI** — *pass.* `templateFor("home").displayFact()` produces the expected line;
the screen source contains no department vocabulary and no `f.value` / `f.type`
reach. Work-order test confirms recording a fact leaves an order `assigned`.

---

# Remaining Technical Debt

1. **`INFERENCE_CONFIDENCE = 0.5` is declared, not measured.** No scale exists
   for interpretive confidence. The constant is documented as a stated value
   rather than a precise-looking invention, but it needs a real scale before
   more inference types land.

2. **Three pre-existing test failures, one root cause.**
   `capabilities/career/index.ts` drops requirements shorter than four
   characters, so `SQL` never becomes a fact — the fixture JD has three bullets
   and yields two. Either the filter is wrong or the tests are. This belongs
   with the Job Fit Analyst rebuild, not a patch.

3. **`test/inventory-command-parser.contract.test.ts` has no test suite** and
   fails to collect. Unrelated to this work; keeps the suite red.

4. **`derivedFrom` is unused in production.** Carried and tested, populated by
   nothing, because no department derives a fact yet.

5. **`Author`'s `employee` variant is unreachable.** No employee can be resolved
   as an author until the employee/capability/runner split lands.

6. **Artifact section headings still encode `[관찰]` prose**, parsed by prefix in
   `core/reports/templates.ts`. Same defect, different type.

7. **Frontend has 5 pre-existing `TS6133` errors** in `OfficeGame.tsx` and
   `LifeOfficeDemo.tsx`. Untouched by this work; verified identical before and
   after.

---

# Phase 1 Prerequisites

Phase 1 is the **employee / capability / runner split**. The rule it enforces:
employees own responsibility, capabilities own business logic, runners execute
it — so employees may change while capability code stays identical.

What must happen, in order:

1. **Break the capability→department→employee binding.**
   `core/company/manifest.ts` binds one `employeeId` per capability via
   `employeeFor(department)`, which returns the *first active employee in the
   department*, and `validateManifest()` enforces that binding at startup. A
   department therefore cannot express more than one employee. Employees must be
   declared against responsibilities instead.

2. **Teach the runner registry responsibility→runner dispatch.**
   `manifest.runnerModule` is a single string and `loadRunner()` caches one
   runner per capability id. Several responsibilities cannot each own a runner
   until this changes.

3. **Make `duty` a typed identifier and delete the silent fallback.** Duty
   strings are Korean literals duplicated between `employees.ts` and the runner,
   and `employeeForDuty()` silently falls back to the department's first
   employee when nothing matches. Renaming a duty currently misattributes work
   with no error.

4. **Sign by the employee who did the work.** `signature()` resolves through
   `employeeFor(department)`, so `desk-api.ts`, `work-order.ts`, and
   `reports/templates.ts` all attribute every responsibility to one person.

5. **Then make `Author`'s employee variant reachable.** It exists and is
   unusable until steps 1–4 land.

**Acceptance test for Phase 1.** Change a surname in the roster. Zero capability
files may be edited, zero capability tests may change, and every report must
re-sign correctly.
