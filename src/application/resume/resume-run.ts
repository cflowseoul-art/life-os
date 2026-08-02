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

/** The seven files every run produces, in stage order. */
export const RESUME_STAGE_FILES = [
  "01-jd-analysis.md",
  "02-experience-match.md",
  "03-strategy.md",
  "04-resume-draft.md",
  "05-fact-check.md",
  "06-final-report.md",
  "resume-final.md",
] as const;

export type ResumeRun = {
  id: string;
  company: string;
  role: string;
  /** Which runner executed this run. Derived from APP_ENV, never requested. */
  runner: "replay" | "claude";
  status: ResumeRunStatus;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  outputDir: string | null;
  /** Stage files discovered on disk, in canonical RESUME_STAGE_FILES order. */
  artifacts: string[];
  /** Last artifact discovered, or null before the first one appears. */
  currentStage: string | null;
  resultText: string | null;
  error: string | null;
};
