/**
 * Drives the existing workflow reducer from real backend run progress.
 *
 * The reducer, its events and `workflowBridge` are unchanged — this hook only
 * translates backend artifacts into the same events the mocked timer used to
 * emit, so the Office reacts identically whichever drives it.
 *
 * Progress is a self-draining queue: one poll may reveal several finished
 * artifacts (or all of them, if the run completed between polls), and each
 * queued stage plays its walking -> working -> done sequence and then starts
 * the next one without waiting for another poll.
 */

import { useEffect, useRef } from "react";

import type { ResumeRun } from "../../api/resume-api";
import type { StagePhase, WorkflowEvent } from "./types";

/** Artifact filename -> the workflow stage it completes. */
const STAGE_BY_ARTIFACT: Record<string, string> = {
  "01-jd-analysis.md": "collect-jd",
  "02-experience-match.md": "gap-analysis",
  "03-strategy.md": "gap-analysis",
  "04-resume-draft.md": "draft-resume",
  "05-fact-check.md": "fact-check",
  "06-final-report.md": "final-report",
};

/** Order stages are reached. Index into this array is the queue unit. */
const STAGE_ORDER = [
  "collect-jd",
  "gap-analysis",
  "draft-resume",
  "fact-check",
  "final-report",
] as const;

const WALKING_MS = 300;
const WORKING_MS = 700;
const DONE_MS = 300;

export function stageForArtifact(
  currentStage: string | null,
): string | null {
  if (!currentStage) {
    return null;
  }

  // resume-final.md is the terminal artifact, not a stage.
  return STAGE_BY_ARTIFACT[currentStage] ?? null;
}

/** Highest stage index implied by the artifacts seen so far. */
function highestStageIndex(run: ResumeRun): number {
  let highest = -1;

  for (const artifact of run.artifacts) {
    const stageId = stageForArtifact(artifact);

    if (!stageId) {
      continue;
    }

    const index = STAGE_ORDER.indexOf(
      stageId as (typeof STAGE_ORDER)[number],
    );

    if (index > highest) {
      highest = index;
    }
  }

  // A completed run implies every stage, even if the poll that observed the
  // completion is the first one to see any artifact at all.
  if (run.status === "completed") {
    highest = STAGE_ORDER.length - 1;
  }

  return highest;
}

export function useResumeProgress(
  run: ResumeRun | null,
  send: (event: WorkflowEvent) => void,
): void {
  const queueRef = useRef<number[]>([]);
  /** Highest index already enqueued — dedupes repeated polls. */
  const enqueuedRef = useRef(-1);
  const busyRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const runIdRef = useRef<string | null>(null);
  const failedRef = useRef(false);
  const sendRef = useRef(send);

  sendRef.current = send;

  useEffect(() => {
    const clearTimers = (): void => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer);
      }

      timersRef.current = [];
    };

    if (!run) {
      clearTimers();
      queueRef.current = [];
      enqueuedRef.current = -1;
      busyRef.current = false;
      runIdRef.current = null;
      failedRef.current = false;
      return;
    }

    // A different run starts from scratch.
    if (runIdRef.current !== run.id) {
      clearTimers();
      queueRef.current = [];
      enqueuedRef.current = -1;
      busyRef.current = false;
      failedRef.current = false;
      runIdRef.current = run.id;
    }

    if (run.status === "failed") {
      if (!failedRef.current) {
        failedRef.current = true;
        clearTimers();
        queueRef.current = [];
        busyRef.current = false;
        sendRef.current({
          type: "WORKFLOW_FAILED",
          reason: run.error ?? "백엔드 실행이 실패했습니다.",
        });
      }
      return;
    }

    if (failedRef.current) {
      return;
    }

    // Enqueue every stage newly implied by this poll, in canonical order.
    const highest = highestStageIndex(run);

    for (let index = enqueuedRef.current + 1; index <= highest; index += 1) {
      queueRef.current.push(index);
    }

    if (highest > enqueuedRef.current) {
      enqueuedRef.current = highest;
    }

    const at = (delay: number, action: () => void): void => {
      timersRef.current.push(window.setTimeout(action, delay));
    };

    // Plays one stage, then immediately pulls the next from the queue — no
    // further backend poll is needed to keep the office moving.
    const drain = (): void => {
      if (busyRef.current) {
        return;
      }

      const index = queueRef.current.shift();

      if (index === undefined) {
        return;
      }

      const stageId = STAGE_ORDER[index];

      if (!stageId) {
        return;
      }

      busyRef.current = true;

      const phase = (value: StagePhase): void => {
        sendRef.current({
          type: "STAGE_PHASE_CHANGED",
          stageId,
          phase: value,
        });
      };

      phase("walking");

      at(WALKING_MS, () => {
        phase("working");
      });

      at(WALKING_MS + WORKING_MS, () => {
        phase("done");
      });

      at(WALKING_MS + WORKING_MS + DONE_MS, () => {
        sendRef.current({ type: "STAGE_COMPLETED", stageId });
        busyRef.current = false;
        drain();
      });
    };

    drain();

    return () => {
      // Timers are owned across polls, so they are only cleared on unmount or
      // when this effect re-runs for a different run — not on every poll.
    };
  }, [run]);

  // Unmount: drop any pending timers.
  useEffect(() => {
    return () => {
      for (const timer of timersRef.current) {
        window.clearTimeout(timer);
      }

      timersRef.current = [];
    };
  }, []);
}
