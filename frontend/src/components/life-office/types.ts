/**
 * Life Office — semantic workflow types.
 *
 * This module describes MEANING only (who is doing what, which stage is where in
 * its lifecycle). It contains no pixels, no coordinates and no animation timing.
 * Visual concerns live in `layout.ts` / `useOfficeAnimation.ts`.
 */

export type EmployeeId =
  | "research"
  | "analysis"
  | "draft"
  | "review"
  | "manager";

/** What an employee is semantically doing right now. */
export type EmployeeActivity =
  | "waiting"
  | "walking"
  | "working"
  | "reviewing"
  | "done"
  | "stopped";

/** Where a stage is in its lifecycle. */
export type StageStatus =
  | "pending"
  | "in_progress"
  | "approval_required"
  | "done"
  | "rejected";

/** Fine-grained phase inside an in-progress stage. */
export type StagePhase =
  | "walking"
  | "working"
  | "reviewing"
  | "approval_required"
  | "done";

export type WorkflowStatus =
  | "idle"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "stopped";

/** Semantic destination for a stage. The visual layer maps this to coordinates. */
export type StageZone = "work" | "report";

export type Employee = {
  id: EmployeeId;
  name: string;
  role: string;
  emoji: string;
};

export type StageDefinition = {
  id: string;
  title: string;
  /** Short description of the mocked work this stage represents. */
  detail: string;
  assignee: EmployeeId;
  zone: StageZone;
  /** When true this stage pauses and raises an approval request. */
  requiresApproval?: boolean;
};

export type ApprovalRequest = {
  stageId: string;
  /** Human-readable summary of the action being requested. */
  action: string;
  /** Why the system refuses to run it unattended. */
  reason: string;
  /** Mocked command payload preview — never executed. */
  payload: string[];
};

/**
 * Explicit job input supplied by the user before the workflow may run.
 *
 * The JD is stored as raw pasted text on purpose — nothing parses it yet.
 */
export type JobContext = {
  company: string;
  role: string;
  jdText: string;
};

export type StageState = {
  status: StageStatus;
  phase: StagePhase | null;
};

export type LogEntry = {
  id: number;
  at: string;
  label: string;
  tone: "info" | "warn" | "ok" | "stop";
};

export type WorkflowState = {
  status: WorkflowStatus;
  /** Job the team is working on. Empty until the user starts a run. */
  jobContext: JobContext;
  /** Index into the stage definition list, or -1 when not started. */
  activeStageIndex: number;
  stages: Record<string, StageState>;
  employees: Record<EmployeeId, EmployeeActivity>;
  approval: ApprovalRequest | null;
  /** Message rendered in the report area once the manager finishes. */
  report: string | null;
  stopReason: string | null;
  log: LogEntry[];
};

/**
 * Mocked workflow events. In a real system these would arrive from the server
 * as immutable event records; here they are produced by a timer script.
 */
export type WorkflowEvent =
  | { type: "WORKFLOW_STARTED"; jobContext: JobContext }
  | { type: "STAGE_PHASE_CHANGED"; stageId: string; phase: StagePhase }
  | { type: "APPROVAL_REQUESTED"; request: ApprovalRequest }
  | { type: "APPROVAL_GRANTED"; stageId: string }
  | { type: "APPROVAL_REJECTED"; stageId: string; reason: string }
  | { type: "STAGE_COMPLETED"; stageId: string }
  | { type: "WORKFLOW_RESET" };
