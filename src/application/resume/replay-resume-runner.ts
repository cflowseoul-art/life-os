/**
 * Development runner: replays a previously produced run instead of calling
 * Claude. Costs nothing and is deterministic.
 *
 * The seven artifacts are copied from `RESUME_REPLAY_SOURCE` one stage at a
 * time, in order, so consumers observing the output directory see the same
 * progressive file appearance a real run produces.
 */

import {
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";

import { RESUME_STAGE_FILES } from "./resume-run.js";
import type { StartResumeRunInput } from "./resume-run.js";
import type {
  ResumeRunner,
  ResumeRunnerContext,
  ResumeRunnerResult,
} from "./resume-runner.js";

/** Delay between stages, so replay is observable rather than instantaneous. */
const STAGE_DELAY_MS = 400;

const REPLAY_BANNER = [
  "<!-- REPLAYED ARTIFACT — mode: replay. No Claude call was made.",
  "     Content below is copied verbatim from a previous run. -->",
].join("\n");

export class ReplayResumeRunner implements ResumeRunner {
  readonly name = "replay" as const;

  constructor(
    private readonly sourceDir: string,
    private readonly stageDelayMs = STAGE_DELAY_MS,
  ) {}

  async run(
    input: StartResumeRunInput,
    context: ResumeRunnerContext,
  ): Promise<ResumeRunnerResult> {
    const outputDir = path.join(
      context.outputRoot,
      this.directoryName(input),
    );

    await mkdir(outputDir, { recursive: true });

    // Directory exists now; stages appear inside it one at a time.
    context.onOutputDir?.(outputDir);

    const replayed: string[] = [];

    for (const fileName of RESUME_STAGE_FILES) {
      const source = path.join(this.sourceDir, fileName);

      let body: string;

      try {
        body = await readFile(source, "utf8");
      } catch {
        throw new Error(
          `Replay source is missing ${fileName}. Set RESUME_REPLAY_SOURCE to a directory containing all ${String(RESUME_STAGE_FILES.length)} stage artifacts (looked in ${this.sourceDir}).`,
        );
      }

      await writeFile(
        path.join(outputDir, fileName),
        `${REPLAY_BANNER}\n\n${body}`,
        "utf8",
      );

      replayed.push(fileName);

      if (this.stageDelayMs > 0) {
        await this.delay(this.stageDelayMs);
      }
    }

    return {
      outputDir,
      resultText: [
        `Replayed ${String(replayed.length)} stages from ${this.sourceDir}.`,
        "No Claude call was made.",
        ...replayed.map((name, index) => `  ${String(index + 1)}. ${name}`),
      ].join("\n"),
    };
  }

  private directoryName(input: StartResumeRunInput): string {
    const slug = (value: string): string =>
      value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9가-힣-]/g, "");

    const date = new Date().toISOString().slice(0, 10);

    return `${date}-${slug(input.company)}-${slug(input.role)}-replay`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
