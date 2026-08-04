# Life OS — Constitution

Binding engineering law. Derived from `LIFE_OS_MANIFESTO.md`, `PROJECT_RESET_AUDIT.md`, and
`MIGRATION_PLAN_V2.md`.

This document does not explain why Life OS exists. It states what Life OS is not permitted to
do. Every article is written so that a pull request can violate it, and so that a reviewer can
point at the violation without argument.

Scope: all code, copy, schema, and configuration in this repository. Frozen code under
`archive/` is exempt while it remains outside the build graph.

---

## Article 1 — Attention

**Law.** The system may spend the user's attention only when the user's judgment is the missing
input.

**Why.** Attention is the only resource the product consumes and cannot return. Any spend for
status, progress, reassurance, or engagement is a spend the user did not authorise.

**Compliant**
- An Ask is raised because two capabilities produced conflicting recommendations.
- Work completes and the user is told once.
- A held item requires a value decision only the user can make.

**Violation**
- A notification reading "3 items are still in progress."
- A weekly digest of what the system did.
- Any surface whose purpose is to show the user that work is occurring.
- A badge count anywhere in the product.

---

## Article 2 — Silence

**Law.** Silence is the default state; every output must be justified by an article of this
constitution.

**Why.** A system that must be checked has returned the burden it claimed to take. The reviewer's
question is never "is this output useful?" but "which article permits this output?"

**Compliant**
- The system holds twelve items for a week and says nothing.
- No output is produced when work fails but can be retried without judgment.

**Violation**
- "Your Career team is idle."
- Progress percentages delivered outside a surface the user explicitly opened.
- Any copy whose removal would not change what the user must do.

---

## Article 3 — Custody

**Law.** Anything handed to the system must be recorded durably before the handover is
acknowledged, and must survive process restart, client loss, and version upgrade.

**Why.** Custody is the product's central claim. State held only in memory, component state, or a
client-side store is storage, not custody, and a lost item is a broken promise.

**Compliant**
- A handover is persisted as an event, then acknowledged.
- Held work resumes correctly after the server restarts mid-run.

**Violation**
- Held work exists only in a React store or reducer.
- Acknowledging a handover before it is durably written.
- Any held state that a page reload can destroy.

---

## Article 4 — The Ask

**Law.** An Ask must be answerable using only what it presents, must offer explicit options, and
only one Ask may be outstanding to the user at a time.

**Why.** The Ask is the product's atomic unit. An Ask that requires the user to go and find
context has handed back the labor it was meant to absorb.

**Compliant**
- The Ask states the decision, the relevant facts, and two named actions.
- A second Ask arising while one is outstanding waits in the engine.

**Violation**
- "Review the draft and let me know." (no options)
- An Ask requiring the user to open another surface to understand it.
- Two Asks presented simultaneously, or a list of pending Asks shown as a queue.
- An Ask whose options are "OK" and "Cancel".

---

## Article 5 — Approval and Irreversibility

**Law.** Any action that spends money, transmits content to a third party, or cannot be undone
by a compensating event must be gated by an Ask, and the Ask must name the specific consequence.

**Why.** The system acts on the user's behalf in the world. Autonomy is bounded exactly at the
point where an error cannot be withdrawn.

**Compliant**
- "Send this message to 김민수?" with the message shown in full.
- A purchase Ask that names amount, payee, and payment method.
- A reversible edit executes immediately with undo available.

**Violation**
- Sending, posting, purchasing, or scheduling with a human on the strength of an inferred
  intent.
- An Ask that says "Proceed with recommended actions?" without enumerating them.
- Treating a prior approval as authorisation for a later, similar action.

---

## Article 6 — Human Judgment

**Law.** The system absorbs bookkeeping and returns judgment; it must not decide questions of
value, risk tolerance, or relationships on the user's behalf.

**Why.** The product's legitimacy rests on the user remaining the author of their own life. A
system that optimises values it was never given is not serving the user.

**Compliant**
- The system prepares three options with tradeoffs stated and asks which the user prefers.
- The system declines to rank two job offers and instead surfaces what differs.

**Violation**
- Choosing between two offers because one scores higher on an internal metric.
- Inferring a value preference from past behaviour and applying it silently to a new domain.
- Any hidden scoring function that determines an outcome the user would have decided differently.

---

## Article 7 — AI Autonomy

**Law.** A model may only produce a typed proposal; execution requires server-side validation
and authorisation that does not consult the model.

**Why.** Inherited from ADR-003 and retained without amendment. A model that can write directly
to state can write anything, and no audit trail can undo that.

**Compliant**
- Model output is parsed into a typed command, validated, then executed or rejected.
- Validation failure produces a recorded rejection, not a retry loop that eventually succeeds.

**Violation**
- Model output written to storage without a validation step.
- A validator that asks a model whether the command is valid.
- Free-text model output rendered directly into a user-facing surface as fact.

---

## Article 8 — Transparency

**Law.** Every action the system takes must be openable to show what it did, what inputs it used,
and what it assumed.

**Why.** Custody without inspectability is a black box holding your life. The user's ability to
verify is what makes delegation rational rather than faithful.

