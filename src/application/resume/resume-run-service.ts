import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import {
  readdir,
  stat,
} from "node:fs/promises";
import path from "node:path";

import type {
  ResumeRun,
  StartResumeRunInput,
} from "./resume-run.js";

const MAX_CAPTURED_OUTPUT = 1_000_000;
const RUN_TIMEOUT_MS = 30 * 60 * 1_000;

export class ResumeRunService {
  private readonly runs = new Map<string, ResumeRun>();

  constructor(
    private readonly repositoryRoot: string,
    private readonly claudeBin =
      process.env.CLAUDE_BIN ?? "claude",
  ) {}

  start(input: StartResumeRunInput): ResumeRun {
    const company = this.requireText(input.company, "company");
    const role = this.requireText(input.role, "role");
    const jdText = this.requireText(input.jdText, "jdText");

    const now = new Date().toISOString();

    const run: ResumeRun = {
      id: randomUUID(),
      company,
      role,
      status: "queued",
      createdAt: now,
      startedAt: null,
      finishedAt: null,
      outputDir: null,
      resultText: null,
      error: null,
    };

    this.runs.set(run.id, run);

    void this.execute(run.id, {
      company,
      role,
      jdText,
    });

    return this.copyRun(run);
  }

  get(runId: string): ResumeRun | null {
    const run = this.runs.get(runId);

    return run
      ? this.copyRun(run)
      : null;
  }

  private async execute(
    runId: string,
    input: StartResumeRunInput,
  ): Promise<void> {
    const run = this.runs.get(runId);

    if (!run) {
      return;
    }

    this.update(runId, {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    try {
      const outputRoot = path.join(
        this.repositoryRoot,
        "prototypes",
        "resume-tailoring",
        "output",
      );

      const before = await this.listOutputDirectories(outputRoot);

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

      const resultText = await this.runClaude(prompt);
      const outputDir = await this.findNewOutputDirectory(
        outputRoot,
        before,
      );

      this.update(runId, {
        status: "completed",
        finishedAt: new Date().toISOString(),
        resultText,
        outputDir,
        error: null,
      });
    } catch (error) {
      this.update(runId, {
        status: "failed",
        finishedAt: new Date().toISOString(),
        error:
          error instanceof Error
            ? error.message
            : "Unknown resume workflow error",
      });
    }
  }

  private runClaude(prompt: string): Promise<string> {
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
          cwd: this.repositoryRoot,
          shell: false,
          env: claudeEnv,
          stdio: [
            "ignore",
            "pipe",
            "pipe",
          ],
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
          (entry) =>
            entry.isDirectory()
            && !before.has(entry.name),
        )
        .map(async (entry) => {
          const absolutePath = path.join(
            outputRoot,
            entry.name,
          );

          const metadata = await stat(absolutePath);

          return {
            absolutePath,
            modifiedAt: metadata.mtimeMs,
          };
        }),
    );

    candidates.sort(
      (left, right) =>
        right.modifiedAt - left.modifiedAt,
    );

    return candidates[0]?.absolutePath ?? null;
  }

  private update(
    runId: string,
    fields: Partial<ResumeRun>,
  ): void {
    const current = this.runs.get(runId);

    if (!current) {
      return;
    }

    this.runs.set(runId, {
      ...current,
      ...fields,
    });
  }

  private requireText(
    value: string,
    fieldName: string,
  ): string {
    const normalized = value.trim();

    if (normalized.length === 0) {
      throw new Error(`${fieldName} is required`);
    }

    return normalized;
  }

  private copyRun(run: ResumeRun): ResumeRun {
    return { ...run };
  }
}
