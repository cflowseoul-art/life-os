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
import type { JobContext, WorkflowEvent, WorkflowState } from "./types";

export type WorkflowControls = {
  state: WorkflowState;
  /** Applies an event directly — used to drive state from backend progress. */
  send: (event: WorkflowEvent) => void;
  start: (jobContext: JobContext) => void;
  approve: () => void;
  reject: () => void;
  reset: () => void;
};

/**
 * @param scripted When false the mocked timer progression is suspended, so a
 * real backend run can be the only thing advancing the workflow.
 */
export function useWorkflowEngine(scripted = true): WorkflowControls {
  const [state, dispatch] = useReducer(workflowReducer, undefined, createInitialState);

  const stateRef = useRef(state);
  stateRef.current = state;

  const activeStage = STAGES[state.activeStageIndex];
  const activePhase = activeStage ? state.stages[activeStage.id].phase : null;

  useEffect(() => {
    if (!scripted) {
      return;
    }

    const next = nextScriptedEvent(stateRef.current);

    if (!next) {
      return;
    }

    const timer = window.setTimeout(() => {
      dispatch(next.event);
    }, next.delayMs);

    return () => window.clearTimeout(timer);
  }, [scripted, state.status, state.activeStageIndex, activePhase]);

  return useMemo(
    () => ({
      state,
      send: (event: WorkflowEvent) => { dispatch(event); },
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
