import path from "node:path";
import { ResumeRunService } from "../src/application/resume/resume-run-service.js";

const repositoryRoot = path.resolve(".");

const service = new ResumeRunService(repositoryRoot);

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
