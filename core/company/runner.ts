/**
 * The runner registry.
 *
 * A runner executes one **responsibility**, not a capability. That is the whole
 * distinction this registry exists to hold: an employee owns a responsibility, a
 * capability owns business logic, and a runner executes it. Keying execution by
 * capability collapsed those three into one, which is why a department could
 * only ever have a single executable thing in it.
 *
 * Runners are loaded lazily from the path the manifest declares for their
 * responsibility, so adding one is: write the runner, add the entry. Nothing
 * imports it by name, and nothing switches on who answered.
 */

import type { EventStream } from "../storage/event-store.ts";
import type { Ask } from "../events/types.ts";
import type { ActorContext } from "../identity/types.ts";
import type { ResponsibilityId } from "./responsibilities.ts";

/** What a capability is given when work arrives. */
export type AcceptInput = {
  actor: ActorContext;
  /** The stream for this capability's scope. Chosen by the store, not the runner. */
  log: EventStream;
  subject: string;
  request: string;
  attachment: string;
};

/** What a capability is given when the representative answers its question. */
export type AnswerInput = {
  actor: ActorContext;
  log: EventStream;
  ask: Ask;
  optionId: string;
};

/** What a capability is given when the representative asks for a revision. */
export type ReviseInput = {
  actor: ActorContext;
  log: EventStream;
  ask: Ask;
  /** The representative's own words. Authoritative over the options offered. */
  feedback: string;
};

/** What a capability is given when the schedule wakes it. */
export type TickInput = {
  actor: ActorContext;
  log: EventStream;
  now: Date;
};

export type AcceptResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export type ResponsibilityRunner = {
  /** The responsibility this runner executes. One, always. */
  responsibility: ResponsibilityId;
  /** Take custody, then do everything that does not need the representative. */
  accept(input: AcceptInput): Promise<AcceptResult> | AcceptResult;
  /**
   * Answer an Ask this capability raised. Only capabilities that run outside
   * the custody engine implement it; the rest leave it undefined.
   */
  answer?(input: AnswerInput): Promise<void> | void;
  /**
   * Take the representative's written instruction. The proposal that prompted
   * it is already in the record; this adds what they said, and asks again.
   */
  revise?(input: ReviseInput): Promise<void> | void;
  /** Woken by the schedule, when the manifest says this capability is scheduled. */
  tick?(input: TickInput): Promise<void> | void;
};

/** What was registered, and where it came from. The path is kept to detect conflicts. */
type Registration = { runner: ResponsibilityRunner; modulePath: string };

const registry = new Map<ResponsibilityId, Registration>();

/**
 * Registers a runner against the responsibility it declares.
 *
 * The runner names its own responsibility, so registration cannot file it under
 * somebody else's — there is no id parameter to disagree with.
 *
 * Registering the same module twice is the normal case: the registry is warmed
 * at boot and consulted again on every request. Registering a *different*
 * module for a responsibility that already has one is a contradiction, and it
 * throws. Quietly keeping the first would mean the company runs one runner
 * while its declaration names another, and nothing would ever say so.
 */
export function register(runner: ResponsibilityRunner, modulePath: string): ResponsibilityRunner {
  const id = runner.responsibility;
  const existing = registry.get(id);

  if (existing) {
    if (existing.modulePath === modulePath) return existing.runner;

    throw new Error(
      `${id}: 러너가 두 번 등록되었습니다 (${existing.modulePath}, ${modulePath})`,
    );
  }

  registry.set(id, { runner, modulePath });
  return runner;
}

/**
 * Loads a responsibility's runner from the module the manifest names.
 *
 * Throws when the module is missing, exports no runner, or exports one declaring
 * a different responsibility — a mismatch would silently run somebody else's
 * work under this responsibility's name.
 */
export async function loadRunner(
  id: ResponsibilityId,
  modulePath: string,
): Promise<ResponsibilityRunner> {
  const cached = registry.get(id);
  if (cached?.modulePath === modulePath) return cached.runner;

  const module = (await import(modulePath)) as { runner?: ResponsibilityRunner };
  const runner = module.runner;

  if (!runner) throw new Error(`${id}: 러너를 내보내지 않았습니다 (${modulePath})`);
  if (runner.responsibility !== id) {
    throw new Error(`${id}: 러너가 맡은 책임이 다릅니다 (${runner.responsibility})`);
  }

  return register(runner, modulePath);
}

/**
 * The runner for a responsibility.
 *
 * Throws when nothing is registered. A responsibility with no runner is a
 * responsibility nobody can execute, and the caller asking for it has already
 * decided the work should happen — returning nothing would turn that into a
 * silent no-op somewhere further down.
 */
export function runnerFor(id: ResponsibilityId): ResponsibilityRunner {
  const found = registry.get(id);
  if (!found) throw new Error(`${id}: 등록된 러너가 없습니다.`);
  return found.runner;
}

/** Whether a responsibility can be executed right now. */
export function hasRunner(id: ResponsibilityId): boolean {
  return registry.has(id);
}

/** Everything registered, for inspection. Never used to pick a runner. */
export function registeredResponsibilities(): ResponsibilityId[] {
  return [...registry.keys()];
}
