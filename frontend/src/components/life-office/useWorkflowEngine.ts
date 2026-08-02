/**
 * Drives the mocked workflow forward with timers.
 *
 * This hook owns SEMANTIC state only. It never touches coordinates or CSS.
 */

import { useEffect, useMemo, useReducer, useRef } from "react";

import {
  STAGES,
  createInitialState,
  nextScriptedEvent,
  workflowReducer,
} from "./workflow";
import type { JobContext, WorkflowState } from "./types";

export type WorkflowControls = {
  state: WorkflowState;
  start: (jobContext: JobContext) => void;
  approve: () => void;
  reject: () => void;
  reset: () => void;
};

export function useWorkflowEngine(): WorkflowControls {
  const [state, dispatch] = useReducer(workflowReducer, undefined, createInitialState);

  const stateRef = useRef(state);
  stateRef.current = state;

  const activeStage = STAGES[state.activeStageIndex];
  const activePhase = activeStage ? state.stages[activeStage.id].phase : null;

  useEffect(() => {
    const scripted = nextScriptedEvent(stateRef.current);

    if (!scripted) {
      return;
    }

    const timer = window.setTimeout(() => {
      dispatch(scripted.event);
    }, scripted.delayMs);

    return () => window.clearTimeout(timer);
  }, [state.status, state.activeStageIndex, activePhase]);

  return useMemo(
    () => ({
      state,
      start: (jobContext: JobContext) =>
        dispatch({ type: "WORKFLOW_STARTED", jobContext }),
      approve: () => {
        const approval = stateRef.current.approval;

        if (approval) {
          dispatch({ type: "APPROVAL_GRANTED", stageId: approval.stageId });
        }
      },
      reject: () => {
        const approval = stateRef.current.approval;

        if (approval) {
          dispatch({
            type: "APPROVAL_REJECTED",
            stageId: approval.stageId,
            reason: "대표가 외부 발송을 반려했습니다.",
          });
        }
      },
      reset: () => dispatch({ type: "WORKFLOW_RESET" }),
    }),
    [state],
  );
}
