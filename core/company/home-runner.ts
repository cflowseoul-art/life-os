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
import type { EventEnvelope, KnowledgeFact } from "../events/types.ts";
import * as home from "../capabilities/home/index.ts";
import { factsOfType, REPRESENTATIVE_AUTHOR } from "../capabilities/home/facts.ts";
import { matchProduct, preferences, remember, statedPreference } from "../capabilities/home/memory.ts";

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

    if (event.type === "KnowledgeFactRecorded") hold.observed = true;
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
    const actor = { kind: "capability" as const, id: home.CAPABILITY_ID };
    const now = new Date().toISOString();

    // Not a receipt. Did the representative say something ran out?
    if (receipt.items.length === 0) {
      const word = home.readDepletion(text);
      if (word === null) continue;

      const events = log.read();
      const memory = remember(events);
      const product = matchProduct(memory, word);
      const stated = statedPreference(text, now, "대표님 말씀");
      const known = preferences(events).find((p) => p.about.includes(word));

      if (!hold.observed) {
        log.append(
          {
            type: "KnowledgeFactRecorded",
            holdId: hold.holdId,
            fact: {
              id: "depletion",
              type: "depletion",
              value: { name: word },
              source: "대표님 말씀",
              // The representative said it; the runner only wrote it down.
              author: REPRESENTATIVE_AUTHOR,
              acquiredAt: now,
              confidence: 1,
            },
          },
          actor,
          home.CAPABILITY_ID,
          "home",
        );

        // A preference is recorded only when it was said out loud.
        if (stated) {
          log.append(
            {
              type: "KnowledgeFactRecorded",
              holdId: hold.holdId,
              fact: {
                id: "preference",
                type: "preference",
                value: { about: stated.about },
                source: "대표님 말씀",
                author: REPRESENTATIVE_AUTHOR,
                acquiredAt: now,
                confidence: 1,
              },
            },
            actor,
            home.CAPABILITY_ID,
            "home",
          );
        }
      }

      log.append(
        {
          type: "ArtifactKept",
          holdId: hold.holdId,
          artifact: home.proposeShoppingEntry({
            word,
            product: product?.name ?? null,
            quantity: product?.usualQuantity ?? null,
            lastBought: product?.lastBought ?? null,
            repeatDays: product?.repeatDays ?? null,
            preference: stated?.about ?? known?.about ?? null,
          }),
        },
        actor,
        home.CAPABILITY_ID,
        "home",
      );

      continue;
    }

    if (!hold.observed) {
      for (const fact of home.observe(text, new Date().toISOString())) {
        log.append(
          { type: "KnowledgeFactRecorded", holdId: hold.holdId, fact },
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

  // Purchases only. A discount is a separate fact type, so it can no longer be
  // mistaken for stock by a parser that misread a sentence.
  const facts: KnowledgeFact[] = [];
  for (const envelope of events) {
    if (envelope.event.type !== "KnowledgeFactRecorded") continue;
    if (envelope.capability !== home.CAPABILITY_ID) continue;
    facts.push(envelope.event.fact);
  }

  for (const fact of factsOfType(facts, "purchase")) {
    const existing = byName.get(fact.value.name);

    // Merged on the full printed name, so 1L and 900ml stay apart.
    byName.set(fact.value.name, {
      name: fact.value.name,
      quantity: (existing?.quantity ?? 0) + fact.value.quantity,
      lastBought: fact.acquiredAt,
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
