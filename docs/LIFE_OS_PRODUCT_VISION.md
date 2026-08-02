# Life OS — Product Vision

The operating system for AI teams.

Product vision. No code. This document supersedes `AI_STUDIO_VISION.md`, including the parts I
argued for there.

---

## 0. First principles

Before proposing anything, four things that are true regardless of what we build.

**1. The user does not want to watch a team. They want the thing they asked for.**

This is the assumption I got wrong in `AI_STUDIO_VISION.md`. That document replaced the office
with "islands," but islands still put *agents* at the centre of the frame and made the artifact
a prop on their desk. That is the same error as the office, one abstraction level up.

Nobody opens an app to watch employees. They open it because they want a tailored résumé, a
budget, a meal plan. The team is *how it gets made*. Apple has never shipped an interface where
the machinery is the hero — the photo is the hero, the message is the hero, the song is the
hero. **The artifact is the main character. The agents are how it comes alive.**

**2. "Alive" and "game-like" are different axes, and we kept confusing them.**

A game is alive because things move. An Apple product is alive because things *respond* —
Dynamic Island morphing, a Live Activity updating on the lock screen, a photo's Live Photo
breathing when you press. None of these involve locomotion. Aliveness comes from **presence and
responsiveness**, not from characters traversing space.

**3. The scarcest resource is the user's attention, and the second scarcest is their trust.**

Every AI team product faces the same trust problem: the user cannot tell whether the AI did
something reasonable. The interface's real job is not status display — it is **making the work
legible enough to trust**. Approval moments are where trust is won or lost, and they should be
the most beautifully designed thing in the product, not a panel in a sidebar.

**4. The design must be domain-neutral from the first pixel.**

Career, Finance, Kitchen, Health, Relationships, Learning, Travel, Home. Any metaphor that
works for one and strains for another is disqualified immediately. An office fails Kitchen and
Health. A "studio" fails Home. **The only thing all eight share is: a request becomes a piece of
work, several specialists contribute, sometimes you must decide, and something is delivered.**
That sentence — not a place — is the design language.

---

## 1. The design philosophy

> **Living work, made by visible hands.**

Three principles, in priority order. When they conflict, the earlier one wins.

### I. The work is the interface

Every request instantly becomes an object on screen — a **Work** — and that object is visible
from the first second, unfinished. You watch it *become*. A résumé that starts as a pale outline
and fills in section by section tells you more about progress, honestly, than any progress bar
or walking character ever could.

This inverts the current model. Today: a room, in which agents work, and somewhere a result
appears at the end. Tomorrow: **the result, from the beginning, with the team's hands visible on
it.**

### II. Presence, not performance

Agents appear *on* the work they are touching, the way collaborators' cursors appear in a shared
document. Presence is the most calming multiplayer language we have — Figma and Google Docs
proved it at scale, and it has zero cost in attention. It is legible at a glance, it never needs
space to move through, and it is equally true for Kitchen and Finance.

Agents have faces and personalities. They are not abstractions. But they are **portraits, not
bodies** — closer to Memoji than to an RPG sprite. A face can express thinking, hesitating,
blocked, and asking with a handful of pixels and no pathfinding at all.

### III. Calm by default, precious when it matters

The interface is nearly still. Motion is rationed so that when something *does* move, it means
something. The system earns the right to interrupt exactly twice: **when it needs a decision**,
and **when something is finished**. Everything else is ambient and ignorable.

Premium is not gloss. Premium is restraint plus one moment of delight per session.

---

## 2. The core interaction model

Three surfaces, one gesture between them. That is the whole product.

```
   TEAMS  ──tap──▶  WORK  ──tap──▶  DETAIL
   (home)          (live card)      (the artifact itself)
     ◀──────────────  ◀──────────────
              swipe down / back
```

### Surface 1 — Teams (home)

A vertical list of your eight teams. Each is one card. A team with nothing running is a quiet
row — name, icon, last result. A team with live work shows that work *inside the row*, in
miniature, updating. This is the Live Activity pattern: the home screen is a stack of things
that are actually happening.

```
┌─────────────────────────────────────┐
│  Life OS                      ⌄     │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 커리어          ●●○ 3 working │  │  ← live: presence dots,
│  │ ┌───────────────────────────┐ │  │    artifact preview
│  │ │ ▒▒▒▒▒▒▒  이력서 초안      │ │  │    filling in live
│  │ │ ▒▒▒▒▒▒▒▒▒▒▒▒░░░░  62%    │ │  │
│  │ └───────────────────────────┘ │  │
│  │ 이작성 · 초안을 쓰는 중        │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │ 돈              ⏸ 승인 필요   │  │  ← the one thing that
│  │ 이번 달 예산 재배분            │  │    wants you. amber.
│  └───────────────────────────────┘  │
│                                     │
│  주방                     조용함     │  ← idle teams collapse
│  건강                  어제 완료 2   │    to a single line
│  관계                     조용함     │
│  배움                     조용함     │
└─────────────────────────────────────┘
```

