/**
 * Life Office — mocked Career Team workflow definition and pure reducer.
 *
 * Everything here is a fixture. No network, no filesystem, no AI call, no
 * command execution. The reducer only rearranges in-memory state.
 */

import type {
  ApprovalRequest,
  Employee,
  EmployeeActivity,
  EmployeeId,
  JobContext,
  StageDefinition,
  StageState,
  WorkflowEvent,
  WorkflowState,
} from "./types";

export const CAREER_TEAM: Employee[] = [
  {
    id: "research",
    name: "김리서치",
    role: "채용공고 리서처",
    emoji: "🔎",
  },
  {
    id: "analysis",
    name: "박분석",
    role: "역량 갭 분석가",
    emoji: "📊",
  },
  {
    id: "draft",
    name: "이작성",
    role: "이력서 초안 작성",
    emoji: "✍️",
  },
  {
    id: "review",
    name: "최검수",
    role: "사실 검증 검수자",
    emoji: "🧐",
  },
  {
    id: "manager",
    name: "한매니저",
    role: "커리어팀 매니저",
    emoji: "🧑‍💼",
  },
];

export const STAGES: StageDefinition[] = [
  {
    id: "collect-jd",
    title: "채용공고 수집",
    detail: "관심 직무 3건의 공고 본문을 정리합니다.",
    assignee: "research",
    zone: "work",
  },
  {
    id: "gap-analysis",
    title: "역량 갭 분석",
    detail: "요구 역량과 보유 경험의 차이를 표로 정리합니다.",
    assignee: "analysis",
    zone: "work",
  },
  {
    id: "draft-resume",
    title: "이력서 초안 작성",
    detail: "공고별 강조 포인트를 반영한 초안을 만듭니다.",
    assignee: "draft",
    zone: "work",
  },
  {
    id: "fact-check",
    title: "사실 검증 검수",
    detail: "수치와 경력 기간이 원본과 일치하는지 확인합니다.",
    assignee: "review",
    zone: "work",
  },
  {
    id: "final-report",
    title: "최종 보고",
    detail: "대표에게 진행 결과를 요약해 보고합니다.",
    assignee: "manager",
    zone: "report",
  },
];

export const APPROVAL_REQUEST: ApprovalRequest = {
  stageId: "send-application",
  action: "이력서 3건을 외부 채용 담당자에게 메일로 발송",
  reason:
    "외부로 나가는 되돌릴 수 없는 작업이고 개인정보가 담긴 첨부파일이 포함됩니다. 정책상 대표 승인 없이는 실행할 수 없습니다.",
  payload: [
    "command: application.send",
    "recipients: 3 (mocked)",
    "attachments: resume-final.pdf (mocked)",
    "execution: blocked — demo only",
  ],
};

export const REPORT_MESSAGE = "대표님! 보고가 완료됐습니다.";

/** Phase durations for the mocked event script (milliseconds). */
export const TIMING = {
  walking: 1600,
  working: 2200,
  reviewing: 1500,
  handoff: 500,
} as const;

export const EMPTY_JOB_CONTEXT: JobContext = {
  company: "",
  role: "",
  jdText: "",
};

/**
 * A job context is usable once all three fields carry non-blank text.
 * The JD is only checked for presence — no parsing happens here.
 */
export function isJobContextValid(context: JobContext): boolean {
  return (
    context.company.trim() !== "" &&
    context.role.trim() !== "" &&
    context.jdText.trim() !== ""
  );
}

export function stageById(stageId: string): StageDefinition | undefined {
  return STAGES.find((stage) => stage.id === stageId);
}

export function createInitialState(): WorkflowState {
  const stages: Record<string, StageState> = {};

  for (const stage of STAGES) {
    stages[stage.id] = {
      status: "pending",
      phase: null,
    };
  }

  const employees = {} as Record<EmployeeId, EmployeeActivity>;

  for (const employee of CAREER_TEAM) {
    employees[employee.id] = "waiting";
  }

  return {
    status: "idle",
    jobContext: EMPTY_JOB_CONTEXT,
    activeStageIndex: -1,
    stages,
    employees,
    approval: null,
    report: null,
    stopReason: null,
    log: [],
  };
}

