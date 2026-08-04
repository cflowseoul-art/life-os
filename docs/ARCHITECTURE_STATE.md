# Architecture State

What the system **is** today. Not how it got here — see `CHANGELOG.md` for that
and the phase reports for the reasoning behind each change.

Canonical as of Phase 1.

---

## The chain

```
Employee            who works here
    │ assigned to
Responsibility      what someone is accountable for
    │ grouped into
Capability          business logic
    │ executed by
Runner              execution
```

Each arrow is one-way. A capability never resolves an employee. A runner never
chooses one. A department never stands in for one.

## Layers

```
kernel          events, custody, knowledge facts    core/events, core/custody
company         organization, routing, orders       core/company
capabilities    business logic, one per department  core/capabilities/<dept>
infrastructure  storage, OCR, ledger, identity      core/infrastructure
surface         desk API, React screen              core/desk-api.ts, frontend
```

The kernel depends on nothing. Capabilities depend on kernel contracts. The
company layer coordinates. Infrastructure implements ports the inner layers
define. No domain code imports a database, AI SDK, OAuth SDK, OCR SDK, or search
SDK.

---

## Knowledge

Every fact the system holds is a `KnowledgeFact`:

```ts
{ id, type, value, source, author, acquiredAt, confidence, derivedFrom? }
```

`type` and `value` are **owned by the department that wrote them**. The kernel
stores and transports both and never inspects either. There is no global domain
vocabulary; each department declares a discriminated union in its own
`facts.ts` and narrows on read.

**Three separate concepts, never collapsed:**

| Field | Lives on | Answers |
|---|---|---|
| `actor` | `EventEnvelope` | Who caused this event to be written |
| `author` | `KnowledgeFact` | Who asserts this fact is true |
| `source` | `KnowledgeFact` | Where the evidence came from |

**Author** is one of `representative`, `employee`, `system`, `external`,
`unattributed`.

**Confidence** means: how strongly does the cited source support this exact
stored value? Direct statement from a source of record is `1`. Any system or
employee inference is below `1`. For an externally reported claim, `1` means the
source did report it — not that it is objectively true.

**Persisted schema version 3.** Events written under versions 1–2 are upcast on
read, never rewritten: their prose statement is preserved verbatim as an
`unstructured` value and their author is `unattributed`. Both storage adapters
share one upcast function.

---

## Organization

**Employees** (`core/company/employees.ts`) — the roster: who works here. Nothing
else. Roster order carries no meaning.

**Responsibilities** (`core/company/responsibilities.ts`) — typed
`ResponsibilityId` union, one assignment table mapping each to exactly one
employee. Thirteen declared. Replacing an employee is editing one `employeeId`
here.

**Capabilities** (`core/company/manifest.ts`) — declare `responsibilities[]`,
one `accountableFor`, scope, routing signals, office floor, and a `runners` map
from responsibility to module. A capability may declare more responsibilities
than it can execute; Career declares six and staffs one.

**Reaching a person.** `employeeForResponsibility(id)` and
`signature(responsibilityId)` are the only paths. There is no lookup by
department, no duty string, and no fallback of any kind — an unassigned
responsibility, an unknown employee, or a missing runner is an error at the
point of use.

**Dispatch** is keyed by `ResponsibilityId`. A runner declares the one
responsibility it executes and is refused at load if it declares another.

---

## Custody

Work enters as a `HandedOver` event and becomes a **hold**. The custody engine
does everything that does not require the representative, then stops and raises
at most one Ask system-wide. Holds are `held → asking → kept | withdrawn`.

**Work orders** are a projection over the same events:
`accepted → assigned → working → awaiting → completed | withdrawn`. Recording a
fact does **not** advance an order — knowing something is not starting
something, and no work-start event exists yet.

Corrections append. Nothing is mutated or deleted.

---

## Departments

| Capability | Scope | Runs | Fact types |
|---|---|---|---|
| career | personal | yes | `jd_requirement` |
| home | household | yes | `purchase`, `discount`, `depletion`, `preference` |
| finance | household | yes | `observation`, `inference`, `unavailable` |
| health | personal | no | — |
| asset | household | no | — |
| treasury | household | no | — |

A disabled capability still owns its work, still takes custody, and still
reports that it cannot execute yet. It is never a refusal.

---

## Reporting

One report per piece of work, signed by the employee accountable for the
responsibility — never by a department. Every department supplies a
`ReportTemplate` with a `compose()` and a `displayFact()`.

Facts reach the surface **already written** by the department that owns them.
The desk carries `{ id, text, source, author, confidence, acquiredAt }` and no
`type` or `value`, so no screen can branch on a vocabulary that is not its own.

---

## Rules that hold everywhere

- Events are the only history. Projections are derived and rebuildable.
- AI never writes to storage; it may only propose a typed command.
- Only explicit user statements change household state. Consumption is never
  inferred.
- Every command and event carries household scope and actor identity.
- Destructive, bulk, permission, and financial actions require confirmation.
- No graph database, microservices, plugin marketplace, or message broker before
  a proven requirement.
