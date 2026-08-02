# AI Studio — Design Proposal

Design document. No code. Supersedes the office floor-plan direction.

---

## 0. The challenge to the current design

The current build is a top-down office simulation. On a 390 px phone it fails on its own terms,
and the failure is structural, not cosmetic.

**Measure the pixels.** The vertical map is 512 × 1536 rendered at 390 px wide. Of that surface,
four agent sprites occupy roughly 1.5% of the visible area. The rest is floor tiles, walls,
desks, a printer, a trash can, and a whiteboard. We spent six implementation steps moving
furniture that the user did not ask for and cannot act on.

**The metaphor answers the wrong questions.** A floor plan is optimised for *where things are*.
The five objectives are all *what is happening*: who is working, what are they doing, who is
blocked, who needs me, where is my result. Position is a terrible encoding for state. A user
cannot tell "blocked" from "thinking" by looking at a capsule sitting at a desk, which is why we
kept reaching for speech bubbles — the bubbles were doing all the work, and the office was the
thing obstructing them.

**Walking currently means nothing.** After the desk-routing fix, an employee walks from their
desk to their desk. We had to note in that very document that a seated assignee produces no
visible movement. The most expressive channel in the product — motion — is spent on commuting.

**The office does not generalise.** Finance, Health, Relationships, and Learning are not offices.
A Health team in an office with a printer and a water cooler is a costume, not a design
language. Whatever we build must be the *same shape* for five domains.

So: keep the characters, the sprites, the bubbles, the craft. **Throw away the floor plan.**

---

## 1. Core design philosophy

> **The screen is a stage, not a map. Work flows downward. Motion means handoff.**

Three commitments follow from that sentence.

**A. Stage, not map.** We stop simulating a room and start framing a scene. Agents are actors,
placed for legibility, not for architectural plausibility. There is no floor to cross, no
corridor, no unreachable corner. Every pixel is either a character, their work, or a control.

**B. The vertical axis is the workflow.** Scrolling down moves forward through the pipeline.
Position on screen *is* progress. This is the single idea that makes the layout mobile-native:
a phone is a tall, scrollable surface, and a pipeline is a tall, ordered list. They are the same
shape.

**C. Motion is a sentence.** An agent moves only when something happened worth telling. Handoff,
blockage, delivery, return. If nothing is being communicated, nobody walks. Ambient life comes
from *gesture* — breathing, typing, glancing, leaning — not from pathfinding.

The unifying object is the **island**: a small, self-contained collaboration space holding one
stage of work and the one or two agents doing it. A team is a vertical ribbon of islands. That
is the whole design language, and it is domain-agnostic.

---

## 2. Screen hierarchy

Ranked by how fast the eye should reach it. Objective numbers refer to the brief.

| Rank | Element | Answers | Always visible? |
|---|---|---|---|
| 1 | **Focus island** — the active stage, auto-centred, ~45% of viewport height | 1, 2 | yes |
| 2 | **Action dock** — bottom, appears only when the user is needed | 4 | conditional |
| 3 | **Status rail** — 4 px left-edge ribbon, one segment per stage, coloured by state | 3 | yes |
| 4 | **Neighbour islands** — previous above, next below, peeking ~15% each | 2, 3 | yes |
| 5 | **Team header** — team name, one-line "what's happening now" | 1 | yes |
| 6 | **Result tray** — bottom sheet handle, fills when an artifact exists | 5 | when non-empty |
| 7 | Ambient decor — one or two props per island | — | yes |

**The rule of one.** At most one thing on screen is asking for the user's attention. If approval
is pending, the dock owns attention and every island dims. If a result is ready, the tray owns
it. Never both. Chaos is what happens when two elements pulse at once.

**Peeking is load-bearing.** Partial islands above and below tell the user the pipeline continues
without a map, a minimap, or a zoom control. It is also how "who is blocked" reaches the eye
before the user scrolls: a blocked island glows at the screen edge.

---

## 3. Layout sketch

390 px wide. Vertical scroll. Snap to islands.

### 3a. Normal running state