function withLog(
  state: WorkflowState,
  label: string,
  tone: "info" | "warn" | "ok" | "stop" = "info",
): WorkflowState {
  const now = new Date();

  const at = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

  const nextId = state.log.length === 0 ? 1 : state.log[0].id + 1;

  return {
    ...state,
    log: [{ id: nextId, at, label, tone }, ...state.log].slice(0, 24),
  };
}

/** Maps a stage phase onto the assignee's semantic activity. */
function activityForPhase(phase: StageState["phase"]): EmployeeActivity {
  switch (phase) {
    case "walking":
      return "walking";
    case "working":
      return "working";
    case "reviewing":
      return "reviewing";
    case "approval_required":
      return "waiting";
    case "done":
      return "done";
    default:
      return "waiting";
  }
}

function enterStage(state: WorkflowState, index: number): WorkflowState {
  const stage = STAGES[index];

  const next: WorkflowState = {
    ...state,
    status: "running",
    activeStageIndex: index,
    stages: {
      ...state.stages,
      [stage.id]: { status: "in_progress", phase: "walking" },
    },
    employees: {
      ...state.employees,
      [stage.assignee]: "walking",
    },
  };

  return withLog(next, `${stage.title} 시작 — 담당자 이동 중`);
}

export function workflowReducer(
  state: WorkflowState,
  event: WorkflowEvent,
): WorkflowState {
  switch (event.type) {
    case "WORKFLOW_RESET":
      return createInitialState();

    case "WORKFLOW_STARTED": {
      if (state.status === "running" || state.status === "awaiting_approval") {
        return state;
      }

      // Gate: without an explicit job context there is nothing to research,
      // so no employee may leave "waiting".
      if (!isJobContextValid(event.jobContext)) {
        return withLog(
          state,
          "시작 거부 — 회사·직무·JD를 모두 입력해야 합니다",
          "warn",
        );
      }

      const fresh = withLog(
        { ...createInitialState(), jobContext: event.jobContext },
        `커리어팀 워크플로 시작 — ${event.jobContext.company} / ${event.jobContext.role} (모의 실행)`,
        "ok",
      );

      return enterStage(fresh, 0);
    }

    case "STAGE_PHASE_CHANGED": {
      const stage = stageById(event.stageId);

      if (!stage || state.stages[event.stageId].status !== "in_progress") {
        return state;
      }

      const labels: Record<string, string> = {
        walking: `${stage.title} — 이동 중`,
        working: `${stage.title} — 작업 중`,
        reviewing: `${stage.title} — 검토 중`,
      };

      const next: WorkflowState = {
        ...state,
        stages: {
          ...state.stages,
          [stage.id]: { status: "in_progress", phase: event.phase },
        },
        employees: {
          ...state.employees,
          [stage.assignee]: activityForPhase(event.phase),
        },
      };

      return withLog(next, labels[event.phase] ?? `${stage.title} — ${event.phase}`);
    }

    case "APPROVAL_REQUESTED": {
      const stage = stageById(event.request.stageId);

      if (!stage) {
        return state;
      }

      const next: WorkflowState = {
        ...state,
        status: "awaiting_approval",
        stages: {
          ...state.stages,
          [stage.id]: {
            status: "approval_required",
            phase: "approval_required",
          },
        },
        employees: {
          ...state.employees,
          [stage.assignee]: "waiting",
        },
        approval: event.request,
      };

      return withLog(next, `${stage.title} — 승인 필요, 작업 정지`, "warn");
    }

    case "APPROVAL_GRANTED": {
      const stage = stageById(event.stageId);

      if (!stage || state.status !== "awaiting_approval") {
        return state;
      }

      const next: WorkflowState = {
        ...state,
        status: "running",
        stages: {
          ...state.stages,
          [stage.id]: { status: "in_progress", phase: "reviewing" },
        },
        employees: {
          ...state.employees,
          [stage.assignee]: "reviewing",
        },
        approval: null,
      };

      return withLog(next, `${stage.title} — 대표 승인됨, 작업 재개`, "ok");
    }

    case "APPROVAL_REJECTED": {
      const stage = stageById(event.stageId);

      if (!stage || state.status !== "awaiting_approval") {
        return state;
      }

      const employees = { ...state.employees };

      for (const employee of CAREER_TEAM) {
        if (employees[employee.id] !== "done") {
          employees[employee.id] = "stopped";
        }
      }

      const next: WorkflowState = {
        ...state,
        status: "stopped",
        stages: {
          ...state.stages,
          [stage.id]: { status: "rejected", phase: null },
        },
        employees,
        approval: null,
        stopReason: event.reason,
      };

      return withLog(next, `${stage.title} — 대표 반려, 워크플로 중단`, "stop");
    }

    case "WORKFLOW_FAILED": {
      if (state.status === "stopped" || state.status === "completed") {
        return state;
      }

      const employees = { ...state.employees };

      for (const employee of CAREER_TEAM) {
        if (employees[employee.id] !== "done") {
          employees[employee.id] = "stopped";
        }
      }

      // Only the stage that was mid-flight is marked; finished and pending
      // stages keep their status. "rejected" is the closest existing
      // StageStatus for "did not complete" — the union has no "failed".
      const stages = { ...state.stages };
      const active = STAGES[state.activeStageIndex];

      if (active && stages[active.id]?.status === "in_progress") {
        stages[active.id] = { status: "rejected", phase: null };
      }

      const next: WorkflowState = {
        ...state,
        status: "stopped",
        stages,
        employees,
        approval: null,
        stopReason: event.reason,
      };

      return withLog(next, `실행 실패 — ${event.reason}`, "stop");
    }

    case "STAGE_COMPLETED": {
      const stage = stageById(event.stageId);

      if (!stage || state.stages[event.stageId].status !== "in_progress") {
        return state;
      }

      const completed: WorkflowState = {
        ...state,
        stages: {
          ...state.stages,
          [stage.id]: { status: "done", phase: "done" },
        },
        employees: {
          ...state.employees,
          [stage.assignee]: "done",
        },
      };

      const logged = withLog(completed, `${stage.title} 완료`, "ok");
      const nextIndex = state.activeStageIndex + 1;

      if (nextIndex >= STAGES.length) {
        return withLog(
          {
            ...logged,
            status: "completed",
            activeStageIndex: STAGES.length,
            report: REPORT_MESSAGE,
          },
          "모든 단계 완료 — 보고 전달",
          "ok",
        );
      }

      return enterStage(logged, nextIndex);
    }

    default:
      return state;
  }
}

/**
 * The mocked event script: given the current state, decide which event fires
 * next and after how long. Returning null means the workflow is waiting on the
 * user (approval) or has ended.
 */
export function nextScriptedEvent(
  state: WorkflowState,
): { event: WorkflowEvent; delayMs: number } | null {
  if (state.status !== "running") {
    return null;
  }

  const stage = STAGES[state.activeStageIndex];

  if (!stage) {
    return null;
  }

  const phase = state.stages[stage.id].phase;

  switch (phase) {
    case "walking":
      return {
        delayMs: TIMING.walking,
        event: {
          type: "STAGE_PHASE_CHANGED",
          stageId: stage.id,
          phase: "working",
        },
      };

    case "working":
      if (stage.requiresApproval) {
        return {
          delayMs: TIMING.working,
          event: { type: "APPROVAL_REQUESTED", request: APPROVAL_REQUEST },
        };
      }

      return {
        delayMs: TIMING.working,
        event: {
          type: "STAGE_PHASE_CHANGED",
          stageId: stage.id,
          phase: "reviewing",
        },
      };

    case "reviewing":
      return {
        delayMs: TIMING.reviewing,
        event: { type: "STAGE_COMPLETED", stageId: stage.id },
      };

    default:
      return null;
  }
}
