# Life OS — Mental Model Review

Adversarial product review. No code, no UI, no implementation.

Position: the Mission-first hypothesis is **wrong**, and it is wrong in a way that will not
show up until the sixth team is built, when it will be extremely expensive to fix.

---

## Verdict

The hypothesis under review:

```
Mission → AI Team → Artifact → History
```

Three of those four levels should not exist as user-facing concepts.

- **Mission** — wrong noun, borrowed from the runtime, fails 6 of 8 domains.
- **AI Team** — organisational structure leaking into the interface. Conway's law as navigation.
- **History** — a byproduct promoted to a primitive because it looked good in a diagram.
- **Artifact** — survives, and is the only level that was ever load-bearing.

The previous document (`LIFE_OS_PRODUCT_VISION.md`) argued, correctly, that *the artifact is the
main character and the agents are how it comes alive*. Then it built a four-level hierarchy with
Team as a navigational tier. **The vision contradicts itself in its own table of contents.** If
agents are implementation detail, "Team" cannot be a level the user navigates through — you do
not put CPU cores in the sidebar.

What follows is why, and what replaces it.

---

## The six fatal flaws

### Flaw 1 — Mission is a supply-side abstraction

"Mission" is the unit of work *for the orchestrator*. It is how the system batches a run: pick a
team, assign stages, execute, report. It is a scheduler concept.

The user has no scheduler. They have a want, expressed in a sentence.

This is the oldest failure in software: shipping the data model as the mental model. It killed
IBM's Activity-Centric Computing (a decade of research, "activities" as the universal
primitive), Google Wave ("waves"), and every "task-based UI" initiative Microsoft attempted in
the 2000s. Each was internally coherent and each required the user to learn the system's
bookkeeping before receiving value.

The tell is always the same: **the primitive is a noun no user has ever said out loud.** Nobody
has ever said "I'm going to start a mission." They say "I need to redo my résumé."

### Flaw 2 — Mission assumes completion, and most of life doesn't complete

A mission is bounded: it starts, it succeeds or fails, it ends, it becomes History. That shape
is true for exactly the domain we happened to build first.

| Team | Shape | Does "done" exist? |
|---|---|---|
| Career | episodic bursts | sometimes (this application) |
| Finance | continuous with periodic events | no |
| Kitchen | recurring rhythm | weekly, but never *done* |
| Health | continuous condition | **no** |
| Relationships | continuous, unbounded | **no** |
| Learning | slow accumulation | no |
| Travel | genuinely episodic | **yes** |
| Home | maintenance, ambient | **no** |

**Mission fits 2 of 8.** We validated the abstraction against Career and Travel — the two most
project-shaped domains in the list — and then generalised. That is textbook selection bias, and
it is invisible until Health ships and every screen says "no active missions" to a person whose
health is, at all times, active.

The deeper fault line: Life OS conflates **things being made** (a résumé, an itinerary) with
**things being kept** (your health, your home, your relationships). Those differ on whether the
verb ever stops. One primitive cannot span both unless it is neutral about completion — and
"Mission" is the least neutral word available.

### Flaw 3 — Mission is the most game-like word in English

The vision document explicitly targets "alive, premium, calm — not game-like." Then names the
core primitive after quests.

Mission carries military and video-game connotation in both English and Korean (미션 = a quest,
a challenge, something in a variety show). It implies stakes, drama, and a scoreboard. It is the
vocabulary of Duolingo streaks and fitness-app badges — the exact register the document says to
avoid.

It also collides with Apple's own product vocabulary: **Mission Control** is macOS window
management, shipped since 2011. Apple would not ship a second, unrelated "Mission" concept.

### Flaw 4 — Team-as-navigation forces the user to classify before they can speak

To start work, the Mission model requires: pick a team → start a mission → describe it. The user
must correctly route their own intent before the system will listen.

This is precisely the tax that AI is supposed to abolish. The entire reason a language interface
is valuable is that **classification becomes the machine's job.** A product that makes the human
choose between "Career" and "Learning" before they can say "I want to switch into data science"
— an ask that is honestly both — has inverted its own value proposition.

Worse, the domains are not disjoint. "Should I take this job in another city?" is Career +
Finance + Relationships + Home. Any taxonomy that forces a single-parent choice will be wrong on
exactly the questions that matter most, because important decisions are the ones that span
areas.

### Flaw 5 — Eight teams is eight accusations

The home screen shows eight teams, of which one is real. Six are empty.