```
┌───────────────────────────────────────┐ 0
│ ▍ 커리어팀            ● 진행 중  2/5   │  header, 56px
│ ▍ 이작성이 초안을 쓰는 중             │  one-line "now"
├───────────────────────────────────────┤ 56
│▓│      ╭─ 완료 ─────────────────╮     │  prev island, peeking
│▓│      │ 🔍 김리서치   ✓ 요건 5개│     │  ~110px, dimmed 40%
│░├──────┴────────────────────────┴─────┤ 166
│░│                                     │
│▓│   ╭───────────────────────────╮     │
│▓│   │  ③ 이력서 초안 작성        │     │
│▓│   │                           │     │
│▓│   │      ╭──────────────╮     │     │  FOCUS ISLAND
│▓│   │      │ 초안을 쓰고  │     │     │  ~360px
│▓│   │      │ 있습니다     │     │     │
│▓│   │      ╰──────┬───────╯     │     │  bubble sits INSIDE
│▓│   │             ▼             │     │  the island's box —
│▓│   │        ( ◕ ‿ ◕ )          │     │  cannot clip offscreen
│▓│   │        ╱│ 이작성 │╲        │     │
│▓│   │       ▀▀▀▀▀▀▀▀▀▀▀▀        │     │  agent + work surface
│▓│   │      ▓▓▓ 📄 ▓▓▓▓▓         │     │
│▓│   │   ●━━━━━━━━━━━━━━○  62%   │     │  progress = the desk edge
│▓│   ╰───────────────────────────╯     │
│░│                                     │
│░├─────────────────────────────────────┤ 526
│░│      ╭─ 대기 ─────────────────╮     │  next island, peeking
│░│      │ 🔎 최검수    준비 중    │     │  ~110px, dimmed 55%
├─┴──────┴────────────────────────┴─────┤ 636
│  ▬▬▬▬  결과 2건                       │  result tray handle, 48px
└───────────────────────────────────────┘ 684
 ↑
 status rail (4px): ▓ done  ▓ active  ░ pending  ▒ blocked(amber)
```

### 3b. Approval state — the dock takes over

```
┌───────────────────────────────────────┐
│ ▍ 커리어팀         ⏸ 승인 대기  3/5   │  header turns amber
├───────────────────────────────────────┤
│▓│  ░░░░░░░ everything dims 60% ░░░░░  │
│▒│   ╭───────────────────────────╮     │
│▒│   │  ③ 이력서 초안 작성        │     │  focus island stays,
│▒│   │      ╭──────────────╮     │     │  agent turns to face
│▒│   │      │ 대표님 승인이 │     │     │  the user and waits —
│▒│   │      │ 필요합니다    │     │     │  no fidget, no typing
│▒│   │      ╰──────┬───────╯     │     │
│▒│   │        ( ◕ _ ◕ )  ← still │     │
│▒│   ╰───────────────────────────╯     │
├───────────────────────────────────────┤
│  경력 3건을 강조안으로 재배열합니다    │  what is being asked,
│                                       │  in plain language
│  ┌─────────────┐  ┌─────────────┐     │
│  │   승인      │  │   반려      │     │  ACTION DOCK
│  └─────────────┘  └─────────────┘     │  thumb zone, 96px
└───────────────────────────────────────┘
```

### 3c. Handoff — the one animation worth watching

```
   stage 3 island              stage 3 island
  ╭──────────────╮            ╭──────────────╮
  │  ( ◕‿◕ ) 📄  │            │  ( ◕‿◕ )     │
  ╰──────┬───────╯            ╰──────────────╯
         │  agent leans                ⋮
         ▼  over the edge              📄  ← artifact falls
  ╭──────────────╮            ╭──────┴───────╮
  │  ( -‿- ) zzz │            │  ( ◕o◕ ) 📄  │  next agent catches,
  ╰──────────────╯            ╰──────────────╯  wakes, starts
   stage 4 island              stage 4 island
```

The screen auto-scrolls to follow the artifact. **This is the only long-distance movement in the
product**, and it happens maybe four times per run. That scarcity is what makes it read as
meaningful rather than as traffic.

---

## 4. Agent positioning

**Agents are placed by role within an island, not by coordinates on a floor.**

Each island is a fixed 330 × 360 box with named slots:

```
        ╭─────────────────────────────╮
        │  [bubble slot]              │  ← clamped to island bounds
        │                             │
        │  [lead]      [partner]      │  ← 1-2 agents, never more
        │                             │
        │  ▓▓▓ [work surface] ▓▓▓     │  ← the artifact being made
        │  ●━━━━━━━━━━━○ [progress]   │
        ╰─────────────────────────────╯
```

- **Lead slot** — the stage owner. Always occupied while the stage is active.
- **Partner slot** — occupied only during genuine collaboration (a reviewer pairing with a
  writer). Empty most of the time. Its *occupancy is the signal*: two agents in one island means
  they are working together, and that is visible at a glance with zero text.
- **Bubble slot** — reserved above the agents, inside the island. Because the island is a box
  with known bounds, **a bubble can never leave the canvas**. The entire class of problem we
  were solving with 116 px corridors and column-position arithmetic disappears by construction.
- **Manager** — not an island. The manager lives in the header as a small persistent avatar,
  because the manager's job is to talk to the user, not to sit at a desk. When approval is
  needed, the manager avatar is what animates in the dock.

