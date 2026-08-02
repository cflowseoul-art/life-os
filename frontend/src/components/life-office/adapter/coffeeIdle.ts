/**
 * Coffee idle choreography.
 *
 * Pure decoration. This module never reads or writes workflow state, never
 * emits an event, and never touches the reducer — it only issues paths and a
 * bubble through the same gameStore/animationSystem surface the bridge uses.
 *
 * Eligibility is inferred from the visual layer alone (phase + bubble), so a
 * workflow import is never needed: the bridge marks a working employee by
 * giving them a stage bubble and a non-idle phase, and that is the signal
 * this module treats as "real work began".
 */

import { animationSystem } from "../systems/animationSystem";
import { getDeskPosition } from "../systems/queuePositions";
import { COFFEE_MACHINE_POSITION } from "./constants";
import { useGameStore } from "./gameStore";
import { BOSS_AGENT_ID } from "./types";

/** Idle dwell before an employee becomes eligible. */
const IDLE_MIN_MS = 8_000;
const IDLE_MAX_MS = 15_000;

/** How long they linger at the machine. */
const STAY_MIN_MS = 2_000;
const STAY_MAX_MS = 3_000;

/** Per-employee cooldown after a trip completes or is cancelled. */
const COOLDOWN_MIN_MS = 30_000;
const COOLDOWN_MAX_MS = 60_000;

/** Give up walking if the path never lands (never blocks the next trip). */
const WALK_TIMEOUT_MS = 20_000;

/** Arrival tolerance in canvas px. */
const ARRIVE_EPSILON = 24;

const TICK_MS = 500;

/** The one bubble this module ever writes. Identity is how cancel is detected. */
const COFFEE_BUBBLE = { text: "커피 한 잔 ☕", type: "thought" as const };

type Stage = "to_machine" | "staying" | "returning";

type Session = {
  agentId: string;
  stage: Stage;
  /** Wall-clock deadline for the current stage. */
  until: number;
};

/** At most one employee is ever out for coffee. */
let session: Session | null = null;

/** agentId -> timestamp before which they are not eligible again. */
const cooldownUntil = new Map<string, number>();

/** agentId -> when they last became idle-and-unoccupied. */
const idleSince = new Map<string, number>();

/** agentId -> the idle dwell drawn for this stretch, in [8s, 15s]. */
const idleTarget = new Map<string, number>();

let timer: number | null = null;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function distance(
  a: { x: number; y: number },
  b: { x: number; y: number },
): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Visual-layer definition of "not doing real work": sitting idle with no
 * stage bubble. The bridge sets both when a stage activates, so this flips to
 * false the instant work begins.
 */
function isUnoccupied(agent: {
  phase: string;
  bubble: { content: unknown };
}): boolean {
  return agent.phase === "idle" && agent.bubble.content === null;
}

function startCooldown(agentId: string): void {
  cooldownUntil.set(
    agentId,
    Date.now() + randomBetween(COOLDOWN_MIN_MS, COOLDOWN_MAX_MS),
  );
  idleSince.delete(agentId);
  idleTarget.delete(agentId);
}

/** Send them home and close the session. Safe to call from any stage. */
function endSession(clearBubble: boolean): void {
  if (!session) {
    return;
  }

  const { agentId } = session;
  const store = useGameStore.getState();
  const agent = store.agents.get(agentId);

  session = null;

  if (clearBubble && agent?.bubble.content === COFFEE_BUBBLE) {
    store.setAgentBubble(agentId, null);
  }

  if (agent) {
    animationSystem.setAgentPath(agentId, getDeskPosition(agent.desk));
  }

  startCooldown(agentId);
}

function pickCandidate(now: number): string | null {
  const agents = useGameStore.getState().agents;

  for (const [agentId, agent] of agents) {
    if (agentId === BOSS_AGENT_ID) {
      continue;
    }

    if (!isUnoccupied(agent)) {
      idleSince.delete(agentId);
      idleTarget.delete(agentId);
      continue;
    }

    if (now < (cooldownUntil.get(agentId) ?? 0)) {
      continue;
    }

    let since = idleSince.get(agentId);

    if (since === undefined) {
      since = now;
      idleSince.set(agentId, since);
      idleTarget.set(agentId, randomBetween(IDLE_MIN_MS, IDLE_MAX_MS));
    }

    if (now - since >= (idleTarget.get(agentId) ?? IDLE_MAX_MS)) {
      return agentId;
    }
  }

  return null;
}

function tick(): void {
  const now = Date.now();
  const store = useGameStore.getState();

  if (!session) {
    const agentId = pickCandidate(now);

    if (agentId !== null) {
      session = {
        agentId,
        stage: "to_machine",
        until: now + WALK_TIMEOUT_MS,
      };
      animationSystem.setAgentPath(agentId, COFFEE_MACHINE_POSITION);
    }

    return;
  }

  const agent = store.agents.get(session.agentId);

  if (!agent) {
    session = null;
    return;
  }

  // Real work began — abandon the trip immediately, at any stage. The bridge
  // has already issued its own path, so only the bubble needs undoing.
  const working =
    agent.phase !== "idle"
    || (agent.bubble.content !== null && agent.bubble.content !== COFFEE_BUBBLE);

  if (working) {
    if (agent.bubble.content === COFFEE_BUBBLE) {
      store.setAgentBubble(session.agentId, null);
    }

    startCooldown(session.agentId);
    session = null;
    return;
  }

  if (session.stage === "to_machine") {
    const arrived =
      distance(agent.currentPosition, COFFEE_MACHINE_POSITION) <= ARRIVE_EPSILON;

    if (arrived) {
      store.setAgentBubble(session.agentId, COFFEE_BUBBLE);
      session.stage = "staying";
      session.until = now + randomBetween(STAY_MIN_MS, STAY_MAX_MS);
      return;
    }

    if (now >= session.until) {
      endSession(true);
    }

    return;
  }

  if (session.stage === "staying") {
    if (now >= session.until) {
      if (agent.bubble.content === COFFEE_BUBBLE) {
        store.setAgentBubble(session.agentId, null);
      }

      animationSystem.setAgentPath(session.agentId, getDeskPosition(agent.desk));
      session.stage = "returning";
      session.until = now + WALK_TIMEOUT_MS;
    }

    return;
  }

  // returning: home or timed out, either way the trip is over.
  const home = getDeskPosition(agent.desk);

  if (
    distance(agent.currentPosition, home) <= ARRIVE_EPSILON
    || now >= session.until
  ) {
    startCooldown(session.agentId);
    session = null;
  }
}

/** Starts the choreography loop. Idempotent; returns a stop function. */
export function startCoffeeIdle(): () => void {
  if (timer !== null) {
    return stopCoffeeIdle;
  }

  timer = window.setInterval(tick, TICK_MS);

  return stopCoffeeIdle;
}

export function stopCoffeeIdle(): void {
  if (timer !== null) {
    window.clearInterval(timer);
    timer = null;
  }

  session = null;
  cooldownUntil.clear();
  idleSince.clear();
  idleTarget.clear();
}