Empty containers are not neutral. They read as reproach — the unused gym membership, the
language app you abandoned, the "0 workouts this week." A user opening Life OS sees seven areas
of their life they are *not* attending to. That is the opposite of calm.

Photos does not show you albums for the pictures you haven't taken. Notes does not pre-create
folders for the thoughts you haven't had. **Apple products start empty and earn structure.**
Life OS proposes to start structured and earn content, which is backwards, and which also makes
the cold-start experience — the only experience most users will ever have — the worst screen in
the product.

### Flaw 6 — History is a primitive with no demand behind it

History is placed as one of four levels. But archive-browsing is close to a write-only behaviour
in consumer software. People do not scroll their document revision history. Photos solved this
by *resurfacing* (Memories) rather than *filing*, precisely because browsing an archive is not a
behaviour that occurs naturally.

If past work has value, it comes back to the user unbidden — "this is the résumé you used last
March, want me to update it?" That is a system behaviour, not a navigation tier. Promoting it to
a level in the hierarchy creates a room nobody enters.

---

## The questions

### 1. Why is Mission-first a bad idea?

Summarising the above, in order of severity:

1. It is the runtime's vocabulary, not the user's — nobody says "mission."
2. It presumes completion, and 6 of 8 domains never complete.
3. It forces pre-classification, abolishing AI's central advantage.
4. Its emotional register is gamified, contradicting the product's own stated tone.
5. It makes multi-domain asks — the valuable ones — structurally awkward.
6. It collides with an existing Apple concept.

Any one of 2, 3, or 4 alone would be disqualifying at Apple.

### 2. What will confuse users?

Concretely, the confusions this model produces:

- **"Which team does this belong to?"** — asked at the moment of highest intent, when the user
  should be typing, not sorting.
- **"Is a mission a thing I do, or a thing the AI does?"** — the model never answers this. If I
  cook the meal, was the mission the plan or the cooking?
- **"Why is my Health team idle when I'm unhealthy?"** — continuous domains rendered as idle
  workers is a category error the user will feel as the product being wrong about their life.
- **"Where did my thing go?"** — artifact lives under mission lives under team lives under
  history: four levels of retrieval for one document.
- **"Do I have to keep these teams busy?"** — a manager-guilt dynamic nobody asked for. Making
  the user responsible for the utilisation of imaginary employees is a genuinely bad feeling.
- **"What is the difference between a mission and a task and a goal?"** — the user will be
  forced to develop a private theory, and every user's theory will differ.

### 3. Do people think in Missions? Or Projects, Goals, Tasks, Conversations?

None of them cleanly. Here is what each word actually is, and what it costs:

| Unit | What it really is | Who owns it | Fails when |
|---|---|---|---|
| **Task** | small, closed, one verb | the person | work is open-ended |
| **Project** | bounded, named, multi-step | the person, deliberately | the user must *name* it up front — the friction that kills every PM tool for personal use |
| **Goal** | aspirational, unbounded, no completion | the person | it never produces anything, so nothing can be shown |
| **Mission** | project with drama | the *system* | always — see above |
| **Conversation** | a medium, not a unit | shared | you need to see *state* while not talking |
| **Routine** | recurring, ambient | the system | one-off asks don't fit |

