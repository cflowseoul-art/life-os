/**
 * Event storage port.
 *
 * Capabilities receive an `EventLog`; they never learn where it lives. Today a
 * household's stream is a file under `.life-os/`; tomorrow it is a table, and
 * no capability changes.
 *
 * Scope decides the stream (review §C): household work goes to the household
 * stream, personal work to that user's. The split is enforced here, in one
 * place, rather than at every call site.
 */

import { EventLog } from "../events/log.ts";
import type { ActorContext, Scope } from "../identity/types.ts";

export interface EventStore {
  /** The stream a capability of this scope writes to and reads from. */
  logFor(context: ActorContext, scope: Scope): EventLog;
}

/**
 * Development adapter: one JSONL file per stream.
 *
 * The path convention is this file's business only. A hosted implementation
 * keys the same two streams by (householdId) and (householdId, userId).
 */
export class FileEventStore implements EventStore {
  constructor(private readonly root = process.env.LIFE_OS_ROOT ?? ".life-os") {}

  logFor(context: ActorContext, scope: Scope): EventLog {
    const household = context.household.id;

    return new EventLog(
      scope === "household"
        ? `${this.root}/households/${household}/household.jsonl`
        : `${this.root}/households/${household}/users/${context.user.id}.jsonl`,
    );
  }
}

/**
 * Single-stream adapter, for the log that exists today.
 *
 * Keeps the current data readable while identity lands. It ignores scope on
 * purpose — and that is exactly the reason it must not survive to beta.
 */
export class LegacyEventStore implements EventStore {
  constructor(private readonly log = new EventLog(process.env.LIFE_OS_LOG)) {}

  logFor(): EventLog {
    return this.log;
  }
}
