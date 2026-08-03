/**
 * The schedule.
 *
 * It asks the manifest which capabilities are scheduled and calls their
 * runners. No capability is named here, and adding a scheduled capability
 * needs no change in this file.
 *
 * Whether a tick actually does anything is the capability's own business — the
 * schedule wakes it; the runner decides whether a trigger fired.
 */

import { scheduled } from "./manifest.ts";
import { loadRunner } from "./runner.ts";
import { runnerModuleFor } from "./manifest.ts";
import type { EventStream } from "../storage/event-store.ts";
import type { ActorContext } from "../identity/types.ts";

export async function runSchedule(
  kind: "household" | "personal",
  actor: ActorContext,
  logFor: (capability: string) => EventStream,
  now = new Date(),
): Promise<string[]> {
  const woken: string[] = [];

  for (const capability of scheduled(kind)) {
    const runner = await loadRunner(capability.id, runnerModuleFor(capability.id));
    if (!runner.tick) continue;

    await runner.tick({ actor, log: logFor(capability.id), now });
    woken.push(capability.id);
  }

  return woken;
}
