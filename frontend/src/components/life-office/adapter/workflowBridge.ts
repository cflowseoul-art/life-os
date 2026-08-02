/**
 * Workflow → visual bridge.
 *
 * The single writer that turns semantic workflow state into gameStore state.
 * Deliberately small and deterministic: no machines, no runtime, no queues.
 *
 * Direction is one-way. `workflow.ts` and `useWorkflowEngine` know nothing
 * about pixels; nothing here reads back from the visual layer.
 */

import { useEffect, useRef } from "react";

import { animationSystem } from "../systems/animationSystem";
import { getDeskPosition } from "../systems/queuePositions";
import { useGameStore } from "./gameStore";
import { BOSS_AGENT_ID } from "./types";
import type { EmployeeId, WorkflowState } from "../types";
import { STAGES } from "../workflow";

/**
 * Where an employee goes home to. Derived from the agent's own desk number in
 * the store — the same source gameStore seeds positions from — so a sprite can
 * never be sent to a desk it does not occupy.
 */
function deskPositionFor(agentId: string): ReturnType<typeof getDeskPosition> | null {
  const agent = useGameStore.getState().agents.get(agentId);

  return agent ? getDeskPosition(agent.desk) : null;
}

/**
 * Role-specific bubble lines, keyed by stage then phase.
 *
 * Presentation only — these never enter the reducer, the log, or the report.
 * Each line is a fixed string written by hand, never model output, and each is
 * under 28 Korean characters so `drawBubble` never has to truncate.
 *
 * `walking` = stage start, `working`/`reviewing` = intermediate milestone,
 * `done` = stage complete. Anything not listed shows no bubble.
 */
const STAGE_LINES: Record<string, Partial<Record<string, string>>> = {
  "collect-jd": {
    walking: "채용공고를 살펴보고 있습니다.",
    working: "필수 요건을 정리하고 있습니다.",
    reviewing: "핵심 요건을 다시 확인합니다.",
    done: "핵심 요건 5개를 찾았습니다.",
  },
  "gap-analysis": {
    walking: "관련 경험을 대조하고 있습니다.",
    working: "경험과 요건을 맞춰보고 있습니다.",
    reviewing: "우선순위를 다시 살펴봅니다.",
    done: "활용할 경험 3개를 골랐습니다.",
  },
  "draft-resume": {
    walking: "강조 순서를 정리하고 있습니다.",
    working: "이력서 초안을 작성하고 있습니다.",
    reviewing: "문장을 다듬고 있습니다.",
    done: "초안 작성을 마쳤습니다.",
  },
  "fact-check": {
    walking: "근거와 표현을 대조하고 있습니다.",
    working: "숫자와 사실을 확인하고 있습니다.",
    reviewing: "표현을 최종 점검합니다.",
    done: "검증을 마쳤습니다.",
  },
};

/** Boss lines. Fixed strings, not the reducer's own log labels. */
const APPROVAL_LINE = "대표님 승인이 필요합니다.";
const REJECTED_LINE = "수정 요청을 반영하겠습니다.";
const READY_LINE = "대표님, 검토본이 준비됐습니다.";

/** Stage + phase → the line to speak, or null for silence. */
function stageLine(stageId: string, phase: string | null): string | null {
  if (phase === null) {
    return null;
  }

  return STAGE_LINES[stageId]?.[phase] ?? null;
}

export function useWorkflowBridge(state: WorkflowState): void {
  const store = useGameStore;

  // Track which employee we last sent to the work area so we can send them home.
  const walkedRef = useRef<EmployeeId | null>(null);

  const activeStage = STAGES[state.activeStageIndex];
  const activeId = activeStage?.assignee ?? null;
  const activePhase = activeStage ? state.stages[activeStage.id].phase : null;

  // --- employees ----------------------------------------------------------
  useEffect(() => {
    const s = store.getState();

    // Send the previous employee back to their desk.
    const previous = walkedRef.current;
    if (previous && previous !== activeId && previous !== BOSS_AGENT_ID) {
      s.setAgentBubble(previous, null);
      s.setAgentPhase(previous, "idle");

      const home = deskPositionFor(previous);

      if (home) {
        animationSystem.setAgentPath(previous, home);
      }
    }

    if (!activeStage || !activeId) {
      walkedRef.current = null;
      return;
    }

    // The manager never walks — it renders as BossSprite only.
    if (activeId === BOSS_AGENT_ID) {
      walkedRef.current = null;
      return;
    }

    // Approval waiting speaks with the boss, not the assignee.
    const line = state.approval
      ? null
      : stageLine(activeStage.id, activePhase);

    if (line !== null) {
      s.setAgentBubble(activeId, { text: line, type: "thought" });
    }

    if (activePhase === "walking") {
      // Normal work happens AT the assigned desk. The old generic work-zone
      // cluster (WORK_POSITIONS) left employees standing mid-floor instead of
      // sitting; only reporting and idle coffee use a non-desk destination.
      s.setAgentPhase(activeId, "walking_to_desk");

      const desk = deskPositionFor(activeId);

      if (desk) {
        animationSystem.setAgentPath(activeId, desk);
      }

      walkedRef.current = activeId;
    } else if (activePhase === "working" || activePhase === "reviewing") {
      s.setAgentPhase(activeId, "idle");
    } else if (activePhase === "done") {
      s.setAgentPhase(activeId, "idle");
      // The completion line set above stays up; the store's expiry timer
      // clears it, so the stage-complete message is actually seen.

      const home = deskPositionFor(activeId);

      if (home) {
        animationSystem.setAgentPath(activeId, home);
      }

      walkedRef.current = null;
    }
  }, [store, state, activeStage, activeId, activePhase]);

  // --- boss ---------------------------------------------------------------
  useEffect(() => {
    const s = store.getState();

    // Fixed lines, not the reducer's own strings: `approval.action`,
    // `stopReason`, and `report` are free-form and can run long.
    if (state.approval) {
      s.setBossBubble({ text: APPROVAL_LINE, type: "speech" });
      s.setBossState("waiting_permission");
      return;
    }

    if (state.stopReason) {
      s.setBossBubble({ text: REJECTED_LINE, type: "speech" });
      s.setBossState("idle");
      return;
    }

    if (state.report) {
      s.setBossBubble({ text: READY_LINE, type: "speech" });
      s.setBossState("completing");
      return;
    }

    s.setBossBubble(null);
    s.setBossState(state.status === "running" ? "delegating" : "idle");
  }, [store, state.approval, state.report, state.stopReason, state.status]);
}
