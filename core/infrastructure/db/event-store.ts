/**
 * Scoped events, in Postgres.
 *
 * The same two logical streams the file adapter keeps — one household stream
 * and one per person — stored in a single table and separated by indexed
 * columns. A personal event is never returned for another user, and household
 * events are only returned to a member of that household.
 *
 * Runners are synchronous, so a request loads its streams once, hands the
 * runners an in-memory view, and flushes whatever they appended. Ordering is
 * the table's `seq`, which is monotonic per insert.
 */

import { randomUUID } from "node:crypto";

import { db } from "./pool.ts";
import { SCHEMA_VERSION } from "../../events/types.ts";
import { upcast } from "../../events/migrate.ts";
import type { Actor, EventEnvelope, LifeEvent } from "../../events/types.ts";
import type { EventStore, EventStream, PreparedStreams } from "../../storage/event-store.ts";
import type { ActorContext, Scope } from "../../identity/types.ts";

type Row = {
  id: string; household_id: string; scope: Scope; user_id: string | null;
  capability: string | null; actor: Actor; payload: LifeEvent;
  source: string; schema_version: number; at: Date;
};

function toEnvelope(row: Row): EventEnvelope {
  // Same upcast as the file adapter, so a stored shape means the same thing
  // whichever adapter loaded it. The row itself is never updated.
  return upcast({
    id: row.id,
    schemaVersion: row.schema_version,
    at: row.at.toISOString(),
    actor: row.actor,
    capability: row.capability,
    source: row.source,
    event: row.payload,
    householdId: row.household_id,
    scope: row.scope,
  });
}

/**
 * One stream, backed by the table.
 *
 * `read()` answers from what `load()` fetched; `append()` records in memory and
 * queues the insert, so a runner sees its own writes immediately and the
 * request persists them once at the end.
 */
class PostgresStream implements EventStream {
  private loaded: EventEnvelope[] = [];
  private pending: EventEnvelope[] = [];

  constructor(
    private readonly householdId: string,
    private readonly scope: Scope,
    private readonly userId: string | null,
  ) {}

  async load(): Promise<void> {
    const { rows } = this.scope === "household"
      ? await db().query<Row>(
          "SELECT * FROM lifeos.events WHERE household_id = $1 AND scope = 'household' ORDER BY seq",
          [this.householdId],
        )
      : await db().query<Row>(
          `SELECT * FROM lifeos.events
           WHERE household_id = $1 AND scope = 'personal' AND user_id = $2
           ORDER BY seq`,
          [this.householdId, this.userId],
        );

    this.loaded = rows.map(toEnvelope);
    this.pending = [];
  }

  read(): EventEnvelope[] {
    return [...this.loaded, ...this.pending];
  }

  append(event: LifeEvent, actor: Actor, capability: string | null = null, source = "api"): EventEnvelope {
    const envelope: EventEnvelope = {
      id: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
      at: new Date().toISOString(),
      actor: actor.kind === "user" && this.userId ? { kind: "user", userId: this.userId } : actor,
      capability,
      source,
      event,
      householdId: this.householdId,
      scope: this.scope,
    };

    this.pending.push(envelope);
    return envelope;
  }

  async flush(): Promise<void> {
    for (const envelope of this.pending) {
      await db().query(
        `INSERT INTO lifeos.events
           (id, household_id, scope, user_id, event_type, capability, actor, payload, source, schema_version, at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
         ON CONFLICT (id) DO NOTHING`,
        [
          envelope.id,
          this.householdId,
          this.scope,
          this.scope === "personal" ? this.userId : null,
          envelope.event.type,
          envelope.capability,
          JSON.stringify(envelope.actor),
          JSON.stringify(envelope.event),
          envelope.source,
          envelope.schemaVersion,
          envelope.at,
        ],
      );
    }

    this.loaded = [...this.loaded, ...this.pending];
    this.pending = [];
  }
}

export class PostgresEventStore implements EventStore {
  private streams = new Map<string, PostgresStream>();

  private key(context: ActorContext, scope: Scope): string {
    return scope === "household"
      ? `h:${context.household.id}`
      : `p:${context.household.id}:${context.user.id}`;
  }

  logFor(context: ActorContext, scope: Scope): EventStream {
    const key = this.key(context, scope);
    const existing = this.streams.get(key);
    if (existing) return existing;

    const stream = new PostgresStream(
      context.household.id,
      scope,
      scope === "personal" ? context.user.id : null,
    );

    this.streams.set(key, stream);
    return stream;
  }

  /** The household stream and this person's own. Never anyone else's. */
  readableFor(context: ActorContext): EventStream[] {
    return [this.logFor(context, "household"), this.logFor(context, "personal")];
  }

  prepare(context: ActorContext): PreparedStreams {
    const streams = [
      this.logFor(context, "household") as PostgresStream,
      this.logFor(context, "personal") as PostgresStream,
    ];

    return {
      load: async () => { for (const s of streams) await s.load(); },
      flush: async () => { for (const s of streams) await s.flush(); },
    };
  }
}

/** Which reports a person has read. Per user, by definition. */
export async function readReports(userId: string): Promise<string[]> {
  const { rows } = await db().query<{ hold_id: string }>(
    "SELECT hold_id FROM lifeos.report_reads WHERE user_id = $1",
    [userId],
  );
  return rows.map((r) => r.hold_id);
}

export async function markReportRead(userId: string, holdId: string): Promise<void> {
  await db().query(
    `INSERT INTO lifeos.report_reads (user_id, hold_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [userId, holdId],
  );
}
