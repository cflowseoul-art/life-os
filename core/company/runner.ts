/**
 * The runner registry.
 *
 * A capability owns its execution. The desk asks the manifest for a runner and
 * calls it; it never learns which capability answered, and no part of the
 * application switches on a capability id.
 *
 * Runners are loaded lazily from the path their manifest entry declares, so
 * adding a capability is: write the runner, add the entry. Nothing imports it
 * by name.
 */

import type { EventStream } from "../storage/event-store.ts";
import type { Ask } from "../events/types.ts";
import type { ActorContext } from "../identity/types.ts";

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

/** What a capability is given when the schedule wakes it. */
export type TickInput = {
  actor: ActorContext;
  log: EventStream;
  now: Date;
};

export type AcceptResult =
  | { ok: true }
  | { ok: false; reasons: string[] };

export type CapabilityRunner = {
  id: string;
  /** Take custody, then do everything that does not need the representative. */
  accept(input: AcceptInput): Promise<AcceptResult> | AcceptResult;
  /**
   * Answer an Ask this capability raised. Only capabilities that run outside
   * the custody engine implement it; the rest leave it undefined.
   */
  answer?(input: AnswerInput): Promise<void> | void;
  /** Woken by the schedule, when the manifest says this capability is scheduled. */
  tick?(input: TickInput): Promise<void> | void;
};

const loaded = new Map<string, CapabilityRunner>();

/**
 * Loads a capability's runner from the module its manifest entry names.
 *
 * Throws when the module is missing, exports no runner, or exports one whose id
 * does not match — a mismatch would silently run the wrong capability.
 */
export async function loadRunner(id: string, modulePath: string): Promise<CapabilityRunner> {
  const cached = loaded.get(id);
  if (cached) return cached;

  const module = (await import(modulePath)) as { runner?: CapabilityRunner };
  const runner = module.runner;

  if (!runner) throw new Error(`${id}: 러너를 내보내지 않았습니다 (${modulePath})`);
  if (runner.id !== id) throw new Error(`${id}: 러너 id가 다릅니다 (${runner.id})`);

  loaded.set(id, runner);
  return runner;
}

export function loadedRunner(id: string): CapabilityRunner | null {
  return loaded.get(id) ?? null;
}
