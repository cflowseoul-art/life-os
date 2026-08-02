export type ResumeRunStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed";

export type StartResumeRunInput = {
  company: string;
  role: string;
  jdText: string;
};

export type ResumeRun = {
  id: string;
  company: string;
  role: string;
  status: ResumeRunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  outputDir: string | null;
  resultText: string | null;
  error: string | null;
};
