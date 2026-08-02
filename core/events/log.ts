/**
 * Append-only event log on disk.
 *
 * Art. 3 (Custody): the write happens before anything is acknowledged, and it
 * is a synchronous append to a file. Held work survives process restart because
 * no held state lives anywhere else.
 *
 * Art. 14 (Durability): the format is JSON Lines. One event per line, readable
 * with `cat`, parseable with any language, meaningful with Life OS deleted.
 *
 * Art. 18 (Deletion): this module exposes no update and no delete. It cannot.
 */

import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

import { SCHEMA_VERSION } from "./types.ts";
import type { Actor, EventEnvelope, LifeEvent } from "./types.ts";

export const DEFAULT_LOG_PATH = ".life-os/events.jsonl";

/** Loud, specific failure. Never a silent partial state. */
export class EventLogCorrupt extends Error {
  constructor(path: string, line: number, detail: string) {
    super(`이벤트 로그 손상: ${path}:${String(line)} — ${detail}`);
    this.name = "EventLogCorrupt";
  }
}

export class EventLog {
  constructor(private readonly path: string = DEFAULT_LOG_PATH) {}

  /**
   * Durably appends one event and returns the envelope.
   *
   * Art. 3: this returns only after the bytes are on disk. Callers acknowledge
   * a handover by returning after this resolves, never before.
   */
  append(
    event: LifeEvent,
    actor: Actor,
    capability: string | null = null,
    source = "cli",
  ): EventEnvelope {
    const envelope: EventEnvelope = {
      id: randomUUID(),
      schemaVersion: SCHEMA_VERSION,
      at: new Date().toISOString(),
      actor,
      capability,
      source,
      event,
    };

    mkdirSync(dirname(this.path), { recursive: true });
    appendFileSync(this.path, `${JSON.stringify(envelope)}\n`, "utf8");

    return envelope;
  }

  /**
   * Full history, oldest first. The only read path — state is always replayed.
   *
   * A malformed or half-written line throws, naming the line. It is never
   * skipped: silently dropping an event would produce a state that is wrong in
   * a way nobody can see, which Art. 8 forbids more strongly than a crash.
   */
  read(): EventEnvelope[] {
    if (!existsSync(this.path)) {
      return [];
    }

    const lines = readFileSync(this.path, "utf8").split("\n");
    const events: EventEnvelope[] = [];

    lines.forEach((line, index) => {
      if (line.trim() === "") return;

      let parsed: unknown;

      try {
        parsed = JSON.parse(line);
      } catch {
        throw new EventLogCorrupt(this.path, index + 1, "JSON을 읽을 수 없습니다");
      }

      const envelope = parsed as Partial<EventEnvelope>;

      if (
        typeof envelope.id !== "string"
        || typeof envelope.at !== "string"
        || typeof envelope.schemaVersion !== "number"
        || envelope.actor === undefined
        || envelope.event === undefined
      ) {
        throw new EventLogCorrupt(this.path, index + 1, "필수 필드가 없습니다");
      }

      if (envelope.schemaVersion > SCHEMA_VERSION) {
        throw new EventLogCorrupt(
          this.path,
          index + 1,
          `알 수 없는 schemaVersion ${String(envelope.schemaVersion)}`,
        );
      }

      events.push(envelope as EventEnvelope);
    });

    return events;
  }
}