**Compliant**
- Every event records actor, inputs, capability, and timestamp.
- An artifact section can be traced to the capability and inputs that produced it.

**Violation**
- An action whose reasoning is not reconstructible after the fact.
- Logging the outcome but not the inputs.
- Reasoning available in development builds only.

---

## Article 9 — Trust

**Law.** Every quantity, name, date, or citation the system states must originate in real data;
placeholder and illustrative values are prohibited in user-facing output.

**Why.** A single invented number destroys the user's ability to trust any number. The cost of a
fabricated detail is not the detail — it is every true statement that follows it.

**Compliant**
- "요건 5개를 찾았습니다" appears only when five requirements were actually extracted.
- A count that cannot be computed is omitted, and the sentence is written without it.

**Violation**
- Hardcoded example counts shipped in agent copy.
- Rounding an unknown to a plausible-looking figure.
- A citation to a document the system did not read.

---

## Article 10 — Memory and Provenance

**Law.** Every fact the system holds must carry its source, its author, its acquisition time, and
its confidence; facts without provenance may not be used in an Ask or an artifact.

**Why.** Custody over time means answering "how do you know that?" for anything the system acts
on, including facts it inferred from earlier facts.

Source and author are different questions and both must be answerable. The source is where the
evidence came from; the author is who asserts the fact is true. Neither may be substituted for
the actor that caused the event to be written — a runner recording what the representative said
is not the one claiming it.

An author that is not known is recorded as unattributed. It is never inferred, and never
back-filled from the actor: a guessed author is worse than an absent one, because it cannot be
told apart from a real one.

**Compliant**
- A stored preference records the utterance and date it came from, authored by the representative.
- An inference records the facts it derived from, authored by whoever inferred it.
- A fact recorded before authorship was carried reads as unattributed, permanently.

**Violation**
- A user profile field with no origin.
- Treating an inference as an observation.
- Presenting stale data without indicating when it was acquired.
- Naming the event's actor as the author of a fact it merely transcribed.

---

## Article 11 — The Ledger

**Law.** The Ledger is read-only; no work may be initiated, assigned, or completed from it, and
no state may exist that is only reachable there.

**Why.** A workspace is where the user labors; a ledger is where the user verifies. The moment
work happens in the Ledger, the user is the clerk again and the product's claim collapses.

**Compliant**
- The Ledger shows held items, completed work, and reasoning.
- Every item in the Ledger is a projection of events recorded elsewhere.

**Violation**
- An action button in the Ledger.
- A "needs attention" section in the Ledger that the user is expected to work through.
- State that exists only as a Ledger row.

---

## Article 12 — Notifications and Interruption

**Law.** Only two events may generate a notification — an outstanding Ask, and the completion of
held work — and no more than one interruption may be delivered at a time.

**Why.** The notification channel is the product's most powerful and most abusable surface.
Restricting it to two causes makes its meaning learnable and its trust durable.

**Compliant**
- One notification for one Ask.
- Completion of five items overnight produces at most one notification.

**Violation**
- Notifying that work has started, is progressing, or was retried.
- Re-notifying an unanswered Ask more than the schedule defined in principles.
- Any notification whose purpose is to return the user to the product.

---

## Article 13 — Interfaces

**Law.** No surface may require the user to open the product for the system to remain correct,
and no capability may introduce a surface type that does not already exist.

**Why.** Opening the app is a failure state. A capability that needs its own screen has failed
the domain-neutrality test and will fragment the product into apps.

**Compliant**
- All held work remains correct whether or not the user ever opens anything.
- A new capability renders through the existing Ask, Handover, and Ledger surfaces.

**Violation**
- A capability that ships a bespoke screen.
- A state that only advances when a component mounts.
- A "review your week" flow the user must complete for the system to stay accurate.

---

## Article 14 — Durability

**Law.** All user-owned data must remain meaningful and exportable if every model, agent, and
capability is removed.

**Why.** The user's life is not our runtime's state. If the product ends, the user must keep
everything of theirs that it held.

**Compliant**
- Artifacts and events are stored in open, self-describing formats.
- Export produces files that make sense with no Life OS present.

**Violation**
- Data whose meaning requires a model to interpret.
- Storing an embedding or model-specific structure as the primary record.
- Export that requires the product to be running to be useful.

---

## Article 15 — Capabilities

**Law.** A new capability may add data, domain logic, and copy only; it may not add interaction
patterns, states, or user-facing nouns.

**Why.** The domain-neutrality claim is only true if it is enforced. The first capability that
adds a pattern makes the second capability's pattern inevitable.

**Compliant**
- Kitchen ships as a manifest, domain logic, and voice, reusing every existing surface.
- A capability requests a new *state* and is refused; the state is added to core first, for all.

**Violation**
- A capability-specific Ask type.
- A capability that needs its own status vocabulary.
- Special-cased surface code branching on capability identity.

---

## Article 16 — Naming

**Law.** No user-facing surface may use a noun drawn from the system's internal structure, and no
internal directory may use a noun that the product forbids on its surfaces.

