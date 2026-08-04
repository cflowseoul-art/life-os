# Current Phase

## Phase 2 — Career Knowledge

**Status:** not started. Phase 1 complete and approved.

---

## Goal

Career owns the representative's professional memory. It is permanent, shared by
every Career employee, and it is the reason no Career employee may ever ask for
information Career already holds.

> Never ask: "이력서를 올려 주세요." Career already owns it.

---

## Scope

Build `Career Knowledge` as a real, owned store covering:

representative profile · career history · résumé · portfolio · projects ·
achievements · KPIs · technical skills · interview history · application
history · recruiter feedback · strengths · weaknesses · preferred industries ·
preferred roles

Every entry is a `KnowledgeFact` carrying source, author, acquisition time, and
confidence. The vocabulary extends `core/capabilities/career/facts.ts`, which
today declares one type (`jd_requirement`). The kernel does not change.

---

## Prerequisites — all met

- **Employees are addressable.** `Author`'s `{ kind: "employee"; employeeId }`
  variant can be constructed from `employeeForResponsibility(id).id`. A fact
  authored by an employee — recruiter feedback recorded by application
  operations, an assessment by the interview coach — is expressible. This was
  the blocking dependency on Phase 1.
- **Career's six responsibilities exist and are assigned**, so the readers of
  this knowledge are already named.
- **The fact model is settled** and must not be revisited.

---

## Decisions still open

1. **Who may author a Career Knowledge fact** — the representative only, or
   employees too? The `Author` type permits both. This determines whether
   knowledge is an authored durable store or an event-derived projection.
   `core/capabilities/home/memory.ts` is **not** the model: a résumé is not
   reconstructible from utterances, and deriving one would invent the provenance
   the fact model exists to guarantee.
2. **A confidence scale for interpretive facts.** `INFERENCE_CONFIDENCE = 0.5`
   is currently a declared constant, not a measured one. More inference types
   land in this phase, so the scale should be settled first.

---

## Seed data

`prototypes/resume-tailoring/source-data/` already holds hand-verified profile,
skills, achievements, positioning, constraints, experiences, projects, and
interview material with a canonical tag index. That content becomes product
data.

Note the prototype's own rule, which carries over: provenance flows downstream
only. A résumé is a generated artifact; knowledge is never back-filled from one.

---

## The gap rule

A fact missing from Career Knowledge is a reported **gap**. Never a question back
to the representative, and never an invention. This is the rule that makes
"please upload your resume" structurally impossible rather than merely
discouraged.

---

## Explicitly out of scope

Job Fit rebuild · résumé generation · the stage machine · UI work · splitting
Career's runner into per-responsibility runners · QA fixes from
`QA_BACKLOG.md` unless this phase requires them.
