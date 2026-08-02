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
import { WORK_POSITIONS } from "./constants";
import { useGameStore } from "./gameStore";
import { BOSS_AGENT_ID } from "./types";
import type { EmployeeId, WorkflowState } from "../types";
import { REPORT_MESSAGE, STAGES } from "../workflow";

/**
 * Where an employee goes home to. Derived from the agent's own desk number in
 * the store — the same source gameStore seeds positions from — so a sprite can
 * never be sent to a desk it does not occupy.
 */
function deskPositionFor(agentId: string): ReturnType<typeof getDeskPosition> | null {
  const agent = useGameStore.getState().agents.get(agentId);

  return agent ? getDeskPosition(agent.desk) : null;
}

/** Phase → what the sprite is doing. */
function phaseLabel(stageId: string): string {
  const stage = STAGES.find((s) => s.id === stageId);
  return stage ? stage.title : "";
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

    s.setAgentBubble(activeId, {
      text: phaseLabel(activeStage.id),
      type: "thought",
    });

    if (activePhase === "walking") {
      s.setAgentPhase(activeId, "walking_to_desk");
      animationSystem.setAgentPath(activeId, WORK_POSITIONS[activeId]);
      walkedRef.current = activeId;
    } else if (activePhase === "working" || activePhase === "reviewing") {
      s.setAgentPhase(activeId, "idle");
    } else if (activePhase === "done") {
      s.setAgentPhase(activeId, "idle");
      s.setAgentBubble(activeId, null);

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

    if (state.approval) {
      s.setBossBubble({ text: state.approval.action, type: "speech" });
      s.setBossState("waiting_permission");
      return;
    }

    if (state.stopReason) {
      s.setBossBubble({ text: state.stopReason, type: "speech" });
      s.setBossState("idle");
      return;
    }

    if (state.report) {
      s.setBossBubble({ text: state.report ?? REPORT_MESSAGE, type: "speech" });
      s.setBossState("completing");
      return;
    }

    s.setBossBubble(null);
    s.setBossState(state.status === "running" ? "delegating" : "idle");
  }, [store, state.approval, state.report, state.stopReason, state.status]);
}