**Idle agents are not on screen.** An agent with nothing to do occupies their island in a resting
pose at 40% opacity, or is simply absent from a pending island. We never render five characters
doing nothing, which is precisely what the current office does.

Sprite work carries over verbatim: the capsule body, arms, headset, label, and the bubble
renderer are all reusable. We are changing where characters stand, not how they are drawn.

---

## 5. Movement philosophy

> **Movement is a verb. If you cannot name the verb, do not move.**

Four sanctioned movements, and no others:

| Verb | Motion | Meaning | Frequency |
|---|---|---|---|
| **Hand off** | agent leans over island edge, artifact falls to next island, screen follows | stage complete → next stage begins | ~4 per run |
| **Join** | agent slides from their island into a neighbour's partner slot | collaboration started | occasional |
| **Turn** | agent rotates to face the user, motion stops | blocked / needs approval | on demand |
| **Step back** | agent moves 8 px back from the work surface, arms drop | stage done, resting | ~4 per run |

Everything else is **gesture in place**: typing hands, breathing bob, head turn toward a
partner, a glance up when a bubble appears. Gesture is cheap, endlessly loopable, and reads as
life without any pathfinding.

**What this deletes:** A* pathfinding, the navigation grid, path smoothing, collision avoidance,
queue positions, walking lanes, the elevator. Roughly 2,000 lines of systems code become
unnecessary. Not because the code is bad — it is genuinely good code — but because it solves
"how do I cross a room" and we have deleted the room.

Note what we gain in honesty: today a stage transition can produce *no* visible movement. Under
this model every stage transition produces exactly one legible motion, always.

---

## 6. Approval flow

Approval is the product's most important moment: it is the only point where the user's judgment
enters. It currently renders as a panel in a side overlay.

**Principle: the agent asks the user, face to face.**

1. **Stop.** The requesting agent's gesture loop halts mid-motion. Stillness in a moving scene is
   the loudest possible signal — louder than a colour change, and it costs nothing.
2. **Turn.** The agent rotates to face out of the screen. Every other island dims to 40%. The
   status rail segment turns amber.
3. **Ask.** One bubble, in the agent's own voice, under 28 characters. The *detail* of what is
   being approved goes in the dock as plain language — never in the bubble.
4. **Dock.** Two buttons in the thumb zone: 승인 / 반려. Large, unambiguous, no third option.
5. **React.** On 승인, the agent nods once and resumes — motion returning is the confirmation.
   On 반려, the agent nods, the artifact on the work surface visibly reverts, and the bubble
   becomes "수정 요청을 반영하겠습니다."
6. **Never queue two.** If a second approval arises while one is pending, it waits. One decision
   on screen at a time, always.

**Reject must be as beautiful as approve.** The current design treats rejection as a stop state
with a 🛑. It should read as *revision* — the team goes back to work, which is a satisfying thing
to watch, not an error.

---

## 7. Result delivery flow

Today the result is a line of text in a panel: "아직 결과가 없습니다." That is the payoff of the
entire run, and it has no weight.

**Principle: the result is delivered to you, by someone.**

1. **Assemble.** As the final stage completes, the artifact icon on the work surface grows and
   gains a subtle sheen. The other agents turn to look at it — attention is directed by where
   characters look, which is free and unmistakable.
2. **Carry.** The manager avatar descends from the header into the final island, takes the
   artifact, and carries it to the **result tray** at the bottom. This is the only time the
   manager enters the stage, which makes it feel like an occasion.
3. **Land.** The tray handle fills, the count increments, and it pulses once. The user can open
   it now or later; the run does not block on it.
4. **Present.** Opening the tray is a bottom sheet: title, one-line summary, and the actions —
   view, export, re-run with changes. The artifact icon and the sheet's header are the same
   object, so the sheet reads as a continuation, not a new screen.
5. **Persist.** The tray never empties itself. Yesterday's results are still there. This is what
   makes Life OS feel like a place the user owns rather than a session.

The reserved "representative desk" from the office plan becomes this: not an empty desk, but the
tray. The user is not a character in the room — the user is the person the room reports to.

---

## 8. Idle behavior

Idle is what the user sees most of the time. It is the difference between "alive" and "a
progress bar with a hat on."

**Tiered idle, so activity never reads as noise:**

| Tier | When | Behaviour |
|---|---|---|
| **Working** | stage active | typing gesture, occasional glance up, bubble every milestone |
| **Attending** | in an island adjacent to the active one | slow breathing, head turns toward the active island |
| **Resting** | stage done | leans back, 40% opacity, no bubbles |
| **Dormant** | stage pending | absent or ghosted outline at 25% |

