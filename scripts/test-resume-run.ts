import path from "node:path";
import { ResumeRunService } from "../src/application/resume/resume-run-service.js";
import { selectRunner } from "../src/application/resume/resume-runner-factory.js";

const repositoryRoot = path.resolve(".");

// Replay by default: no APP_ENV means development, and development defaults
// to the ReplayResumeRunner. Set RESUME_RUNNER=claude with
// ALLOW_LIVE_AI_IN_DEV=true to exercise the real thing.
const service = new ResumeRunService(repositoryRoot);

console.log(
  `runner: ${selectRunner().runnerName} (APP_ENV=${process.env.APP_ENV ?? "development"})`,
);

const run = service.start({
  company: "OpenAI",
  role: "Data Analyst",
  jdText: `
OpenAI is looking for a Data Analyst.

Responsibilities
- SQL
- Python
- Dashboard
- Experiment
- Product Analytics
`,
});

console.log("Run started:");
console.log(run);

const timer = setInterval(() => {
  const current = service.get(run.id);

  if (!current) {
    console.error("Run disappeared.");
    process.exit(1);
  }

  console.clear();
  console.log(current);

  if (
    current.status === "completed" ||
    current.status === "failed"
  ) {
    clearInterval(timer);

    console.log("\n========== FINAL ==========");
    console.dir(current, { depth: null });

    process.exit(
      current.status === "completed" ? 0 : 1,
    );
  }
}, 1000);
