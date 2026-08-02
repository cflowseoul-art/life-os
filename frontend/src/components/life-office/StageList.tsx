/** Sequential stage list — the semantic view of the same state the floor shows. */

import { CAREER_TEAM, STAGES } from "./workflow";
import type { StageStatus, WorkflowState } from "./types";

const MARK: Record<StageStatus, string> = {
  pending: "○",
  in_progress: "◐",
  approval_required: "⏸",
  done: "●",
  rejected: "✕",
};

function nameOf(assignee: string): string {
  return CAREER_TEAM.find((member) => member.id === assignee)?.name ?? assignee;
}

export function StageList({ state }: { state: WorkflowState }) {
  return (
    <div>
      {STAGES.map((stage) => {
        const stageState = state.stages[stage.id];

        const modifier =
          stageState.status === "approval_required"
            ? "lo-stage-approval"
            : stageState.status === "rejected"
              ? "lo-stage-rejected"
              : stageState.status === "in_progress"
                ? "lo-stage-active"
                : "";

        return (
          <div key={stage.id} className={`lo-stage ${modifier}`}>
            <div className="lo-stage-mark">{MARK[stageState.status]}</div>

            <div className="lo-stage-body">
              <div className="lo-stage-title">
                {stage.title}
                {stage.requiresApproval ? " 🔒" : ""}
              </div>
              <div className="lo-stage-detail">
                {nameOf(stage.assignee)} · {stage.detail}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