**Why.** Directory names become code nouns, code nouns become copy, and copy becomes the user's
mental model. The office reached the interface through exactly this path.

**Compliant**
- Internal `capabilities/`, never `teams/`.
- User-facing words are ones the user has said out loud.

**Violation**
- "Mission", "workflow", "pipeline", "agent pool", "run", "job" in user-facing copy.
- A directory named `teams/`, `missions/`, or `office/` outside `archive/`.
- Exposing a stage identifier in an interface.

---

## Article 17 — Complexity

**Law.** No pull request may introduce a user-facing concept, setting, or state without removing
one, and configuration may not be used to defer a product decision.

**Why.** Every tool in this category became an obligation one reasonable feature at a time. A
budget that must be balanced is the only mechanism that has ever stopped it.

**Compliant**
- A new state replaces two existing ones and the PR shows the removals.
- A disputed default is decided and shipped as a decision.

**Violation**
- A preference pane entry added because the team could not agree.
- A fourth item state introduced alongside three existing ones.
- "We'll let users configure it" as the resolution of a design debate.

---

## Article 18 — Deletion

**Law.** No user data may be destroyed; corrections are recorded as compensating events, and code
deletion requires the replacement to be running in production first.

**Why.** Inherited from ADR-002 for data. Extended to code by the audit: deleting working code
before its replacement is proven is how a team ends up with neither.

**Compliant**
- A mistaken hold is withdrawn by appending a withdrawal event.
- Office code is deleted in Phase 4, after the replacement ships.

**Violation**
- Mutating or removing a historical event to fix an error.
- A hard delete of user content behind any interface.
- Removing a subsystem in the same PR that introduces its replacement.

---

## Article 19 — Archives

**Law.** Archived code must remain buildable and runnable, must be excluded from the build graph,
and may never be deleted.

**Why.** Freezing is what makes retirement possible. An archive that cannot be run is a deletion
with extra steps, and the team will resist the next retirement because of it.

**Compliant**
- `archive/office/` builds from a clean clone with documented steps.
- Archived code is exempt from lint and dependency upgrades but not from being runnable.

**Violation**
- Archiving by deleting and relying on git history.
- An archived subsystem that no longer starts.
- Archived code imported by live code.

---

## Article 20 — Research

**Law.** No specification may be written for a premise that has not been validated, and the
active research directory must not grow without a document leaving it.

**Why.** Forty-seven documents for one unshipped screen was the measurable symptom of the failure
this reset corrects. Documentation volume is a leading indicator of unvalidated work.

**Compliant**
- A design document is written after the premise is tested with users or with a prototype.
- A resolved question is moved to `archive/` or promoted to `principles/`.

**Violation**
- A multi-step implementation plan for an unvalidated interaction.
- Research documents accumulating while nothing ships.
- A document that supersedes another without the superseded one being moved.

---

# Engineering Checklist

Every pull request must answer all ten. An unanswered question blocks merge.

1. **Does this increase what the user must hold?** Anything to remember, check, maintain, or
   configure is a rejection regardless of value. *(Art. 1, 17)*
2. **Which article permits any new output this adds?** Name it. Silence is the default. *(Art. 2)*
3. **Can the user inspect why this happened?** Show the recorded inputs and assumptions. *(Art. 8)*
4. **Does anything here state a fact the system did not actually derive?** *(Art. 9)*
5. **If AI disappeared tomorrow, would the user's data still make sense?** *(Art. 14)*
6. **Does any new state survive restart, reload, and version upgrade?** *(Art. 3)*
7. **Does this add an irreversible or outward-facing action, and is it gated by an Ask that names
   the consequence?** *(Art. 5)*
8. **Could a capability need to be special-cased because of this?** *(Art. 15)*
9. **Do any new nouns appear in copy or directories, and are they permitted?** *(Art. 16)*
10. **What did this PR remove?** If nothing, justify the net addition against the budget.
    *(Art. 17)*

---

# Decision Filter

Applied before a feature is designed, not after. Recorded in the proposal; a proposal that cannot
answer all four is not yet a proposal.

### 1. Should we build it?

Answer with the one law: **does this take something off the user's mind, or put something on
it?** Anything that puts something on their mind is refused, including things users request.
"Users are asking for it" is not an answer to this question — it is the sound of the temptation
the constitution exists to resist.

### 2. Why?

Name the specific thing the user currently holds that they will stop holding. If it cannot be
named as a burden that disappears, the honest answer is that this is a feature we want and not
one the product needs.

### 3. What principle does it strengthen?

Cite the article. A feature that strengthens no article is decoration, and decoration in this
product costs attention.

### 4. What principle does it weaken?

**Required. "None" is not an accepted answer.** Every real feature trades against something —
usually Attention, Complexity, or Silence. A proposer who cannot name the cost has not understood
the proposal, and the review should stop there.

---

# Amendment

Articles are amended by pull request against this document, with the superseded text retained in
`archive/`. An amendment must state which article it changes, what evidence justifies the change,
and what the constitution loses. Amendments made to unblock a feature currently in review are
refused.