**Idle teams take one line.** This is the single most important layout decision in the product:
eight teams must fit on one phone screen without any of them shouting. Only live work expands.

### Surface 2 — Work (the live card)

Tap a team, or tap the work directly, and it expands — a Dynamic Island–style continuous morph,
not a page push. The artifact fills the screen. The team's presence sits on it.

```
┌─────────────────────────────────────┐
│  ← 커리어                      ⋯    │
│                                     │
│   ┌───────────────────────────────┐ │
│   │  원프레딕트 · 데이터 분석가    │ │
│   │  ─────────────────────────    │ │
│   │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓  요약        │ │  ← done sections are
│   │  ▓▓▓▓▓▓▓▓▓▓                  │ │    solid
│   │                               │ │
│   │  ▒▒▒▒▒▒▒▒▒▒▒▒  경력      (◕)  │ │  ← in progress, with
│   │  ▒▒▒▒▒▒▒░░░░░            이작성│ │    the agent's face
│   │                               │ │    right there
│   │  ░░░░░░░░░░░  기술            │ │  ← not started yet
│   │  ░░░░░░░░░                    │ │
│   └───────────────────────────────┘ │
│                                     │
│  ●  김리서치  요건 5개 정리 완료     │  ← the thread: what
│  ●  박분석    경험 3개 선택 완료     │    happened, newest
│  ◐  이작성    초안 작성 중           │    at the bottom
└─────────────────────────────────────┘
```

The artifact is real and scrollable. The **thread** beneath it is the narrative — a handful of
lines, not a log. Each line is a milestone, in the agent's voice, tappable to see the reasoning
if the user wants it. Progressive disclosure: the "why" is available, never present.

### Surface 3 — Detail

The finished artifact, full screen, exportable, editable. No agents, no chrome. The work stands
on its own — because eventually the user will want to send this résumé to someone, and at that
moment the team should be invisible.

### The one gesture

Everything is **expand / collapse**. There is no navigation stack to get lost in, no tabs, no
side panels. A thing gets bigger when you want it, smaller when you don't. That is the most
Apple structural decision available, and it scales to eight teams as easily as to one.

---

## 3. The visual language

### Material

One surface material: a soft, near-opaque card floating on a deep neutral background. Cards cast
almost no shadow. Depth comes from **scale and blur**, not from borders — collapsed things are
slightly smaller and slightly desaturated; the focused thing is full-size and full-colour.

Background is a single deep neutral (light and dark both), never a texture, never a tile, never
a floor.

### Colour

- **Neutral by default.** The UI is greyscale. Type carries the information.
- **One accent per team**, used sparingly: a 4 px identity bar and the presence rings. Career
  warm amber, Finance deep green, Kitchen terracotta, Health teal, Relationships rose, Learning
  indigo, Travel sky, Home sand. The eight colours are the *only* place the product uses hue for
  identity.
- **Amber is reserved for "you are needed."** It appears nowhere else in the product. If the user
  sees amber, it is theirs to act on. This single reservation does most of the work of goal #4.
- **Never red for AI states.** Red means the user broke something. A rejected draft is not an
  error; it is revision.

### Typography

Type-led, like every good Apple surface. A large title, a smaller caption, and a monospaced
detail only where a number needs to be scanned. The agent's voice lines are set in the body face
at normal weight — they read as speech, not as UI labels.

### Agents

Circular portraits, 32–44 px, with a **presence ring**:

| Ring | Meaning |
|---|---|
| still, dim | idle |
| slow pulse | working |
| solid, bright | speaking / just produced a milestone |
| amber, still | blocked, needs you |

The face inside animates minimally: a blink, a glance, a slight lean when thinking. This is the
Memoji register — expressive, premium, not cartoonish, and cheap enough to run four at once
without a canvas engine.

**The manager is not an agent.** The manager is the voice of the system: it speaks in the thread
and in approvals, and it has a portrait, but it never occupies a work surface. It is the
narrator.

### Sound and haptics

One haptic when a decision is requested. One softer haptic plus a single tone when work
completes. Nothing else, ever. Two sounds in the entire product.

---

## 4. How agents collaborate

Collaboration must be *visible* without being *theatrical*. Three mechanisms, in increasing
weight:

**1. Co-presence.** Two portraits on the same section of the artifact means two agents are
working on it together. That is the entire signal, and it needs no animation, no motion, no
explanation. It is instantly readable because every user already knows it from shared documents.

**2. Attribution.** Every part of the artifact carries a faint mark of who made it — visible on
hover/long-press, not by default. This is what makes the work trustworthy: the user can always
ask "who wrote this line?" and get an answer. **Attribution is the trust mechanism of the whole
product.**

