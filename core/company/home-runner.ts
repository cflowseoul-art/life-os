/**
 * Home execution, and the memory two departments own.
 *
 * The custody engine advances Career. Home advances here, through the same log
 * and the same event vocabulary — no engine change, no second source of truth.
 *
 * §5 (Memory ownership): **Home owns inventory. Finance owns money.** Both are
 * projections over the same events, but neither department reads the other's
 * records — Finance receives the expense figure Home hands over, and nothing
 * else. Purchase history belongs to Home and stays there.
 */

import { EventLog } from "../events/log.ts";
import type { EventEnvelope } from "../events/types.ts";
import * as home from "../capabilities/home/index.ts";

type HomeHold = { holdId: string; store: string; text: string; observed: boolean; kept: boolean };

function homeHolds(events: EventEnvelope[]): HomeHold[] {
  const holds = new Map<string, HomeHold>();

  for (const { event } of events) {
    if (event.type === "HandedOver" && event.capability === home.CAPABILITY_ID) {
      holds.set(event.holdId, {
        holdId: event.holdId,
        store: event.handover.company,
        text: event.handover.jdText,
        observed: false,
        kept: false,
      });
      continue;
    }

    const hold = holds.get(event.holdId);
    if (!hold) continue;

    if (event.type === "ObservationRecorded") hold.observed = true;
    if (event.type === "ArtifactKept") hold.kept = true;
    if (event.type === "HoldWithdrawn") holds.delete(event.holdId);
  }

  return [...holds.values()];
}

/**
 * Does everything a receipt needs and stops.
 *
 * A receipt records a purchase that already happened, so there is no fork and
 * no Ask: recording what the representative bought is bookkeeping, and
 * bookkeeping is what the company absorbs (Art. 1). Judgment would only appear
 * if something had to be *spent*, which a receipt never does.
 */
export function advanceHome(log: EventLog, ocr: home.Ocr = home.passthroughOcr): void {
  for (const hold of homeHolds(log.read())) {
    if (hold.kept) continue;

    const text = ocr(hold.text);
    const receipt = home.readReceipt(text);

    if (receipt.items.length === 0) continue;

    const actor = { kind: "capability" as const, id: home.CAPABILITY_ID };

    if (!hold.observed) {
      for (const observation of home.observe(text, new Date().toISOString())) {
        log.append(
          { type: "ObservationRecorded", holdId: hold.holdId, observation },
          actor,
          home.CAPABILITY_ID,
          "home",
        );
      }
    }

    log.append(
      { type: "ArtifactKept", holdId: hold.holdId, artifact: home.proposeArtifact(hold.store, receipt) },
      actor,
      home.CAPABILITY_ID,
      "home",
    );
  }
}

/** Home's memory: what the household has, and when it was bought. */
export function inventory(events: EventEnvelope[]): { name: string; quantity: number; lastBought: string }[] {
  const byName = new Map<string, { name: string; quantity: number; lastBought: string }>();

  for (const envelope of events) {
    const { event } = envelope;
    if (event.type !== "ObservationRecorded" || envelope.capability !== home.CAPABILITY_ID) continue;

    // name · quantity+unit · amount. Discounts are not inventory.
    const [name, count] = event.observation.statement.split(" · ");
    if (name === undefined || count === undefined || count === "할인") continue;

    const quantity = Number(/^(\d+)/.exec(count)?.[1] ?? 1);
    const existing = byName.get(name);

    // Merged on the full printed name, so 1L and 900ml stay apart.
    byName.set(name, {
      name,
      quantity: (existing?.quantity ?? 0) + quantity,
      lastBought: event.observation.acquiredAt,
    });
  }

  return [...byName.values()];
}

/** Finance's memory: the figures Home handed over. No items, no household detail. */
export function expenses(events: EventEnvelope[]): { store: string; total: number; at: string }[] {
  const out: { store: string; total: number; at: string }[] = [];

  for (const envelope of events) {
    const { event } = envelope;
    if (event.type !== "ArtifactKept" || envelope.capability !== home.CAPABILITY_ID) continue;

    const line = event.artifact.sections.find((s) => s.heading.startsWith("지출 합계"));
    const total = Number(/([\d,]+)원/.exec(line?.heading ?? "")?.[1].replace(/,/g, "") ?? NaN);

    if (!Number.isNaN(total)) {
      out.push({ store: event.artifact.title.replace(" 영수증 정리", ""), total, at: envelope.at });
    }
  }

  return out;
}
