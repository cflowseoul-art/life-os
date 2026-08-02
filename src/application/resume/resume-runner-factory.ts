/**
 * Runner selection.
 *
 * The rules are deliberately strict and fail closed: a misconfigured
 * environment throws at construction rather than silently spending tokens or
 * silently serving replayed artifacts as if they were real.
 */

import path from "node:path";

import { ClaudeResumeRunner } from "./claude-resume-runner.js";
import { ReplayResumeRunner } from "./replay-resume-runner.js";
import type { ResumeRunner } from "./resume-runner.js";

export type AppEnv = "development" | "production";

export type RunnerSelection = {
  appEnv: AppEnv;
  runnerName: "replay" | "claude";
};

function readAppEnv(env: NodeJS.ProcessEnv): AppEnv {
  return env.APP_ENV === "production" ? "production" : "development";
}

/**
 * Resolve which runner the current environment asks for, and reject the
 * combinations that must never run.
 */
export function selectRunner(
  env: NodeJS.ProcessEnv = process.env,
): RunnerSelection {
  const appEnv = readAppEnv(env);
  const raw = env.RESUME_RUNNER?.trim().toLowerCase();
  const requested =
    raw === "replay" || raw === "claude" ? raw : undefined;

  if (raw && !requested) {
    throw new Error(
      `RESUME_RUNNER must be "replay" or "claude" (received "${raw}").`,
    );
  }

  if (appEnv === "production") {
    // Production must never serve replayed artifacts as real output.
    if (requested === "replay") {
      throw new Error(
        "RESUME_RUNNER=replay is not permitted when APP_ENV=production.",
      );
    }

    return { appEnv, runnerName: "claude" };
  }

  // Development defaults to replay; Claude requires an explicit opt-in.
  const runnerName = requested ?? "replay";

  if (runnerName === "claude" && env.ALLOW_LIVE_AI_IN_DEV !== "true") {
    throw new Error(
      "RESUME_RUNNER=claude in development requires ALLOW_LIVE_AI_IN_DEV=true. "
        + "Live Claude runs cost tokens; opt in explicitly.",
    );
  }

  return { appEnv, runnerName };
}

export function createResumeRunner(
  repositoryRoot: string,
  env: NodeJS.ProcessEnv = process.env,
): ResumeRunner {
  const { runnerName } = selectRunner(env);

  if (runnerName === "claude") {
    return new ClaudeResumeRunner(env.CLAUDE_BIN ?? "claude");
  }

  const source =
    env.RESUME_REPLAY_SOURCE
    ?? path.join(
      repositoryRoot,
      "prototypes",
      "resume-tailoring",
      "output",
      "2026-08-01-onepredict-data-analyst",
    );

  return new ReplayResumeRunner(source);
}