**3. Handoff in the thread.** When work passes between agents, the thread gains a line —
`김리서치 → 박분석 · 요건 5개 전달`. The artifact section it concerns briefly brightens. That is
the whole animation: a highlight, not a journey.

**Disagreement is a feature.** When two agents produce conflicting recommendations, that is the
most valuable thing the team can surface — and it becomes an approval with two options, each
attributed to its author. A team that never disagrees is a team the user should not trust.

---

## 5. How artifacts move

Artifacts do not travel. **They accumulate in place.**

The Work object exists from the moment the user asks, in outline form. Over the run it fills in:
sections resolve from `░` ghost to `▒` drafting to `▓` settled. Nothing is carried anywhere by
anyone.

Why this is better than the handoff animation I proposed before: a carried artifact implies the
work *moves between people*, which is a factory metaphor. In reality all the agents are
contributing to one evolving document. Showing it as one object that gets better is both more
truthful and calmer.

**The only artifact motion in the product:**

| Moment | Motion |
|---|---|
| Section completes | ghost → solid, 400 ms, one section only |
| Revision after rejection | solid → drafting, a visible "un-setting" |
| Work completes | the whole card settles: subtle scale-down and lift |
| Delivered | the card moves to the team's results shelf |

The finished artifact lands in a per-team **shelf** — a horizontal row of past results at the
bottom of the team view. It never auto-opens. Results are permanent; the shelf is the user's
archive, and it is the thing that makes Life OS feel owned rather than transactional.

---

## 6. Should agents move at all?

**No. Agents do not move through space. They appear where the work is.**

This is the sharpest reversal from everything built so far, so let me argue it properly.

Locomotion earns its cost only when *position carries meaning*. In a game, position is state:
where you stand determines what you can reach. In Life OS, position carries no information — an
agent at a desk versus at a coffee machine tells the user nothing about the résumé. We were
spending our most expensive channel on our least informative signal, and paying for it with
~2,000 lines of pathfinding, collision, and grid code.

What we actually need movement *for* is: showing attention, showing sequence, showing blockage.
All three are better served by presence:

| Need | Locomotion answer | Presence answer |
|---|---|---|
| Who is working | find the character that is walking | pulsing ring on the section |
| Sequence | watch a handoff walk across the room | thread line + section highlight |
| Blocked | character stands still somewhere | amber ring, and the card rises to the top |
| Collaboration | two characters near each other | two portraits on one section |

Presence wins on every row, at a fraction of the complexity, and it works identically on a
390 px phone and a desktop.

**What agents *do* do:** appear, fade, pulse, blink, lean, turn to face the user. Micro-motion in
a fixed frame. This is exactly what makes Memoji and Dynamic Island feel alive — and neither of
them walks anywhere.

**The one exception worth keeping:** an agent portrait can *slide* a short distance to join
another agent's section — under ~100 px, 300 ms. That reads as "joining," not as commuting. It
is the only translation of position in the product.

---

## 7. Should rooms exist?

**No.** Not as places, not as backgrounds, not as metaphor.

A room is a container defined by walls, and walls exist to separate. The eight Life OS teams do
not need separating by architecture — they are separated by *identity* (name, colour, icon) and
by *state* (quiet, working, needs you). Those are cheaper, clearer, and domain-neutral.

More decisively: rooms don't survive the domain test. A Kitchen team in a room is a kitchen — fine.
A Relationships team in a room is... an office? a café? Any answer is arbitrary, and arbitrary
metaphor is exactly what makes software feel cheap. **The absence of a room is what lets the same
interface serve Travel and Health without embarrassment.**

What replaces the room: the **Work card**. It is a bounded space that holds a team, their
artifact, and their conversation. It has edges, so nothing can escape it — which is also how the
bubble-clipping problem, the corridor-width problem, and the camera-clamp problem all cease to
exist. They were all symptoms of an unbounded world.

---

## 8. Should desks exist?

**No.** The desk is replaced by the artifact itself.

A desk in the current design is a place where an agent sits so that we know they are working.
But the artifact already tells us that — a section that is actively drafting, with a portrait on
it, is a desk in every sense that matters, and it has the enormous advantage of showing *what*
is being worked on rather than merely *that* work is occurring.

This also disposes of a family of problems the prototype spent six steps on: desk grids, desk
assignments, desk obstacle bands, `DESKS_PER_ROW`, seat coordinates, and the reserved
"representative desk." The reserved desk becomes the results shelf. The desk assignment map
becomes nothing at all — an agent is wherever their work is.

**Furniture in general is out.** No printer, no whiteboard, no water cooler, no plant, no trash
can, no elevator. Each was a charming detail that cost coordinates, obstacles, and attention
budget while answering none of the five goals. If we later want charm, it belongs in the agents'
faces and voices — the two places where charm is also *information*.

