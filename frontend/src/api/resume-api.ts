/**
 * Resume run API client.
 *
 * Execution kind (replay vs Claude) is decided server-side from APP_ENV — the
 * client cannot request one, which is what keeps development on replay.
 */

const WORKSPACE_ID = "default";

export type ResumeRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type ResumeRun = {
  id: string;
  company: string;
  role: string;
  runner: "replay" | "claude";
  status: ResumeRunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  outputDir: string | null;
  /** Stage files discovered so far, in canonical order. */
  artifacts: string[];
  /** Last artifact produced, or null before the first one appears. */
  currentStage: string | null;
  resultText: string | null;
  error: string | null;
};

type ResumeEnvelope = {
  module: "resume";
  action: "run_started" | "run_status";
  data: ResumeRun;
};

async function readEnvelope(response: Response): Promise<ResumeRun> {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(
      `Resume API ${String(response.status)}: ${text.slice(0, 300)}`,
    );
  }

  const parsed = JSON.parse(text) as ResumeEnvelope;

  return parsed.data;
}

export async function startResumeRun(input: {
  company: string;
  role: string;
  jdText: string;
}): Promise<ResumeRun> {
  const response = await fetch(
    `/api/workspaces/${WORKSPACE_ID}/resume/runs`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    },
  );

  return readEnvelope(response);
}

export async function getResumeRun(runId: string): Promise<ResumeRun> {
  const response = await fetch(
    `/api/workspaces/${WORKSPACE_ID}/resume/runs/${encodeURIComponent(runId)}`,
  );

  return readEnvelope(response);
}

export function isRunActive(status: ResumeRunStatus): boolean {
  return status === "queued" || status === "running";
}
