/**
 * Production runner: spawns Claude Code to execute /tailor-resume.
 *
 * Behavior is unchanged from the original in-service implementation — same
 * prompt, same CLI flags, same timeout, same output-directory detection.
 * Only its location moved, so it can be swapped out in development.
 */

import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

import type { StartResumeRunInput } from "./resume-run.js";
import type {
  ResumeRunner,
  ResumeRunnerContext,
  ResumeRunnerResult,
} from "./resume-runner.js";

const MAX_CAPTURED_OUTPUT = 1_000_000;
const RUN_TIMEOUT_MS = 30 * 60 * 1_000;
/** How often to look for the directory Claude creates. Run-scoped. */
const OUTPUT_DIR_POLL_MS = 2_000;

export class ClaudeResumeRunner implements ResumeRunner {
  readonly name = "claude" as const;

  constructor(
    private readonly claudeBin = process.env.CLAUDE_BIN ?? "claude",
  ) {}

  async run(
    input: StartResumeRunInput,
    context: ResumeRunnerContext,
  ): Promise<ResumeRunnerResult> {
    const before = await this.listOutputDirectories(context.outputRoot);

    const prompt = [
      "Run /tailor-resume exactly as defined in the repository.",
      "Use the pasted job description below as the current input.",
      "Do not modify source-data.",
      `Company hint: ${input.company}`,
      `Role hint: ${input.role}`,
      "",
      "----- BEGIN JOB DESCRIPTION -----",
      input.jdText,
      "----- END JOB DESCRIPTION -----",
    ].join("\n");

    // Watch for the directory Claude creates, so progress is visible before
    // the process exits. Scoped to this run and stopped in `finally`.
    let stopped = false;
    let reported: string | null = null;

    const poll = setInterval(() => {
      if (stopped || reported) {
        return;
      }

      void this.findNewOutputDirectory(context.outputRoot, before)
        .then((found) => {
          if (!stopped && found && !reported) {
            reported = found;
            context.onOutputDir?.(found);
          }
        })
        .catch(() => {
          // Directory not readable yet; the next tick retries.
        });
    }, OUTPUT_DIR_POLL_MS);

    let resultText: string;

    try {
      resultText = await this.runClaude(
        prompt,
        context.repositoryRoot,
      );
    } finally {
      stopped = true;
      clearInterval(poll);
    }

    const outputDir =
      (await this.findNewOutputDirectory(context.outputRoot, before))
      ?? reported;

    return { outputDir, resultText };
  }

  private runClaude(
    prompt: string,
    repositoryRoot: string,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      // Force Claude Code to use the logged-in Pro/OAuth session.
      // Life OS environment variables must not override that session.
      const claudeEnv = { ...process.env };
      delete claudeEnv.ANTHROPIC_API_KEY;
      delete claudeEnv.ANTHROPIC_AUTH_TOKEN;

      const child = spawn(
        this.claudeBin,
        [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--permission-mode",
          "acceptEdits",
          "--allowedTools",
          "Read,Write,Edit,Glob,Grep,Bash",
          "--no-session-persistence",
        ],
        {
          cwd: repositoryRoot,
          shell: false,
          env: claudeEnv,
          stdio: ["ignore", "pipe", "pipe"],
        },
      );

      let stdout = "";
      let stderr = "";
      let settled = false;

      const append = (
        current: string,
        chunk: Buffer | string,
      ): string => {
        const next = current + chunk.toString();

        return next.length > MAX_CAPTURED_OUTPUT
          ? next.slice(-MAX_CAPTURED_OUTPUT)
          : next;
      };

      child.stdout.on("data", (chunk: Buffer) => {
        stdout = append(stdout, chunk);
      });

      child.stderr.on("data", (chunk: Buffer) => {
        stderr = append(stderr, chunk);
      });

      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        child.kill("SIGTERM");
        reject(
          new Error(
            `Claude resume workflow timed out after ${RUN_TIMEOUT_MS / 60_000} minutes`,
          ),
        );
      }, RUN_TIMEOUT_MS);

      child.once("error", (error) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);
        reject(error);
      });

      child.once("close", (code) => {
        if (settled) {
          return;
        }

        settled = true;
        clearTimeout(timeout);

        if (code !== 0) {
          reject(
            new Error(
              [
                `Claude exited with code ${String(code)}`,
                stderr.trim(),
              ]
                .filter(Boolean)
                .join("\n"),
            ),
          );
          return;
        }

        resolve(stdout.trim());
      });
    });
  }

  private async listOutputDirectories(
    outputRoot: string,
  ): Promise<Set<string>> {
    try {
      const entries = await readdir(outputRoot, {
        withFileTypes: true,
      });

      return new Set(
        entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => entry.name),
      );
    } catch {
      return new Set();
    }
  }

  private async findNewOutputDirectory(
    outputRoot: string,
    before: Set<string>,
  ): Promise<string | null> {
    const entries = await readdir(outputRoot, {
      withFileTypes: true,
    });

    const candidates = await Promise.all(
      entries
        .filter(
          (entry) => entry.isDirectory() && !before.has(entry.name),
        )
        .map(async (entry) => {
          const absolutePath = path.join(outputRoot, entry.name);
          const metadata = await stat(absolutePath);

          return {
            absolutePath,
            modifiedAt: metadata.mtimeMs,
          };
        }),
    );

    candidates.sort(
      (left, right) => right.modifiedAt - left.modifiedAt,
    );

    return candidates[0]?.absolutePath ?? null;
  }
}