---

## 9. How every future team reuses this

The model is domain-neutral because it encodes **request → contribution → decision → artifact**,
which is the shape of all eight teams.

A new team is a **manifest**, not a screen:

```
team:        kitchen
identity:    이름, 아이콘, accent = terracotta
agents:      4 portraits, names, voices, specialties
artifact:    the shape of the thing produced
             (kitchen: a week grid; finance: a table;
              career: a document; health: a plan)
stages:      the sections that fill in
approvals:   which decisions need the user
```

**What varies per team:** agent identities and voices, accent colour, and — the only structural
variable — the **artifact template**, i.e. what shape the thing being made has.

**What never varies:** the three surfaces, expand/collapse, presence rings, the thread,
attribution, the approval flow, the results shelf, the two sounds, the amber reservation.

That last list is the design language. A team is data. Adding Travel should take an afternoon and
zero new interaction patterns — and if it ever requires a new pattern, the pattern was wrong.

**The compounding payoff:** because every team looks the same, a user who learns Career has
learned all eight. And because every team *is* the same, the shelf across all teams becomes a
single unified archive of everything Life OS has ever made for this person. That archive is the
actual product moat — not the agents, and certainly not the office.

---

## 10. Roadmap

Five phases. Each ends with something real on a phone. The order is chosen so the riskiest
assumption is tested first and the largest deletion happens only after it is proven.

### Phase 0 — Prove the thesis (days)

Build **one static Work card** at 390 px: artifact outline with three sections in ghost/drafting/
settled states, two agent portraits with presence rings, three thread lines. No logic, no data,
no animation.

Hold it next to the current office on a phone and answer the five goals against each. This is a
one-afternoon test of the entire vision, and it should be run before a single system is deleted.

**Kill criterion:** if the card does not answer all five goals faster than the office, this
document is wrong and we stop here.

### Phase 1 — The living artifact (1-2 weeks)

Wire the existing workflow reducer to a real Work card for Career. Sections fill in as stages
complete. The thread populates from the existing role-specific message table — that content
survives entirely; only its presentation changes.

The Pixi office keeps running behind a flag for comparison, untouched.

**Ship criterion:** a full Career run is watchable end-to-end on a phone, and is more pleasant
than the office.

### Phase 2 — Trust and decisions (1-2 weeks)

The approval moment, done properly: the asking agent's portrait, plain-language description of
the decision, two large actions, amber, one haptic. Attribution on every artifact section.
Rejection as revision, not error.

This phase is where the product becomes trustworthy rather than merely watchable, and it deserves
disproportionate design time.

**Ship criterion:** a user who has never seen the product can approve or reject correctly with no
explanation.

### Phase 3 — The system (2-3 weeks)

The Teams home with all eight teams — six of them empty stubs. Expand/collapse morph. Results
shelf. The unified archive.

This is where Life OS stops being one team's tool and becomes an operating system. It is also the
first honest test of whether the language really is domain-neutral: build **Kitchen** here, not
last, precisely because it is the least like Career. If Kitchen fits without a new pattern, the
language holds.

**Ship criterion:** two teams, structurally identical, no special-cased code.

### Phase 4 — The delete (1 week)

Only now, with the replacement proven, retire the office: PixiJS, `navigationGrid`, `astar`,
`pathfinding`, `pathSmoothing`, `agentCollision`, `queuePositions`, `animationSystem`, the desk
grid, the elevator, the whiteboard modes, the camera presets, the sprite PNGs, and the six
migration documents that led here.

Doing this last is deliberate. Deleting working code before its replacement is proven is how
teams end up with neither.

### Phase 5 — Aliveness (ongoing)

The character work: portrait micro-expressions, agent voices with genuine personality,
disagreement between agents surfaced as a choice, the settle animation when a work completes.

This is last because it is the part that only pays off once the structure is right — and the
part that will make people love it.

---

## What this costs, honestly

**Retired:** the entire Pixi rendering layer and every system beneath it. Roughly 4,000 lines of
working, non-trivial code, including genuinely good pathfinding and animation work, plus the
sprite art and eight migration documents.

**Kept:** the workflow reducer, approval semantics, the resume runtime pipeline, the
role-specific message table, the agent names and personalities, and every product insight earned
along the way — including the ones that came from building the office and discovering what it
could not do.

**The uncomfortable part:** the last several sessions of work — vertical layout plan, canvas
resize, grid rebuild, desk bands — are superseded by this document. That work was not wasted; it
is what made the failure mode legible. But it should not be defended, and the vertical office
migration should be stopped where it stands rather than finished.

**The recommendation:** run Phase 0 this week. One static card, one phone, five questions. Let
the comparison decide, and let it decide before anything is deleted.