**Ambient beats, at most one at a time, at most one per ~20 s across the whole screen:** a stretch,
a sip, a glance at a neighbour, a slow blink. Because there is one global budget rather than a
per-agent timer, the scene can never become busy. This is the single most important constraint
for "alive but never chaotic."

**Coffee, reconsidered.** The current coffee system is a five-minute state machine that walks an
agent to a machine and back. Under this design it becomes a two-second gesture: a mug appears,
the agent drinks, the mug goes away. Same charm, none of the pathfinding, and it cannot collide
with real work because it never leaves the island.

**When the user is away**, nothing animates. The scene holds still until the tab is visible.
Life should not perform to an empty room.

---

## 9. Scaling to other Life OS teams

The island ribbon is domain-agnostic because it encodes *pipeline*, not *place*. Every Life OS
team is a sequence of stages with agents, blocks, approvals, and outputs.

**Team switching** — horizontal swipe between vertical ribbons. Each team is one full-height
column; the phone shows one at a time. This gives Life OS a two-axis mental model that fits a
phone perfectly:

```
   ← swipe: which team →

   커리어      돈       건강      관계      배움
     │         │         │         │         │
     ▼         ▼         ▼         ▼         ▼    scroll: how far along
   ╭────╮   ╭────╮   ╭────╮   ╭────╮   ╭────╮
   │ 🔍 │   │ 📊 │   │ 💪 │   │ 💬 │   │ 📚 │
   ╰────╯   ╰────╯   ╰────╯   ╰────╯   ╰────╯
   ╭────╮   ╭────╮   ╭────╮   ╭────╮   ╭────╮
   │ ✍️ │   │ 💰 │   │ 🥗 │   │ 🎁 │   │ 🧠 │
   ╰────╯   ╰────╯   ╰────╯   ╰────╯   ╰────╯
```

**What varies per team:** agent names and palettes, the work-surface artifact (résumé page,
budget chart, meal card, message draft, flashcard), the island prop, stage labels.

**What never varies:** island geometry, slot names, the four movement verbs, approval flow,
result tray, idle tiers, status rail. A new team is a **data file**, not a new screen. That is
the definition of a design language, and it is the thing an office floor plan could never have
given us — there is no plausible office for a Health team.

**A home view** ("all teams") becomes a vertical list of team cards, each showing its active
island in miniature. The design is fractal: an island summarises a stage, a card summarises a
team.

---

## 10. Animation budget

The discipline here is what keeps the scene calm. Everything is either **always moving**,
**moves on event**, or **never moves**.

### Animate — continuous (cheap, looping, small amplitude)
- Breathing bob on visible agents — 2 px, ~3 s cycle
- Typing hands on the active agent only
- Progress edge on the active island's work surface
- Status rail active segment — slow pulse, low contrast

### Animate — on event (the expressive budget, spent rarely)
- **Handoff** — the one hero animation, ~1.2 s, with the auto-scroll following
- Bubble in/out — 150 ms scale + fade, reusing the existing renderer
- Turn-to-user on approval — 300 ms, plus the *stop* of all other motion
- Nod on approve/reject — 400 ms
- Result carry and tray fill — ~1.5 s, once per run
- Island focus change — snap scroll, 250 ms ease

### Never animate
- Islands themselves — fixed boxes, no drift, no parallax
- The header and dock — controls must be dead still to be tappable
- Props and decor — a plant is a plant; it does not sway
- Background — flat, one colour per team, no tiles, no texture scroll
- Anything while the tab is hidden or the user is scrolling

**Two hard rules.** *One motion at a time* — if a handoff is playing, ambient beats pause. And
*nothing animates behind a decision* — while the dock is up, the scene is frozen except the
asking agent. Freezing is a design tool we currently do not use at all, and it is the cheapest
way to make one moment feel important.

---

## Migration honesty

What we keep: every sprite and drawing module, `drawBubble` / `drawArm` / `iconMap`, the agent
capsule and its arms, the bubble expiry timer, the workflow reducer, approval semantics, and the
role-specific message table. That is the majority of the genuinely valuable work.

What we retire: the floor plan, `navigationGrid`, `astar`, `pathfinding`, `pathSmoothing`,
`agentCollision`, `queuePositions`, the elevator, the desk grid, the vertical-layout coordinate
plan, and the six migration steps of furniture placement that led here. Retiring work that
functions is uncomfortable, and I want to be direct that a real cost is being proposed — but
every one of those systems exists to answer "how does a character cross a room," and this
proposal deletes the room.

The recommendation is to build one island, static, with one agent and one bubble, and hold it
next to the current office on a phone. The comparison will settle it in about ten seconds.