The honest answer is that people do not think in units at all. **People think in wants, expressed
as sentences, attached to ongoing concerns.** The sentence is momentary ("fix my résumé for this
posting"). The concern is durable ("my career"). Everything in between — project, mission, task —
is filing, and filing is a cost the user pays for the software's benefit.

The correct design conclusion: **let the user express the sentence, and let the system maintain
the structure.** Never ask the human to declare a container.

### 4. What mental model would Apple choose?

Apple's rule, observable across their entire consumer line: **the primitive is a noun the user
already owns, and the app is named after it.** Photos → photos. Notes → notes. Mail → mail.
Wallet → cards. Health → your body's data. Home → your devices.

Apple never invents an abstraction layer. There is no "Photo Session," no "Note Project," no
"Mail Mission." The app is a *library of the thing*, plus intelligence applied invisibly, plus
system-level surfacing at the right moment (widgets, Live Activities, Siri suggestions).

Apple would therefore build Life OS as: **your things, made and maintained for you, surfaced
when they need you.** No teams in the navigation. No missions. Agents attributed but not
navigated — the same way Photos does enormous ML work and never once shows you a model.

Two further Apple observations the current direction has to survive:

- **Apple already owns "Home" and "Health" as app names.** Two of the eight teams collide with
  system apps on the very device this is designed for.
- **Apple's unit of ongoing background work is the Live Activity** — one object, one line, on
  the lock screen, dismissible. Not a room, not a team. If a mission cannot be expressed as one
  line on a lock screen, it is too big to be a primitive.

### 5. What mental model would Notion choose?

**One primitive: the block/page in a database.** Everything is the same object with different
properties. Notion would model Life OS as a single table of Work Items with fields — area,
status, assignee (agent), output — and let views do the rest.

The strength is exactly what Life OS lacks: **one primitive, infinitely recombined.** Notion
would say the eight teams are a *view*, not a structure. Filter by area. Done.

The weakness is Notion's well-known tax: the user must build their own system, and most never
do. Notion's power users love it; the median user bounces off an empty page.

**What to steal:** one primitive, teams as a derived view. **What to avoid:** user-configurable
structure. Life OS should be opinionated where Notion is flexible.

### 6. What mental model would Linear would choose?

**The Issue.** Linear's entire philosophy is one primitive with a rigorous state machine —
Backlog → Todo → In Progress → Done — plus a small set of groupings (Project, Cycle) that
users cannot redefine.

Linear would say: a Mission is acceptable *only* if it is the sole primitive and has a strict,
non-negotiable status machine. Linear would delete "Team" as a navigational level and make agent
an **assignee field** on the item — which is precisely what it should be. An assignee is a
property, not a place.

Linear's deeper lesson is opinionation as a feature: no configuration, one way to do things,
extreme speed. Life OS should be Linear-opinionated about structure and Apple-restrained about
chrome.

**What to steal:** one primitive; status as a strict machine; assignee-as-property. **What to
avoid:** Linear's model assumes a team of humans coordinating — Life OS has one human and N
agents, which is a fundamentally different topology.

### 7. What mental model would ChatGPT choose?

**The thread.** One input box, no taxonomy, no filing. You say a thing; the system figures out
what it is. Artifacts (Canvas) emerge *from* the conversation rather than being created in a
container first.

ChatGPT's insight is the one most directly fatal to Mission-first: **classification is the
machine's job.** The user should never route their own intent.

ChatGPT's weakness is equally instructive: threads are terrible at *ambient state*. You cannot
see what is running, what is waiting, or what needs you without opening each conversation. Work
that continues while you are away has no representation. This is exactly the gap Life OS should
fill.

So: **ChatGPT's entry point (one box, no classification), with an ambient state layer it lacks.**
That combination is the actual product opportunity, and it is not "Mission."

### 8. Can one interaction model support all eight domains? Or is that dangerous?

**Dangerous — as currently formulated.** The eight domains differ on two axes the current model
ignores:

**Axis A: episodic vs. continuous** (does "done" exist?) — covered in Flaw 2.

**Axis B: does the output leave the system?**

| | Output is an artifact | Output is your behaviour |
|---|---|---|
| **Episodic** | Career, Travel | — |
| **Continuous** | Finance, Kitchen, Learning | **Health, Relationships, Home** |

The lower-right cell is where the model breaks. For Health and Relationships, the deliverable is
**not a document — it is a change in the user.** An artifact-centric interface will happily
produce a beautiful meal plan, a beautiful workout schedule, a beautiful "reconnect with your
sister" suggestion, and none of them will be acted on. The product will feel productive while
changing nothing. Call it the **meal-plan graveyard**: the failure mode where the system's
success metric (artifacts produced) diverges completely from the user's (life changed).

Any honest model must represent **"the thing that happens outside the app"** as a first-class
state. Not "done" — *adopted*, or *practised*, or *declined*. Life OS currently has no vocabulary
for this, and adding it later will change the core object.

**A separate and serious warning about Relationships.** There is a real difference between a user
accepting AI help on a résumé and accepting AI "management" of a friendship. The former is
delegation; the latter can read as manipulation — of the friend, who never consented, and of the
user's own sense of authenticity. An AI team that drafts messages to your mother is a product
that some users will find quietly repellent, and the reaction will not be predicted by any
Career-team usability test. This domain needs its own ethical framing before it needs an
interaction model, and "it's the same as the other seven" is the wrong default.

**The safe claim** is narrower and still valuable: one model can span the eight domains *if* the
primitive is neutral about completion and neutral about whether the output is a document or a
behaviour. "Mission" is neutral about neither.

### 9. If Mission is wrong, what is the better abstraction?

Strip it to what is irreducibly true about this product:

> There is a person. There are agents. Work passes between them.
> At any moment, **someone owes someone something.**

That is the whole system. The user owes a decision, or the agents owe an output. Everything else
— teams, stages, artifacts, history — is detail hanging off that relationship.

So the primitive is not the mission. **The primitive is the turn.**

The organising question of the entire operating system is: **whose turn is it?**

This is a better abstraction on every axis that killed Mission:

- **It is neutral about completion.** A continuous domain simply has long stretches where it is
  nobody's turn. Health is not "idle" — it is *standing*, which is a legitimate state, not an
  absence.
- **It requires no classification.** You say a sentence; the turn passes to the agents.
- **It is domain-neutral.** Turn-taking is as true of Kitchen as of Career.
- **It is emotionally correct.** "Waiting on you" is calm and factual. "0 active missions" is an
  accusation.
- **It makes approval central rather than a feature.** Approval *is* the turn changing hands —
  which is exactly where trust is won, per the vision doc's own principle 3.
- **It is one concept, not four.**

Concretely, the model collapses to:

```
              one input  →  a THING, in a STATE
                             │
     ┌───────────────────────┼───────────────────────┐
  YOUR TURN              THEIR TURN               NO TURN
  (decide, adopt,        (working, will            (standing,
   answer, do)            come back)                done, archived)
```

Every object in Life OS — a résumé draft, a budget question, a meal plan, a health habit — is a
**Thing** with **provenance** (who made which part) and **whose turn it is**. Teams become a
derived tag, used for colour and grouping when volume demands it, never as a step in navigation.
History becomes a property of a Thing, not a place. Artifacts remain the hero, as they should.

### 10. The simplest possible operating system for AI

Reduced until nothing further can be removed:

**One input.** Say anything. No team, no type, no title, no container. Classification is the
machine's job — that is the entire premise of building on AI.

**One object.** The Thing. It has: what it is, what state it's in, who touched which part, and
what happened to it. A document, a decision, a plan, a standing arrangement — all the same
object with different content.

**One organising question.** Whose turn is it? This is the only sort order that ever matters, and
it produces the home screen for free:

```
   ⬤  Your turn        — decisions, adoptions, answers.       Rare. Loud. Amber.
   ◐  Their turn       — being worked on. Live, glanceable.   Ambient.
   ○  Standing         — ongoing, nobody owes anything now.   Quiet.
       Yours           — finished things you own.             Archive, resurfaced.
```

**One promise.** Nothing needs your attention unless it truly does — and when it does, it is
unmistakable and it is one thing at a time.

That is four states, one noun, one verb, one input. No missions. No teams in the navigation. No
history tier. No rooms, no desks, no floors — the previous documents were right to kill those,
and did not go far enough.

An operating system for AI is not a place where AI lives. **It is a queue of obligations between
you and your agents, sorted by who is waiting on whom.**

---

## What survives from the current direction

A fair review says what to keep, and this direction earned three things:

1. **Artifact-as-hero.** Correct, and the sharpest idea produced so far. It survives intact.
2. **Attribution as the trust mechanism.** Correct, and undervalued — it should be elevated from
   a feature to a founding constraint. Provenance is what separates this from a chatbot.
3. **Amber reserved for "you are needed."** Correct, and it becomes *more* powerful under the
   turn model, where it is the visual encoding of the single organising question.

And two things that are right but were argued for the wrong reason:

4. **Agents should not walk** — right conclusion; the real reason is not cost, it is that
   locomotion encodes nothing about whose turn it is.
5. **Idle teams collapse to one line** — right instinct, but under the turn model there is no
   such thing as an idle team, only a domain where nobody currently owes anything.

---

## Recommendation

**Do not build Mission.** Do not build the eight-team home screen. Both are structure invented
ahead of demand, and both will be extremely expensive to remove once six teams depend on them.

The test that settles this costs one afternoon and no code:

Write down the last twenty things you actually wanted from Life OS, as sentences, exactly as you
would say them out loud. Then try to file each one:

- **Which single team owns it?** Count how many span two or more. If more than a quarter do, the
  team taxonomy is dead as a navigation structure.
- **Does it ever finish?** Count how many have no completion. If more than half don't, Mission is
  dead as a primitive.
- **Whose turn is it right now?** Count how many you can answer instantly. If nearly all of them,
  the turn is the right primitive.

I expect roughly: a third span teams, more than half never finish, and every single one has an
obvious answer to "whose turn is it." If that holds, the hierarchy under review should be
abandoned before it becomes code — which, mercifully, is exactly where it is now.
