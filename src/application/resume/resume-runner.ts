/**
 * Resume execution port.
 *
 * `ResumeRunService` owns run *state*; a `ResumeRunner` owns run *execution*.
 * Swapping the runner is how development avoids paying for Claude tokens
 * without the coordinator knowing which implementation it holds.
 */

import type { StartResumeRunInput } from "./resume-run.js";

export type ResumeRunnerResult = {
  /** Directory the run produced, or null when none could be identified. */
  outputDir: string | null;
  /** Human-readable transcript or summary of what the runner did. */
  resultText: string;
};

export interface ResumeRunner {
  /** Identifies the implementation in logs and run records. */
  readonly name: "replay" | "claude";

  run(
    input: StartResumeRunInput,
    context: ResumeRunnerContext,
  ): Promise<ResumeRunnerResult>;
}

export type ResumeRunnerContext = {
  /** Absolute path to the repository root. */
  repositoryRoot: string;
  /** Absolute path to `prototypes/resume-tailoring/output`. */
  outputRoot: string;
  /**
   * Reports the run's output directory as soon as it exists, before the run
   * finishes. Lets the coordinator surface artifact progress mid-run.
   * Called at most once; safe to omit.
   */
  onOutputDir?: (outputDir: string) => void;
};
